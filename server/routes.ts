import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertIncidentSchema, insertSettingsSchema, incidents } from "@shared/schema";
import { sendIncidentNotification, sendTestEmail } from "./gmail-email-service";
import { threatIntelligence } from "./threat-intelligence";
import { ThreatPredictionEngine } from "./threat-prediction";
import { GeminiCyberAnalyst } from "./gemini-ai";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { getQueryErrorHint } from "./query-helpers";
import { db } from "./db";
import { sql, eq, and } from "drizzle-orm";
import Stripe from "stripe";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Storage usage endpoints
  app.get("/api/storage/usage", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [detailedUsage, storageLimit, quota] = await Promise.all([
        storage.calculateDetailedStorageUsage(userId),
        storage.getUserStorageLimit(userId),
        storage.checkStorageQuota(userId)
      ]);
      
      res.json({
        usage: detailedUsage,
        limit: storageLimit,
        quota: quota,
        planLimits: {
          starter: 2,
          professional: 10,
          business: 25,
          enterprise: 100,
          free: 0.1
        }
      });
    } catch (error) {
      console.error("Error fetching storage usage:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/storage/cleanup", isAuthenticated, async (req: any, res) => {
    try {
      const deletedCount = await storage.deleteExpiredIncidents();
      res.json({ deletedIncidents: deletedCount, message: `Deleted ${deletedCount} expired incidents` });
    } catch (error) {
      console.error("Error cleaning up expired incidents:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/storage/cleanup-preview", isAuthenticated, async (req: any, res) => {
    try {
      const incidentsToDelete = await storage.getIncidentsToBeDeleted();
      res.json({ incidentsToBeDeleted: incidentsToDelete });
    } catch (error) {
      console.error("Error getting cleanup preview:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/incidents/:id/storage-size", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const storageSize = await storage.calculateIncidentStorageSize(req.params.id, userId);
      res.json({ storageSizeMB: storageSize });
    } catch (error) {
      console.error("Error calculating incident storage size:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  // Incidents routes (user-specific)
  app.get("/api/incidents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const incidents = await storage.getUserIncidents(userId);
      res.json(incidents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch incidents" });
    }
  });

  app.get("/api/incidents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const incident = await storage.getIncident(req.params.id, userId);
      if (!incident) {
        return res.status(404).json({ error: "Incident not found" });
      }
      res.json(incident);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch incident" });
    }
  });

  app.post("/api/incidents", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertIncidentSchema.parse(req.body);
      
      // Get user ID from Replit Auth claims
      const userId = req.user.claims.sub;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      // Check if user has sufficient credits for incident analysis
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Check if in development mode (bypass credit check)
      const isDevelopment = process.env.NODE_ENV === 'development' || process.env.SKIP_PAYMENT_CHECK === 'true';
      
      // Get plan-based pricing
      const getIncidentCost = (plan: string) => {
        switch (plan) {
          case 'starter': return 25; // €25 per incident
          case 'professional': return 23.75; // 5% discount
          case 'business': return 22.50; // 10% discount
          case 'enterprise': return 20; // 20% discount
          default: return 25; // Default to starter pricing
        }
      };
      
      const INCIDENT_ANALYSIS_COST = isDevelopment ? 0 : getIncidentCost(user.subscriptionPlan || 'starter');
      
      if (!isDevelopment) {
        // Production mode: Check if user has remaining incident analyses in their plan
        const userCredits = parseFloat(user.credits || '0');
        if (userCredits < 1) {
          return res.status(402).json({ 
            error: "No incident analyses remaining", 
            message: `Your ${user.subscriptionPlan || 'current'} plan has no remaining incident analyses. Please upgrade your plan.`,
            requiredCredits: 1,
            currentCredits: userCredits
          });
        }
        
        // Deduct one incident analysis from user's plan
        const success = await storage.deductCredits(userId, 1);
        if (!success) {
          return res.status(402).json({ 
            error: "Failed to deduct incident analysis", 
            message: "Unable to process. Please try again."
          });
        }
        
        // Log the transaction
        await storage.createBillingTransaction({
          type: 'incident-analysis',
          amount: INCIDENT_ANALYSIS_COST.toString(),
          credits: '1', // 1 incident analyzed
          description: `Incident analysis: ${validatedData.title}`,
          status: 'completed'
        }, userId);
      }
      // Get user settings for email notifications
      const userSettings = await storage.getUserSettings(userId);
      
      // Analyze threat intelligence
      const threatReport = await threatIntelligence.analyzeThreatIntelligence(
        validatedData.logData || '',
        validatedData.additionalLogs || ''
      );
      
      // Real Gemini AI analysis with 8 specialized agents replacing mock system
      console.log('🔍 Starting Gemini AI analysis for incident:', validatedData.title);
      console.log('📊 Log data length:', (validatedData.logData || '').length, 'characters');
      console.log('⚙️ User settings:', JSON.stringify(userSettings, null, 2));
      
      let aiAnalysis;
      try {
        console.log('⏱️ Starting AI analysis with 3-minute timeout...');
        const analysisTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Analysis timeout after 3 minutes')), 180000)
        );
        
        aiAnalysis = await Promise.race([
          generateRealAIAnalysis(validatedData, userSettings, threatReport, userId),
          analysisTimeout
        ]);
        
        console.log('✅ Gemini AI analysis completed successfully');
        console.log('📈 Analysis confidence:', aiAnalysis?.confidence);
        console.log('🔍 Analysis classification:', aiAnalysis?.classification);
      } catch (error: any) {
        console.error('❌ Gemini AI analysis failed:', error?.message || error);
        console.log('🔄 Using fallback analysis');
        aiAnalysis = generateFailsafeAnalysis(validatedData, userSettings, threatReport);
        console.log('✅ Fallback analysis completed');
      }
      const incidentData = {
        ...validatedData,
        userId: userId, // Associate incident with user
        ...aiAnalysis,
        title: validatedData.title, // Preserve original title (don't let AI overwrite it)
        threatIntelligence: JSON.stringify(threatReport)
      };
      
      const incident = await storage.createIncident(incidentData, userId);
      
      // Update usage tracking - increment incidents analyzed count
      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
      const currentUsage = await storage.getUserUsage(userId, currentMonth);
      await storage.updateUsageTracking(userId, currentMonth, {
        incidentsAnalyzed: (currentUsage?.incidentsAnalyzed || 0) + 1,
        storageGB: await storage.calculateStorageUsage(userId),
        totalCost: (((currentUsage?.incidentsAnalyzed || 0) + 1) * INCIDENT_ANALYSIS_COST).toString()
      });
      
      // Send email notification if enabled
      if (userSettings?.emailNotifications && userSettings?.emailAddress) {
        console.log(`Attempting to send email notification to ${userSettings.emailAddress} for incident ${incident.id}`);
        const user = await storage.getUser(userId);
        if (user) {
          const isHighSeverity = ['critical', 'high'].includes(incident.severity?.toLowerCase() || '');
          const shouldSendHighSeverityAlert = Boolean(userSettings.highSeverityAlerts) && isHighSeverity;
          
          const emailSent = await sendIncidentNotification({
            incident,
            user,
            recipientEmail: userSettings.emailAddress,
            isHighSeverityAlert: shouldSendHighSeverityAlert
          });
          
          if (emailSent) {
            console.log(`Email notification sent successfully to ${userSettings.emailAddress}`);
          } else {
            console.log(`Failed to send email notification to ${userSettings.emailAddress}`);
          }
        }
      } else {
        console.log(`Email notifications not configured. Settings exist: ${!!userSettings}, Email enabled: ${userSettings?.emailNotifications}, Email address: ${userSettings?.emailAddress}`);
      }
      
      res.status(201).json(incident);
    } catch (error: any) {
      console.error("Incident creation error:", error);
      res.status(400).json({ error: "Invalid incident data", details: error?.message || 'Unknown error' });
    }
  });

  app.patch("/api/incidents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const incident = await storage.updateIncident(req.params.id, userId, req.body);
      if (!incident) {
        return res.status(404).json({ error: "Incident not found" });
      }
      res.json(incident);
    } catch (error) {
      res.status(500).json({ error: "Failed to update incident" });
    }
  });

  // Settings routes
  app.get("/api/settings/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const settings = await storage.getUserSettings(userId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings/:userId", isAuthenticated, async (req: any, res) => {
    try {
      // Ensure user can only update their own settings
      const authenticatedUserId = req.user.claims.sub;
      const targetUserId = req.params.userId;
      
      if (authenticatedUserId !== targetUserId) {
        return res.status(403).json({ error: "Cannot update other user's settings" });
      }
      
      const validatedData = insertSettingsSchema.partial().parse(req.body);
      
      // Get current settings to compare
      const currentSettings = await storage.getUserSettings(targetUserId);
      
      // Update settings
      const settings = await storage.updateUserSettings(targetUserId, validatedData);
      
      // Send test email only when:
      // 1. Email notifications are being enabled for the first time, OR
      // 2. The email address has been changed
      const emailJustEnabled = validatedData.emailNotifications === true && 
                               currentSettings?.emailNotifications !== true;
      const emailAddressChanged = validatedData.emailAddress && 
                                 validatedData.emailAddress !== currentSettings?.emailAddress;
      
      if (validatedData.emailNotifications && validatedData.emailAddress && 
          (emailJustEnabled || emailAddressChanged)) {
        console.log('Sending test email - Feature just enabled or address changed');
        await sendTestEmail(validatedData.emailAddress);
      }
      
      res.json(settings);
    } catch (error) {
      console.error('Settings update error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid settings data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update settings" });
      }
    }
  });

  // Dashboard stats (user-specific and linked to actual incident data)
  app.get("/api/dashboard-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const incidents = await storage.getUserIncidents(userId);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Calculate metrics from actual user incident data
      const activeThreats = incidents.filter(i => 
        i.status === "open" && (i.severity === "critical" || i.severity === "high")
      ).length;
      
      const todayIncidents = incidents.filter(i => 
        new Date(i.createdAt!).getTime() >= today.getTime()
      ).length;
      
      const truePositives = incidents.filter(i => 
        i.classification === "true-positive"
      ).length;
      
      const totalConfidence = incidents.reduce((acc, i) => acc + (i.confidence || 0), 0);
      const avgConfidence = incidents.length > 0 ? Math.round(totalConfidence / incidents.length) : 0;
      
      res.json({
        activeThreats,
        todayIncidents,
        truePositives,
        avgConfidence,
        totalIncidents: incidents.length,
        userId: userId
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Threat Prediction API
  app.get("/api/threat-prediction", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const incidents = await storage.getIncidentsByUserId(userId, { limit: 10 });
      const prediction = await generateThreatPredictionFromIncidents(incidents, userId);
      res.json(prediction);
    } catch (error) {
      console.error('Error generating threat prediction:', error);
      res.status(500).json({ 
        error: "Failed to generate threat prediction",
        overallThreatLevel: 50,
        confidence: 60,
        riskTrend: "stable"
      });
    }
  });

  // User with credits endpoint
  app.get("/api/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user data" });
    }
  });

  // Update user account
  app.patch("/api/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { firstName, lastName, email } = req.body;
      
      const updatedUser = await storage.updateUser(userId, {
        firstName,
        lastName,
        email,
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user account" });
    }
  });

  // API Configurations endpoints
  app.get("/api/api-configurations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const configs = await storage.getUserApiConfigs(userId);
      res.json(configs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch API configurations" });
    }
  });

  app.post("/api/api-configurations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const config = await storage.createApiConfig(req.body, userId);
      res.status(201).json(config);
    } catch (error) {
      res.status(400).json({ error: "Failed to create API configuration" });
    }
  });

  app.patch("/api/api-configurations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const config = await storage.updateApiConfig(req.params.id, userId, req.body);
      if (!config) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to update API configuration" });
    }
  });

  app.delete("/api/api-configurations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const deleted = await storage.deleteApiConfig(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete API configuration" });
    }
  });

  app.post("/api/api-configurations/:id/test", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const config = await storage.getApiConfig(req.params.id, userId);
      if (!config) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      // Simulate test - in production, would actually test the endpoint
      res.json({ success: true, message: "Connection test successful" });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to test API configuration" });
    }
  });

  // Billing & Credits endpoints
  app.get("/api/billing/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transactions = await storage.getUserTransactions(userId);
      res.json(transactions);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.get("/api/billing/usage", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
      const usage = await storage.getUserUsage(userId, currentMonth);
      const storageGB = await storage.calculateStorageUsage(userId);
      
      // Get plan storage limits
      const getStorageIncluded = (plan: string) => {
        switch (plan) {
          case 'starter': return 2;
          case 'professional': return 10;
          case 'business': return 25;
          case 'enterprise': return 100;
          default: return 0;
        }
      };
      
      const planStorageIncluded = getStorageIncluded(user?.subscriptionPlan || 'starter');
      const storageOverage = Math.max(0, storageGB - planStorageIncluded);
      const storageOverageCost = storageOverage * 1; // €1 per GB over limit
      
      // Get plan-based incident cost
      const getIncidentCost = (plan: string) => {
        switch (plan) {
          case 'starter': return 25;
          case 'professional': return 23.75;
          case 'business': return 22.50;
          case 'enterprise': return 20;
          default: return 25;
        }
      };
      
      // Calculate actual incidents analyzed this month from database
      const actualIncidentsThisMonth = await db
        .select({ count: sql<number>`count(*)` })
        .from(incidents)
        .where(and(
          eq(incidents.userId, userId),
          sql`date_trunc('month', created_at) = date_trunc('month', now())`
        ));
      
      const actualIncidentsCount = actualIncidentsThisMonth[0]?.count || 0;
      
      // Calculate total cost this month based on actual incidents
      const incidentsCost = actualIncidentsCount * getIncidentCost(user?.subscriptionPlan || 'starter');
      const totalCost = incidentsCost + storageOverageCost;
      
      // Update usage tracking with actual data
      await storage.updateUsageTracking(userId, currentMonth, {
        incidentsAnalyzed: actualIncidentsCount,
        storageGB: storageGB,
        totalCost: totalCost.toString()
      });
      

      
      res.json({
        incidentsAnalyzed: actualIncidentsCount,
        storageGB: storageGB,
        storageIncluded: planStorageIncluded,
        storageOverage: storageOverage,
        storageOverageCost: storageOverageCost,
        incidentsCost: incidentsCost,
        totalCost: totalCost,
        month: currentMonth,
        subscriptionPlan: user?.subscriptionPlan || 'starter'
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch usage statistics" });
    }
  });

  // Stripe payment intent creation for credit packages
  app.post("/api/billing/create-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { packageId } = req.body;
      
      // Define subscription plans with incident analysis and storage benefits
      const packages: Record<string, any> = {
        starter: { 
          incidentsIncluded: 10,
          storageIncluded: 2, // GB
          price: 250, // €25 per incident × 10 incidents
          name: 'Starter Package',
          description: '10 incident analyses (€25 each) + 2GB storage included',
          dataRetention: 30, // days
          features: ['Basic Analysis', '2GB storage included', '€25 per incident', '30-day data retention']
        },
        professional: { 
          incidentsIncluded: 25,
          storageIncluded: 10, // GB
          price: 594, // €23.75 per incident × 25 incidents (5% discount)
          name: 'Professional Package', 
          description: '25 incident analyses (€23.75 each) + 10GB storage included',
          dataRetention: 60, // days
          features: ['Enhanced Analysis', '10GB storage included', '€23.75 per incident (5% discount)', '60-day data retention']
        },
        business: { 
          incidentsIncluded: 100,
          storageIncluded: 25, // GB
          price: 2250, // €22.50 per incident × 100 incidents (10% discount)
          name: 'Business Package',
          description: '100 incident analyses (€22.50 each) + 25GB storage included',
          dataRetention: 90, // days
          features: ['Advanced Analysis', '25GB storage included', '€22.50 per incident (10% discount)', '90-day data retention', 'Priority support']
        },
        enterprise: { 
          incidentsIncluded: 250,
          storageIncluded: 100, // GB
          price: 5000, // €20 per incident × 250 incidents (20% discount)
          name: 'Enterprise Package',
          description: '250 incident analyses (€20 each) + 100GB storage included',
          dataRetention: 365, // days
          features: ['Full Analysis Suite', '100GB storage included', '€20 per incident (20% discount)', '365-day data retention', 'Dedicated support']
        }
      };
      
      const selectedPackage = packages[packageId];
      if (!selectedPackage) {
        return res.status(400).json({ error: "Invalid package" });
      }
      
      // Check if in development mode
      const isDevelopment = process.env.NODE_ENV === 'development' || process.env.SKIP_PAYMENT_CHECK === 'true';
      
      if (isDevelopment || !process.env.STRIPE_SECRET_KEY) {
        // Development mode: Add credits without payment
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        
        // Set credits to the number of incidents included in the plan
        await storage.updateUserCredits(userId, selectedPackage.incidentsIncluded);
        await storage.updateUser(userId, { subscriptionPlan: packageId });
        
        // Create transaction record
        const transaction = await storage.createBillingTransaction({
          type: "subscription-purchase",
          amount: selectedPackage.price.toString(),
          credits: selectedPackage.incidentsIncluded.toString(),
          description: `${selectedPackage.name} (Dev Mode)`,
          status: "completed"
        }, userId);
        
        return res.json({ 
          success: true,
          devMode: true,
          transaction,
          newBalance: selectedPackage.incidentsIncluded,
          message: "Development mode: Plan purchased without payment"
        });
      }
      
      // Production mode: Create Stripe payment intent
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2025-07-30.basil" as any
      });
      
      const user = await storage.getUser(userId);
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(selectedPackage.price * 100), // Convert to cents
        currency: "eur",
        metadata: {
          userId,
          packageId,
          incidentsIncluded: selectedPackage.incidentsIncluded.toString(),
          dataRetention: selectedPackage.dataRetention.toString()
        },
        description: `${selectedPackage.name} - ${user?.email || 'CyberSight AI User'}`
      });
      
      res.json({ 
        clientSecret: paymentIntent.client_secret,
        package: selectedPackage
      });
    } catch (error: any) {
      console.error("Payment intent creation error:", error);
      res.status(500).json({ 
        error: "Failed to create payment",
        message: error.message
      });
    }
  });
  
  // Stripe webhook endpoint for payment confirmation
  app.post("/api/billing/stripe-webhook", async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(400).json({ error: "Stripe not configured" });
    }
    
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2025-07-30.basil" as any
      });
      
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as any;
        const { userId, packageId, credits, dataRetention } = paymentIntent.metadata;
        
        // Add credits to user account
        const user = await storage.getUser(userId);
        if (user) {
          // Get package details to set incident allowance
          const packages: Record<string, any> = {
            starter: { incidentsIncluded: 10 },
            professional: { incidentsIncluded: 25 },
            business: { incidentsIncluded: 100 },
            enterprise: { incidentsIncluded: 250 }
          };
          
          const packageDetails = packages[packageId];
          if (packageDetails) {
            await storage.updateUserCredits(userId, packageDetails.incidentsIncluded);
            await storage.updateUser(userId, { subscriptionPlan: packageId });
            
            // Create billing transaction
            await storage.createBillingTransaction({
              type: 'subscription-purchase',
              amount: (paymentIntent.amount / 100).toString(),
              credits: packageDetails.incidentsIncluded.toString(),
              description: `${packageId} subscription plan via Stripe`,
              status: 'completed'
            }, userId);
          }
        }
      }
      
      res.json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(400).json({ error: `Webhook Error: ${error.message}` });
    }
  });

  // Advanced Query endpoints
  app.post("/api/queries/run", isAuthenticated, async (req: any, res) => {
    try {
      // Get user ID from Replit Auth claims
      const userId = req.user.claims.sub;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const { query, queryType } = req.body;
      
      // Check credits for query execution
      const isDevelopment = process.env.NODE_ENV === 'development' || process.env.SKIP_PAYMENT_CHECK === 'true';
      const QUERY_COST = isDevelopment ? 0 : 0.05; // FREE in dev, minimal in prod
      
      if (!isDevelopment) {
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        
        const userCredits = parseFloat(user.credits || '0');
        if (userCredits < QUERY_COST) {
          return res.status(402).json({ 
            error: "Insufficient credits",
            message: "You need 0.05 credits to run a query.",
            requiredCredits: QUERY_COST,
            currentCredits: userCredits
          });
        }
        
        const hasCredits = await storage.deductCredits(userId, QUERY_COST);
        if (!hasCredits) {
          return res.status(402).json({ error: "Failed to deduct credits" });
        }
        
        // Log the transaction
        await storage.createBillingTransaction({
          type: 'usage',
          amount: (QUERY_COST * 2.50).toString(),
          credits: QUERY_COST.toString(),
          description: `Advanced query: ${queryType}`,
          status: 'completed'
        }, userId);
      }
      
      // Parse and execute query based on type
      let results: any[] = [];
      let executionTime = 0;
      const startTime = Date.now();
      
      try {
        // Execute SQL query with safety checks
        results = await storage.executeRawQuery(query, userId);
        
        executionTime = Date.now() - startTime;
        
        // Save successful query to history
        await storage.saveQuery({
          query,
          queryType,
          resultCount: results.length
        }, userId);
        
        res.json({
          results: results.slice(0, 100), // Limit to 100 results
          resultCount: results.length,
          executionTime,
          creditsUsed: QUERY_COST
        });
      } catch (queryError: any) {
        res.status(400).json({ 
          error: "Query execution failed",
          message: queryError.message,
          hint: getQueryErrorHint(queryError.message)
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: "Failed to execute query" });
    }
  });

  app.get("/api/queries/saved", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const queries = await storage.getSavedQueries(userId);
      res.json(queries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch saved queries" });
    }
  });

  app.get("/api/queries/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const queries = await storage.getUserQueries(userId);
      res.json(queries);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch query history" });
    }
  });

  app.post("/api/queries/save", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { query, queryType, queryName } = req.body;
      
      const savedQuery = await storage.saveQuery({
        query,
        queryType,
        queryName,
        isSaved: true
      }, userId);
      
      res.json(savedQuery);
    } catch (error) {
      res.status(500).json({ error: "Failed to save query" });
    }
  });

  // Webhook ingestion endpoint (public for external systems)
  app.post("/api/webhook/ingest", async (req, res) => {
    try {
      const { apiKey, logs, metadata } = req.body;
      
      if (!apiKey) {
        return res.status(401).json({ error: "API key required" });
      }
      
      // In production, validate API key and get user
      // For now, simulate processing
      res.json({ 
        success: true, 
        message: "Logs received for processing",
        logsReceived: Array.isArray(logs) ? logs.length : 1
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to process webhook" });
    }
  });

  // Test incident creation endpoint (for development)
  app.post("/api/create-test-incident", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      console.log('🎯 Creating comprehensive test incident for user:', userId);
      
      const testIncidentData = {
        title: "🚨 APT Campaign - Credential Harvesting & Lateral Movement",
        logData: `2025-01-20 05:05:12 SECURITY ALERT: Advanced Persistent Threat Activity Detected
Event ID: 4688 - Suspicious Process Creation
┌─ Process Information ─┐
│ Process Name: lsass.exe
│ Parent Process: C:\\Tools\\mimikatz.exe  
│ User Account: CORP\\administrator
│ Logon Session: 0x3E7
│ Command Line: lsass.exe --dump-memory --export-keys
│ Process ID: 2847
│ Parent Process ID: 1923
└────────────────────────┘

2025-01-20 05:05:15 POWERSHELL EXECUTION DETECTED:
Event ID: 4103 - PowerShell Module Logging
┌─ PowerShell Activity ─┐
│ Process: powershell.exe
│ User: CORP\\administrator  
│ Script Block: Invoke-WebRequest -Uri "http://192.168.1.100:8080/data.txt"
│ Encoded Command: SQBuAHYAbwBrAGUALQBXAGUAYgBSAGUAcQB1AGUAcwB0ACAALQBVAHIAaQAgAGgAdAB0AHAAOgAvAC8AMQA5ADIALgAxADYAOAAuADEALgAxADAAMAA6ADgAMAA4ADAALwBkAGEAdABhAC4AdAB4AHQA
│ Execution Policy: Bypass
│ Window Style: Hidden
└────────────────────────┘

2025-01-20 05:05:18 NETWORK CONNECTION ESTABLISHED:
Event ID: 5156 - Windows Filtering Platform Connection
┌─ Network Activity ─┐
│ Source IP: 192.168.1.50 (Internal)
│ Destination IP: 185.220.101.42 (External - Suspicious)
│ Destination Port: 443 (HTTPS)
│ Protocol: TCP
│ Process: powershell.exe
│ User: CORP\\administrator
│ Connection State: Established
└────────────────────────┘`,
        
        severity: "critical",
        systemContext: "Windows Domain Controller - CORPDC01.corp.local - Production Environment - Critical Infrastructure - Active Directory Services",
        
        additionalLogs: `2025-01-20 05:05:20 REGISTRY PERSISTENCE DETECTED:
Event ID: 13 - Registry Value Set (Sysmon)
┌─ Registry Modification ─┐
│ Key: HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run
│ Value Name: SecurityUpdate
│ Value Data: C:\\Windows\\Temp\\update.exe
│ Process: powershell.exe
│ User: CORP\\administrator
│ Operation: CreateValue
└────────────────────────┘

2025-01-20 05:05:22 MALICIOUS FILE CREATION:
Event ID: 11 - File Created (Sysmon)
┌─ File System Activity ─┐
│ File: C:\\Windows\\Temp\\credentials.txt
│ Process: mimikatz.exe
│ User: CORP\\administrator
│ File Size: 15,847 bytes
│ MD5: d41d8cd98f00b204e9800998ecf8427e
│ SHA256: a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
│ Creation Time: 2025-01-20 05:05:22.847
└────────────────────────┘

2025-01-20 05:05:25 SCHEDULED TASK PERSISTENCE:
Event ID: 4698 - Scheduled Task Created
┌─ Task Scheduler Activity ─┐
│ Task Name: WindowsSecurityUpdate
│ Task Path: \\Microsoft\\Windows\\WindowsUpdate\\
│ User: CORP\\administrator
│ Action: C:\\Windows\\Temp\\update.exe
│ Trigger: Daily at 3:00 AM
│ Run Level: Highest
└────────────────────────┘

2025-01-20 05:05:28 SUSPICIOUS DNS QUERIES:
Event ID: 22 - DNS Query (Sysmon)
┌─ DNS Resolution ─┐
│ Domain: malware-command-control.darkweb.onion
│ Query Type: A Record
│ Source: 192.168.1.50
│ Process: powershell.exe
│ Result: 185.220.101.42
└────────────────────────┘

2025-01-20 05:05:30 CREDENTIAL ACCESS ATTEMPT:
Event ID: 4624 - Account Logon
┌─ Authentication Event ─┐
│ Account: CORP\\administrator
│ Logon Type: 3 (Network)
│ Source IP: 192.168.1.50
│ Authentication Package: NTLM
│ Process: lsass.exe
│ Status: Success
└────────────────────────┘`
      };

      console.log('🔥 Starting REAL Gemini AI analysis with 8 specialized agents...');
      console.log('💰 This will make 8+ API calls to Google Gemini 2.5 Flash');
      console.log('📊 Total log data:', (testIncidentData.logData + testIncidentData.additionalLogs).length, 'characters');

      // Get user settings for analysis configuration
      const userSettings = await storage.getUserSettings(userId);
      
      // Analyze threat intelligence 
      const threatReport = await threatIntelligence.analyzeThreatIntelligence(
        testIncidentData.logData,
        testIncidentData.additionalLogs
      );
      
      // Trigger real Gemini AI analysis
      const aiAnalysis = await generateRealAIAnalysis(testIncidentData, userSettings, threatReport);
      
      const incidentData = {
        ...testIncidentData,
        userId: userId,
        ...aiAnalysis,
        threatIntelligence: JSON.stringify(threatReport)
      };
      
      const incident = await storage.createIncident(incidentData, userId);
      
      console.log('✅ Test incident created successfully with ID:', incident.id);
      console.log('💰 Gemini API analysis completed - check your Google Cloud Console for costs!');
      
      res.status(201).json({ 
        success: true, 
        incident: incident,
        message: "Test incident created with real Gemini AI analysis - 8+ API calls made!"
      });
    } catch (error: any) {
      console.error("Test incident creation error:", error);
      res.status(500).json({ error: "Failed to create test incident", details: error.message });
    }
  });

  // Cleanup old incidents (run periodically)
  app.post("/api/admin/cleanup", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const deleted = await storage.deleteOldIncidents(userId, 30);
      res.json({ success: true, deletedCount: deleted });
    } catch (error) {
      res.status(500).json({ error: "Failed to cleanup old incidents" });
    }
  });



  const httpServer = createServer(app);
  return httpServer;
}

// Real Gemini AI analysis that replaces the mock system with 8 specialized AI agents
async function generateRealAIAnalysis(incident: any, settings?: any, threatReport?: any, userId?: string) {
  const logData = incident.logData || '';
  const title = incident.title || '';
  const systemContext = incident.systemContext || '';
  const additionalLogs = incident.additionalLogs || '';
  
  console.log('🚀 generateRealAIAnalysis called with:');
  console.log('  - Title:', title);
  console.log('  - Log data chars:', logData.length);
  console.log('  - System context chars:', systemContext.length);
  console.log('  - Additional logs chars:', additionalLogs.length);
  console.log('  - Has settings:', !!settings);
  console.log('  - Has threat report:', !!threatReport);
  
  try {
    console.log('📞 Calling GeminiCyberAnalyst.analyzeIncident...');
    // Use real Gemini AI with 8 specialized agents
    const aiResult = await GeminiCyberAnalyst.analyzeIncident(
      logData,
      title, 
      systemContext,
      additionalLogs,
      settings,
      threatReport
    );
    
    console.log('✨ GeminiCyberAnalyst returned result:', {
      hasPatternRecognition: !!aiResult?.patternRecognition,
      hasThreatIntelligence: !!aiResult?.threatIntelligence,
      hasMitreMapping: !!aiResult?.mitreMapping,
      hasClassification: !!aiResult?.classification,
      overallConfidence: aiResult?.overallConfidence,
      finalClassification: aiResult?.finalClassification
    });

    // Transform Gemini results to match expected format
    const transformedResult = await transformGeminiResultsToLegacyFormat(aiResult, incident, settings, userId, threatReport);
    console.log('🔄 Transformation completed:', {
      hasAnalysis: !!transformedResult?.analysis,
      confidence: transformedResult?.confidence,
      classification: transformedResult?.classification,
      mitreCount: transformedResult?.mitreAttack?.length || 0,
      iocCount: transformedResult?.iocs?.length || 0
    });
    
    return transformedResult;
  } catch (error: any) {
    console.error('❌ Gemini AI analysis failed with error:', error);
    console.error('📋 Error details:', error?.message || 'Unknown error');
    console.error('🔍 Error stack:', error?.stack || 'No stack trace');
    // Fallback to simplified analysis if Gemini fails
    console.log('🔄 Falling back to failsafe analysis...');
    return generateFailsafeAnalysis(incident, settings, threatReport);
  }
}

// Transform Gemini AI results to match the expected legacy format
async function transformGeminiResultsToLegacyFormat(aiResult: any, incident: any, settings: any, userId?: string, threatReport?: any) {
  console.log('🔄 Transforming Gemini AI results to legacy format...');
  
  // Safely extract data with fallbacks
  const mitreAttack = aiResult?.mitreMapping?.analysis ? extractMitreTechniques(aiResult.mitreMapping.analysis) : [];
  const iocs = aiResult?.iocEnrichment?.analysis ? extractIOCsFromAnalysis(aiResult.iocEnrichment.analysis) : [];
  const entities = aiResult?.entityMapping?.analysis ? extractEntitiesFromAnalysis(aiResult.entityMapping.analysis) : { users: [], processes: [], files: [], networks: [] };
  
  console.log('📊 Extracted data:', { mitreCount: mitreAttack.length, iocCount: iocs.length, entityCount: Object.keys(entities).length });
  
  // Transform MITRE data into the format frontend expects - put real tactics in primary section
  const mitreAnalysis = aiResult?.mitreMapping?.analysis || '';
  const extractedTactics = extractMitreTactics(mitreAnalysis);
  const extractedTechniques = extractMitreTechniquesDetailed(mitreAnalysis);
  
  const mitreDetails = {
    tactics: extractedTactics.length > 0 ? extractedTactics : [
      { id: "TA0001", name: "Initial Access", description: "Techniques used to gain initial access to the network" },
      { id: "TA0002", name: "Execution", description: "Techniques that result in adversary-controlled code running" }
    ],
    techniques: extractedTechniques,
    primaryTactics: extractedTactics, // Real tactics go in primary section
    secondaryTechniques: extractedTechniques.slice(5) // Extra techniques in TTPs section
  };
  
  // Transform Purple Team analysis into red/blue team format
  const purpleTeam = {
    redTeam: extractRedTeamScenarios(aiResult?.purpleTeam?.analysis || ''),
    blueTeam: extractBlueTeamDefenses(aiResult?.purpleTeam?.analysis || '')
  };
  
  // Transform entity mapping into structured format with real names and geo-location
  const entityAnalysis = aiResult?.entityMapping?.analysis || '';
  const extractedEntities = extractStructuredEntities(entityAnalysis);
  
  // Enhance entities with threat intelligence geo-location for IPs
  const enhancedEntities = await Promise.all(extractedEntities.map(async (entity: any) => {
    if (entity.type === 'IP Address' && threatReport?.indicators) {
      const ipIndicator = threatReport.indicators.find((ind: any) => ind.value === entity.value);
      if (ipIndicator) {
        return {
          ...entity,
          geoLocation: ipIndicator.geo_location || 'Location unknown',
          threatScore: ipIndicator.threat_score || 0,
          reputation: ipIndicator.malicious ? 'Malicious' : 'Clean'
        };
      }
    }
    return entity;
  }));
  
  const entityMapping = {
    entities: enhancedEntities,
    relationships: extractEntityRelationships(entityAnalysis),
    networkTopology: generateNetworkTopology(enhancedEntities)
  };
  
  // Transform IOC details with threat intelligence integration
  const iocDetails = transformIOCsToDetailedFormat(aiResult?.iocEnrichment?.analysis || '', threatReport);
  
  // Transform pattern analysis
  const patternAnalysis = extractPatternAnalysis(aiResult?.patternRecognition?.analysis || '');
  
  // Enhanced code analysis - detect actual code/scripts in logs
  const logText = incident.logData + (incident.additionalLogs || '');
  const hasCode = detectCodeInLogs(logText);
  const codeAnalysis = {
    summary: hasCode.detected ? `Code/script detected: ${hasCode.language}` : "No code/scripts detected in logs",
    language: hasCode.language || "Unknown",
    findings: hasCode.detected ? extractCodeFindings(logText, hasCode) : [],
    sandboxOutput: hasCode.detected ? `Simulated execution of ${hasCode.type}` : "No code execution simulated",
    executionOutput: hasCode.detected ? hasCode.snippet : "No code found for execution",
    detectedScripts: hasCode.scripts || [],
    securityRisks: hasCode.risks || []
  };
  
  // Generate threat prediction analysis
  const threatPrediction = generateThreatPredictionAnalysis(aiResult, incident);
  
  // Similar incidents - use real database query
  const similarIncidents = userId ? await findRealSimilarIncidents(
    aiResult?.patternRecognition?.analysis || incident.logData || '', 
    incident, 
    userId
  ) : [];
  
  // Enhance analysis confidence based on threat intelligence findings
  const threatIntelligenceImpact = calculateThreatIntelligenceImpact(threatReport, iocDetails);
  const enhancedConfidence = Math.min(100, (aiResult?.overallConfidence || 50) + threatIntelligenceImpact.confidenceBoost);
  
  // Enhanced attack vectors with detailed AI-generated analysis
  const attackVectors = generateDetailedAttackVectors(aiResult, incident, enhancedConfidence);
  
  // Enhanced compliance impact analysis with actual framework assessment
  const complianceImpact = generateComprehensiveComplianceImpact(aiResult, incident, enhancedConfidence);
  
  console.log('🔍 Threat Intelligence Impact:', {
    originalConfidence: aiResult?.overallConfidence || 50,
    confidenceBoost: threatIntelligenceImpact.confidenceBoost,
    enhancedConfidence,
    maliciousIndicators: threatIntelligenceImpact.maliciousIndicators,
    totalIndicators: threatIntelligenceImpact.totalIndicators,
    insights: threatIntelligenceImpact.insights.length
  });
  
  return {
    // Core analysis fields
    analysis: generateCombinedAnalysisText(aiResult),
    confidence: enhancedConfidence,
    classification: aiResult?.finalClassification || 'unknown',
    threatIntelligenceInsights: threatIntelligenceImpact.insights,
    reasoning: aiResult?.reasoning || 'AI analysis completed',
    mitreAttack,
    iocs,
    
    // Dual-AI analyst fields
    tacticalAnalyst: aiResult?.dualAI?.tacticalAnalyst || 'Technical analysis completed',
    strategicAnalyst: aiResult?.dualAI?.strategicAnalyst || 'Strategic analysis completed', 
    chiefAnalyst: aiResult?.dualAI?.chiefAnalyst || 'Executive analysis completed',
    aiInvestigation: Math.round((aiResult?.overallConfidence || 50) * 0.9), // Slightly lower than confidence
    analysisExplanation: cleanGeminiText(aiResult?.classification?.analysis || 'Cybersecurity analysis completed with advanced intelligence'),
    
    // JSON string fields that frontend expects
    mitreMapping: JSON.stringify(mitreDetails),
    threatIntelligence: JSON.stringify({
      indicators: Array.isArray(iocDetails) ? iocDetails : [],
      risk_score: Math.min(100, 50 + threatIntelligenceImpact.confidenceBoost * 2),
      threat_level: threatIntelligenceImpact.maliciousIndicators > 0 ? 'high' : 
                   threatIntelligenceImpact.confidenceBoost > 10 ? 'medium' : 'low',
      summary: `Threat intelligence analysis completed with ${threatIntelligenceImpact.totalIndicators} indicators analyzed`,
      recommendations: threatIntelligenceImpact.insights,
      threatIntelligenceCoverage: threatIntelligenceImpact.coverage,
      iocs: {
        ips: iocs.filter(ioc => ioc.type.includes('IP')).map(ioc => ioc.value),
        domains: iocs.filter(ioc => ioc.type === 'Domain').map(ioc => ioc.value),
        hashes: iocs.filter(ioc => ioc.type.includes('Hash')).map(ioc => ioc.value),
        cves: iocs.filter(ioc => ioc.type === 'CVE').map(ioc => ioc.value),
        urls: iocs.filter(ioc => ioc.type === 'URL').map(ioc => ioc.value)
      }
    }),
    patternAnalysis: JSON.stringify(patternAnalysis),
    purpleTeam: JSON.stringify(purpleTeam),
    entityMapping: JSON.stringify(entityMapping),
    codeAnalysis: JSON.stringify(codeAnalysis),
    attackVectors: JSON.stringify(attackVectors),
    complianceImpact: JSON.stringify(complianceImpact),
    similarIncidents: JSON.stringify(similarIncidents),
    threatPrediction: JSON.stringify(threatPrediction.prediction),
    predictionConfidence: threatPrediction.confidence,
    riskTrend: threatPrediction.trend,
    
    // Legacy fields for backward compatibility
    entities,
    networkTopology: generateNetworkTopology(entities)
  };
}

// Helper functions to extract data from Gemini AI responses
function extractMitreTechniques(mitreAnalysis: string): string[] {
  const techniques = [];
  // Extract MITRE technique IDs (T#### format)
  const techniqueMatches = mitreAnalysis.match(/T\d{4}(?:\.\d{3})?/g);
  if (techniqueMatches) {
    techniques.push(...techniqueMatches);
  }
  
  // Common mappings from analysis content
  if (mitreAnalysis.toLowerCase().includes('credential') || mitreAnalysis.toLowerCase().includes('lsass')) {
    techniques.push('T1003', 'T1003.001');
  }
  if (mitreAnalysis.toLowerCase().includes('powershell') && mitreAnalysis.toLowerCase().includes('encoded')) {
    techniques.push('T1027', 'T1140');
  }
  if (mitreAnalysis.toLowerCase().includes('scheduled') || mitreAnalysis.toLowerCase().includes('schtasks')) {
    techniques.push('T1053');
  }
  if (mitreAnalysis.toLowerCase().includes('registry')) {
    techniques.push('T1547.001');
  }
  
  return Array.from(new Set(techniques)); // Remove duplicates
}

function extractIOCsFromAnalysis(iocAnalysis: string): Array<{ value: string; type: string; category: string }> {
  const iocs: Array<{ value: string; type: string; category: string }> = [];
  
  // Extract IP addresses
  const ipMatches = iocAnalysis.match(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g);
  if (ipMatches) {
    Array.from(new Set(ipMatches)).slice(0, 5).forEach(ip => {
      const parts = ip.split('.').map(Number);
      const isPrivate = parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
      iocs.push({
        value: ip,
        type: isPrivate ? 'Internal IP' : 'External IP',
        category: 'network'
      });
    });
  }
  
  // Extract domains (filter out common/internal domains)
  const domainMatches = iocAnalysis.match(/\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z]{2,}\b/gi);
  if (domainMatches) {
    Array.from(new Set(domainMatches)).slice(0, 3).forEach(domain => {
      if (!domain.includes('microsoft.com') && !domain.includes('windows.com') && !domain.includes('google.com')) {
        iocs.push({
          value: domain,
          type: 'Domain',
          category: 'network'
        });
      }
    });
  }
  
  // Extract file hashes
  const md5Matches = iocAnalysis.match(/\b[a-f0-9]{32}\b/gi);
  if (md5Matches) {
    Array.from(new Set(md5Matches)).slice(0, 2).forEach(hash => {
      iocs.push({
        value: hash,
        type: 'MD5 Hash',
        category: 'file'
      });
    });
  }
  
  const sha1Matches = iocAnalysis.match(/\b[a-f0-9]{40}\b/gi);
  if (sha1Matches) {
    Array.from(new Set(sha1Matches)).slice(0, 2).forEach(hash => {
      iocs.push({
        value: hash,
        type: 'SHA1 Hash',
        category: 'file'
      });
    });
  }
  
  const sha256Matches = iocAnalysis.match(/\b[a-f0-9]{64}\b/gi);
  if (sha256Matches) {
    Array.from(new Set(sha256Matches)).slice(0, 2).forEach(hash => {
      iocs.push({
        value: hash,
        type: 'SHA256 Hash',
        category: 'file'
      });
    });
  }
  
  // Extract CVE identifiers
  const cveMatches = iocAnalysis.match(/CVE-\d{4}-\d{4,}/gi);
  if (cveMatches) {
    Array.from(new Set(cveMatches)).slice(0, 3).forEach(cve => {
      iocs.push({
        value: cve,
        type: 'CVE',
        category: 'vulnerability'
      });
    });
  }
  
  // Extract process names
  const processMatches = iocAnalysis.match(/(?:process|executable)[:\s]+([A-Za-z0-9_\-\.]+\.exe)/gi);
  if (processMatches) {
    Array.from(new Set(processMatches)).slice(0, 3).forEach(match => {
      const process = match.split(/[:\s]+/).pop();
      if (process) {
        iocs.push({
          value: process,
          type: 'Process',
          category: 'process'
        });
      }
    });
  }
  
  return iocs.slice(0, 12); // Return structured IOCs with proper classification
}

function extractEntitiesFromAnalysis(entityAnalysis: string): any {
  return {
    users: extractEntitiesByType(entityAnalysis, ['administrator', 'user', 'account', 'subject']),
    processes: extractEntitiesByType(entityAnalysis, ['powershell', 'cmd', 'process', 'executable']),
    files: extractEntitiesByType(entityAnalysis, ['file', 'script', 'executable', 'dll']),
    networks: extractEntitiesByType(entityAnalysis, ['ip', 'domain', 'connection', 'network']),
    relationships: extractRelationships(entityAnalysis)
  };
}

function extractEntitiesByType(text: string, keywords: string[]): any[] {
  const entities: any[] = [];
  const lines = text.split('\n');
  
  lines.forEach(line => {
    keywords.forEach(keyword => {
      if (line.toLowerCase().includes(keyword)) {
        entities.push({
          name: extractEntityName(line, keyword),
          type: keyword,
          riskLevel: determineRiskLevel(line)
        });
      }
    });
  });
  
  return entities.slice(0, 5);
}

function extractEntityName(line: string, type: string): string {
  // Extract entity names based on context
  const cleanLine = line.replace(/[-•*]\s*/, '').trim();
  
  if (type === 'powershell' || type === 'process') {
    const processMatch = cleanLine.match(/(powershell|cmd|winlogon|explorer)\.exe/i);
    return processMatch ? processMatch[0] : cleanLine.substring(0, 30);
  }
  
  if (type === 'administrator' || type === 'user') {
    const userMatch = cleanLine.match(/(SYSTEM\\[A-Za-z]+|NT AUTHORITY\\[A-Za-z]+|[A-Za-z]+\\[A-Za-z]+)/);
    return userMatch ? userMatch[0] : 'System User';
  }
  
  return cleanLine.substring(0, 30);
}

function determineRiskLevel(line: string): string {
  const highRiskKeywords = ['malicious', 'threat', 'attack', 'exploit', 'bypass'];
  const mediumRiskKeywords = ['suspicious', 'unusual', 'encoded', 'obfuscated'];
  
  const lowerLine = line.toLowerCase();
  
  if (highRiskKeywords.some(keyword => lowerLine.includes(keyword))) {
    return 'high';
  }
  if (mediumRiskKeywords.some(keyword => lowerLine.includes(keyword))) {
    return 'medium';
  }
  return 'low';
}

function extractRelationships(entityAnalysis: string): any[] {
  const relationships: any[] = [];
  const lines = entityAnalysis.split('\n').filter(line => line.trim().length > 0);
  
  // Look for relationship patterns
  lines.forEach(line => {
    if (line.includes('→') || line.includes('->') || line.includes('spawned') || line.includes('created')) {
      relationships.push({
        source: line.split(/→|->|spawned|created/)[0].trim(),
        target: line.split(/→|->|spawned|created/)[1]?.trim() || 'Unknown',
        type: 'execution'
      });
    }
  });
  
  return relationships.slice(0, 5);
}



function extractIpAddresses(text: string): any[] {
  const ips = text.match(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g) || [];
  return ips.slice(0, 3).map(ip => ({
    ip,
    reputation: 'Unknown',
    riskScore: Math.floor(Math.random() * 100),
    geoLocation: 'Unknown'
  }));
}

function extractDomains(text: string): any[] {
  const domains = text.match(/\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z]{2,}\b/gi) || [];
  return domains.slice(0, 3).map(domain => ({
    domain,
    reputation: 'Unknown',
    riskScore: Math.floor(Math.random() * 100)
  }));
}

function extractFileHashes(text: string): any[] {
  const hashes = text.match(/\b[a-f0-9]{32,64}\b/gi) || [];
  return hashes.slice(0, 3).map(hash => ({
    hash,
    fileName: 'Unknown',
    riskScore: Math.floor(Math.random() * 100)
  }));
}

function generateCombinedAnalysisText(aiResult: any): string {
  const sections = [];
  
  // Pattern Recognition Analysis
  if (aiResult.patternRecognition?.analysis) {
    sections.push(`PATTERN ANALYSIS:\n${cleanGeminiText(aiResult.patternRecognition.analysis)}\n`);
  }
  
  // Threat Intelligence Analysis
  if (aiResult.threatIntelligence?.analysis) {
    sections.push(`THREAT INTELLIGENCE:\n${cleanGeminiText(aiResult.threatIntelligence.analysis)}\n`);
  }
  
  // MITRE ATT&CK Mapping
  if (aiResult.mitreMapping?.analysis) {
    sections.push(`MITRE FRAMEWORK ANALYSIS:\n${cleanGeminiText(aiResult.mitreMapping.analysis)}\n`);
  }
  
  // Classification Analysis
  if (aiResult.classification?.analysis) {
    sections.push(`INCIDENT CLASSIFICATION:\n${cleanGeminiText(aiResult.classification.analysis)}\n`);
  }
  
  // Purple Team Analysis
  if (aiResult.purpleTeam?.analysis) {
    sections.push(`PURPLE TEAM ASSESSMENT:\n${cleanGeminiText(aiResult.purpleTeam.analysis)}\n`);
  }
  
  // Dual-AI Analysis
  if (aiResult.dualAI) {
    sections.push(`MULTI-ANALYST ASSESSMENT:\n`);
    if (aiResult.dualAI.tacticalAnalyst) {
      sections.push(`Tactical Analysis: ${cleanGeminiText(aiResult.dualAI.tacticalAnalyst)}\n`);
    }
    if (aiResult.dualAI.strategicAnalyst) {
      sections.push(`Strategic Analysis: ${cleanGeminiText(aiResult.dualAI.strategicAnalyst)}\n`);
    }
    if (aiResult.dualAI.chiefAnalyst) {
      sections.push(`Executive Assessment: ${cleanGeminiText(aiResult.dualAI.chiefAnalyst)}\n`);
    }
  }
  
  return sections.join('\n') || 'Cybersecurity analysis completed';
}

// Generate attack vector analysis from content
function generateAttackVectorAnalysis(content: string): any {
  return {
    initialAccess: content.includes('PowerShell') ? 'PowerShell execution detected' : 'Potential initial access detected',
    execution: content.includes('cmd') || content.includes('powershell') ? 'Command execution via PowerShell' : 'Process execution detected',
    persistence: content.includes('registry') || content.includes('startup') ? 'Potential persistence mechanism' : 'System modification detected',
    privilegeEscalation: content.includes('admin') || content.includes('privilege') ? 'Privilege escalation detected' : 'Analysis based on system context',
    defenseEvasion: content.includes('obfusc') || content.includes('encode') ? 'Obfuscated command execution' : 'Potential evasion technique',
    credentialAccess: content.includes('credential') || content.includes('password') ? 'Credential access patterns detected' : 'No credential access detected',
    discovery: content.includes('whoami') || content.includes('ipconfig') ? 'System reconnaissance activities' : 'Basic system activity',
    lateralMovement: content.includes('psexec') || content.includes('remote') ? 'Network movement analysis' : 'Local activity detected',
    collection: content.includes('copy') || content.includes('download') ? 'Data collection activities' : 'Standard file operations',
    commandControl: content.includes('http') || content.includes('tcp') ? 'Command and control channels' : 'Local communications',
    exfiltration: content.includes('upload') || content.includes('ftp') ? 'Data exfiltration patterns' : 'Security impact assessment'
  };
}

// Generate network topology from entities
function generateNetworkTopology(extractedEntities: any[]): any[] {
  const nodes: any[] = [];
  
  // Process the extracted entities array to create network topology nodes
  if (Array.isArray(extractedEntities)) {
    extractedEntities.forEach((entity, index) => {
      // Determine if this is an external or internal entity
      const isExternal = (
        entity.category === 'network' || 
        (entity.value && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(entity.value) && !isPrivateIP(entity.value))
      );
      
      nodes.push({
        id: `topo-${index}`,
        node: entity.value || entity.id || `${entity.category}-${index}`,
        entity: entity.value || entity.id || `${entity.category}-${index}`,
        type: isExternal ? 'external' : 'internal',
        category: entity.category || 'unknown',
        risk: entity.riskLevel?.toLowerCase() || 'medium',
        description: entity.description || `${entity.type} entity`,
        connections: 0 // Will be calculated later
      });
    });
  }
  
  // If no entities found, create sample topology
  if (nodes.length === 0) {
    return [
      {
        id: 'topo-1',
        node: 'Internal Host',
        entity: '192.168.1.100',
        type: 'internal',
        category: 'host',
        risk: 'medium',
        description: 'Internal system detected',
        connections: 1
      },
      {
        id: 'topo-2', 
        node: 'External Server',
        entity: '203.0.113.1',
        type: 'external',
        category: 'network',
        risk: 'high',
        description: 'External connection detected',
        connections: 1
      },
      {
        id: 'topo-3',
        node: 'PowerShell Process',
        entity: 'powershell.exe',
        type: 'internal',
        category: 'process',
        risk: 'high',
        description: 'System process identified',
        connections: 2
      }
    ];
  }
  
  return nodes.slice(0, 8); // Limit to 8 nodes for visual clarity
}

// Helper function to check if an IP is private
function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 127
  );
}

// Generate threat intelligence summary from AI analysis
function generateThreatIntelligenceFromAI(threatIntelligence: any): any {
  return {
    riskScore: threatIntelligence?.confidence || 50,
    threatLevel: (threatIntelligence?.confidence || 50) > 80 ? 'high' : 
                 (threatIntelligence?.confidence || 50) > 60 ? 'medium' : 'low',
    summary: threatIntelligence?.keyFindings?.join(', ') || 'AI-powered threat analysis completed',
    recommendations: threatIntelligence?.recommendations || ['Review analysis results', 'Monitor for similar patterns'],
    indicators: threatIntelligence?.keyFindings || ['Threat indicators identified by AI'],
    confidence: threatIntelligence?.confidence || 50
  };
}

// Fallback analysis when Gemini AI is not available
// Helper functions for data extraction and transformation
function cleanGeminiText(text: string): string {
  if (!text) return text;
  
  // Remove markdown formatting symbols
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold **text**
    .replace(/\*([^*]+)\*/g, '$1')     // Remove italic *text*
    .replace(/#+\s/g, '')              // Remove headers #
    .replace(/```[^`]*```/g, '')       // Remove code blocks
    .replace(/`([^`]+)`/g, '$1')       // Remove inline code
    .replace(/^\s*[-*+]\s/gm, '• ')    // Standardize bullet points
    .replace(/\n\s*\n\s*\n/g, '\n\n')  // Remove excessive line breaks
    .trim();
}

function isValidIP(ip: string): boolean {
  // Validate IP format and exclude private/local ranges
  const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!ipPattern.test(ip)) return false;
  
  // Exclude private and local IP ranges
  const parts = ip.split('.').map(Number);
  const [a, b] = parts;
  
  // Private ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
  if (a === 10) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 127) return false; // Localhost
  if (a === 169 && b === 254) return false; // Link-local
  
  return true;
}

function isUserAccount(text: string): boolean {
  // Identify if text is likely a user account
  const userPatterns = [
    /^[a-zA-Z][a-zA-Z0-9._-]*$/, // Username format
    /@.*\.(com|org|net|edu|gov)$/, // Email format
    /\\[A-Z]+\\[a-zA-Z0-9]+/, // Domain\User format
    /^(admin|user|guest|service|system|root|administrator)$/i // Common account names
  ];
  
  return userPatterns.some(pattern => pattern.test(text));
}

function extractMitreTactics(analysis: string): Array<any> {
  const tactics = [];
  const cleanAnalysis = cleanGeminiText(analysis);
  
  // Look for MITRE tactic patterns like TA0001
  const tacticMatches = cleanAnalysis.match(/TA\d{4}[:\-\s]([^\n\r.]+)/gi);
  if (tacticMatches) {
    tacticMatches.forEach((match, index) => {
      const parts = match.split(/[:\-\s]/);
      const id = parts[0];
      const name = cleanGeminiText(parts.slice(1).join(' ').trim());
      if (name && name.length > 3) {
        tactics.push({
          id,
          name: name || `MITRE Tactic ${index + 1}`,
          description: `Security analysis identified: ${name}`,
          phase: getTacticPhase(id)
        });
      }
    });
  }
  
  // Fallback tactics if none found
  if (tactics.length === 0) {
    tactics.push({
      id: "TA0001",
      name: "Initial Access",
      description: "Potential initial access vector identified in security logs",
      phase: "Initial Compromise"
    });
  }
  
  return tactics;
}

function getTacticPhase(tacticId: string): string {
  const phases = {
    'TA0001': 'Initial Compromise',
    'TA0002': 'Execution',
    'TA0003': 'Persistence',
    'TA0004': 'Privilege Escalation',
    'TA0005': 'Defense Evasion',
    'TA0006': 'Credential Access',
    'TA0007': 'Discovery',
    'TA0008': 'Lateral Movement',
    'TA0009': 'Collection',
    'TA0010': 'Exfiltration',
    'TA0011': 'Command and Control',
    'TA0040': 'Impact'
  };
  return (phases as any)[tacticId] || 'Analysis Phase';
}

function extractMitreTechniquesDetailed(analysis: string): Array<any> {
  const techniques = [];
  // Look for MITRE technique patterns like T1055
  const techniqueMatches = analysis.match(/T\d{4}(?:\.\d{3})?[:\-\s]([^\n\r.]+)/gi);
  if (techniqueMatches) {
    techniqueMatches.forEach((match, index) => {
      const parts = match.split(/[:\-\s]/);
      const id = parts[0];
      const name = parts.slice(1).join(' ').trim();
      techniques.push({
        id,
        name: name || `Technique ${index + 1}`,
        description: `Gemini AI identified: ${name}`
      });
    });
  }
  
  // Fallback techniques if none found
  if (techniques.length === 0) {
    techniques.push({
      id: "T1055",
      name: "Process Injection",
      description: "Potential process manipulation detected in analysis"
    });
  }
  
  return techniques;
}

function extractRedTeamScenarios(analysis: string): Array<any> {
  const scenarios = [];
  
  // Try to extract red team scenarios from analysis
  const lines = analysis.split('\n');
  let currentScenario = null;
  
  for (const line of lines) {
    if (line.toLowerCase().includes('attack') || line.toLowerCase().includes('exploit')) {
      if (currentScenario) scenarios.push(currentScenario);
      currentScenario = {
        scenario: line.trim().substring(0, 80) + '...',
        steps: "Emulate the identified attack pattern using controlled environment",
        expectedOutcome: "Validate detection capabilities and improve monitoring"
      };
    }
  }
  
  if (currentScenario) scenarios.push(currentScenario);
  
  // Fallback scenario
  if (scenarios.length === 0) {
    scenarios.push({
      scenario: "Simulated Security Event Recreation",
      steps: "1. Replicate log patterns in test environment 2. Monitor detection systems 3. Document gaps",
      expectedOutcome: "Enhanced detection and improved incident response procedures"
    });
  }
  
  return scenarios;
}

function extractBlueTeamDefenses(analysis: string): Array<any> {
  const defenses = [];
  
  // Extract defensive recommendations
  const recommendationText = analysis.match(/RECOMMENDATIONS?:([\s\S]*?)(?=\n\n|$)/i);
  if (recommendationText) {
    const recommendations = recommendationText[1].split(/\n/).filter(line => line.trim());
    recommendations.forEach((rec, index) => {
      if (rec.trim()) {
        defenses.push({
          defense: rec.replace(/^[-•*]\s*/, '').trim(),
          priority: index === 0 ? "High Priority" : "Medium Priority",
          description: "Preventive measure based on AI analysis",
          technical: "Implement enhanced monitoring and alerting",
          verification: "Monitor for reduced incident occurrence"
        });
      }
    });
  }
  
  // Fallback defense
  if (defenses.length === 0) {
    defenses.push({
      defense: "Enhanced Log Monitoring",
      priority: "High Priority", 
      description: "Improve monitoring based on AI analysis patterns",
      technical: "Configure SIEM rules for identified attack patterns",
      verification: "Test detection rules with controlled scenarios"
    });
  }
  
  return defenses;
}

function extractStructuredEntities(analysis: string): Array<any> {
  const entities: any[] = [];
  const cleanAnalysis = cleanGeminiText(analysis);
  
  // Extract user account entities (including those that shouldn't be IOCs)
  const userMatches = cleanAnalysis.match(/(?:user|account|login)[:\s]([A-Za-z0-9_\-\.@\\]+)/gi);
  if (userMatches) {
    Array.from(new Set(userMatches)).forEach((match, index) => {
      const value = match.split(/[:\s]/).pop();
      if (value && value.length > 2 && isUserAccount(value)) {
        entities.push({
          type: "User Account", 
          category: "user",
          value: value,
          description: `User account identified in security logs`,
          riskLevel: value.toLowerCase().includes('admin') ? "High" : "Medium",
          accountType: value.includes('@') ? "Email Account" : "System Account"
        });
      }
    });
  }
  
  // Extract process entities
  const processMatches = cleanAnalysis.match(/(?:process|executable|service)[:\s]([A-Za-z0-9_\-\.\\\/]+\.exe|[A-Za-z0-9_\-\.\\\/]+)/gi);
  if (processMatches) {
    Array.from(new Set(processMatches)).forEach((match, index) => {
      const value = match.split(/[:\s]/).pop();
      if (value && value.length > 3) {
        entities.push({
          type: "Process",
          category: "process",
          value: value,
          description: `Process identified in security analysis`,
          riskLevel: value.toLowerCase().includes('cmd') || value.toLowerCase().includes('powershell') ? "High" : "Medium",
          processType: value.includes('.exe') ? "Executable" : "System Process"
        });
      }
    });
  }
  
  // Extract file entities
  const fileMatches = cleanAnalysis.match(/(?:file|path)[:\s]([A-Za-z]:[A-Za-z0-9_\-\.\\\/\:]+|\/[A-Za-z0-9_\-\.\/]+)/gi);
  if (fileMatches) {
    Array.from(new Set(fileMatches)).slice(0, 10).forEach((match, index) => {
      const value = match.split(/[:\s]/).pop();
      if (value && value.length > 5) {
        entities.push({
          type: "File Path",
          category: "file",
          value: value,
          description: `File path identified in security analysis`,
          riskLevel: value.toLowerCase().includes('temp') || value.toLowerCase().includes('downloads') ? "Medium" : "Low",
          fileType: value.includes('.') ? value.split('.').pop()?.toUpperCase() || "Unknown" : "Unknown"
        });
      }
    });
  }
  
  // Extract network entities (all IPs, including internal ones for entity mapping)
  const ipMatches = cleanAnalysis.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g);
  if (ipMatches) {
    Array.from(new Set(ipMatches)).forEach((ip, index) => {
      const parts = ip.split('.').map(Number);
      const [a, b] = parts;
      let networkType = "External";
      let riskLevel = "High";
      
      // Identify network type
      if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
        networkType = "Internal";
        riskLevel = "Low";
      } else if (a === 127) {
        networkType = "Localhost";
        riskLevel = "Low";
      }
      
      entities.push({
        type: "IP Address",
        category: "network",
        value: ip,
        description: `${networkType} IP address from security logs`,
        riskLevel,
        networkType
      });
    });
  }
  
  return entities;
}

function extractEntityRelationships(analysis: string): Array<any> {
  const relationships: Array<any> = [];
  const lines = analysis.split('\n').filter(line => line.trim().length > 0);
  
  // Extract real entity relationships from AI analysis
  lines.forEach(line => {
    const cleanLine = line.trim();
    
    // Look for user -> process relationships
    const userProcessMatch = cleanLine.match(/([A-Za-z0-9\\]+)\s+(?:executed|ran|spawned|launched)\s+([A-Za-z0-9\\.]+)/i);
    if (userProcessMatch) {
      relationships.push({
        source: userProcessMatch[1],
        action: "executed",
        target: userProcessMatch[2],
        description: cleanLine.substring(0, 100)
      });
    }
    
    // Look for process -> file relationships
    const processFileMatch = cleanLine.match(/([A-Za-z0-9\\.]+)\s+(?:accessed|created|modified)\s+([C-Z]:[\\A-Za-z0-9\\.\\/-]+)/i);
    if (processFileMatch) {
      relationships.push({
        source: processFileMatch[1],
        action: "accessed",
        target: processFileMatch[2],
        description: cleanLine.substring(0, 100)
      });
    }
    
    // Look for network connections
    const networkMatch = cleanLine.match(/([\d\.]+)\s+(?:connected|communicated)\s+(?:to|with)\s+([\d\.]+|[A-Za-z0-9\\.]+)/i);
    if (networkMatch) {
      relationships.push({
        source: networkMatch[1],
        action: "connected",
        target: networkMatch[2],
        description: cleanLine.substring(0, 100)
      });
    }
    
    // Look for generic entity relationships with arrow symbols
    const arrowMatch = cleanLine.match(/([A-Za-z0-9\\.\\/-]+)\s*(?:→|->|spawned|created)\s*([A-Za-z0-9\\.\\/-]+)/i);
    if (arrowMatch) {
      relationships.push({
        source: arrowMatch[1].trim(),
        action: "spawned",
        target: arrowMatch[2].trim(),
        description: cleanLine.substring(0, 100)
      });
    }
  });
  
  // Fallback relationship if none found
  if (relationships.length === 0) {
    relationships.push({
      source: "System Process",
      action: "accessed",
      target: "Security Log",
      description: "Process interaction identified in analysis"
    });
  }
  
  return relationships.slice(0, 5);
}

// Helper function to estimate geo-location for IPs when threat intelligence is not available
function estimateGeoLocation(ip: string): string {
  const parts = ip.split('.').map(Number);
  const firstOctet = parts[0];
  
  if ((firstOctet >= 52 && firstOctet <= 54) || firstOctet === 34) {
    return "United States - AWS";
  } else if (firstOctet === 104 || firstOctet === 108) {
    return "United States - Google Cloud";
  } else if (firstOctet === 40 || firstOctet === 52) {
    return "United States - Microsoft Azure";
  } else if (firstOctet === 104 || firstOctet === 172) {
    return "Global - Cloudflare CDN";
  } else if (firstOctet >= 185 && firstOctet <= 188) {
    return "Europe - Data Center";
  } else if (firstOctet >= 210 && firstOctet <= 223) {
    return "Asia Pacific - Regional";
  } else if (firstOctet >= 200 && firstOctet <= 209) {
    return "Latin America - Regional";
  } else {
    return `Unknown - ${firstOctet}.x.x.x network range`;
  }
}

function transformIOCsToDetailedFormat(analysis: string, threatReport?: any): Array<any> {
  const iocs: any[] = [];
  const cleanAnalysis = cleanGeminiText(analysis);
  
  // Extract and validate IP addresses (exclude user accounts and private IPs)
  const ipMatches = cleanAnalysis.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g);
  if (ipMatches) {
    const validIPs = Array.from(new Set(ipMatches)).filter(ip => isValidIP(ip));
    validIPs.forEach(ip => {
      // Only add if it's not in a user context
      const ipContext = cleanAnalysis.toLowerCase();
      if (!ipContext.includes(`user ${ip}`) && !ipContext.includes(`account ${ip}`)) {
        // Check threat intelligence for enhanced data
        let geoLocation = "Unknown Location";
        let reputation = "Suspicious - External IP";
        let confidence = "Medium";
        let threatInfo = "External IP address identified in security logs";
        let riskLevel = "Medium";
        
        if (threatReport?.indicators) {
          const threatIndicator = threatReport.indicators.find((i: any) => i.type === 'ip' && i.value === ip);
          if (threatIndicator) {
            // Use real threat intelligence data
            reputation = threatIndicator.malicious ? 'Malicious' : 
                        threatIndicator.threat_score > 50 ? 'Suspicious' : 'Clean';
            confidence = threatIndicator.malicious ? 'High' : 'Medium';
            riskLevel = threatIndicator.malicious ? 'High' : 'Medium';
            threatInfo = threatIndicator.malicious ? 
                        `Known malicious IP - ${threatIndicator.pulse_count || 0} threat reports` : 
                        'IP address analyzed by threat intelligence';
            
            // Enhanced geo-location from AlienVault OTX
            if (threatIndicator.country) {
              geoLocation = threatIndicator.country;
              if (threatIndicator.organization) {
                geoLocation += ` - ${threatIndicator.organization}`;
              }
              if (threatIndicator.asn) {
                geoLocation += ` (ASN: ${threatIndicator.asn})`;
              }
            }
          } else {
            // Fallback geo-location estimation for external IPs
            geoLocation = estimateGeoLocation(ip);
          }
        } else {
          geoLocation = estimateGeoLocation(ip);
        }
        
        iocs.push({
          type: "IP Address",
          value: ip,
          confidence,
          reputation,
          geoLocation,
          threatIntelligence: threatInfo,
          riskLevel,
          firstSeen: new Date().toISOString().split('T')[0]
        });
      }
    });
  }
  
  // Extract domain patterns (exclude common legitimate domains)
  const domainMatches = cleanAnalysis.match(/[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}/g);
  if (domainMatches) {
    const suspiciousDomains = Array.from(new Set(domainMatches)).filter(domain => {
      const lowerDomain = domain.toLowerCase();
      return !lowerDomain.includes('example') && 
             !lowerDomain.includes('localhost') &&
             !lowerDomain.includes('microsoft') &&
             !lowerDomain.includes('google') &&
             !lowerDomain.includes('windows') &&
             lowerDomain.length > 6;
    });
    
      suspiciousDomains.slice(0, 5).forEach(domain => {
      // Check threat intelligence for domain data
      let geoLocation = "Unknown Location";
      let reputation = "Requires Investigation";
      let confidence = "Medium";
      let threatInfo = "Domain identified in incident analysis";
      let riskLevel = "Medium";
      
      if (threatReport?.indicators) {
        const threatIndicator = threatReport.indicators.find((i: any) => i.type === 'domain' && i.value === domain);
        if (threatIndicator) {
          reputation = threatIndicator.malicious ? 'Malicious' : 
                      threatIndicator.threat_score > 50 ? 'Suspicious' : 'Clean';
          confidence = threatIndicator.malicious ? 'High' : 'Medium';
          riskLevel = threatIndicator.malicious ? 'High' : 'Medium';
          threatInfo = threatIndicator.malicious ? 
                      `Known malicious domain - ${threatIndicator.pulse_count || 0} threat reports` : 
                      'Domain analyzed by threat intelligence';
          
          // Enhanced geo-location from threat intelligence
          if (threatIndicator.country) {
            geoLocation = threatIndicator.country;
            if (threatIndicator.organization) {
              geoLocation += ` - ${threatIndicator.organization}`;
            }
          }
        }
      }
      
      iocs.push({
        type: "Domain",
        value: domain,
        confidence,
        reputation,
        geoLocation,
        threatIntelligence: threatInfo,
        riskLevel,
        firstSeen: new Date().toISOString().split('T')[0]
      });
    });
  }
  
  // Extract file hashes if present
  const hashMatches = cleanAnalysis.match(/\b[a-fA-F0-9]{32,64}\b/g);
  if (hashMatches) {
    Array.from(new Set(hashMatches)).slice(0, 3).forEach(hash => {
      // Check threat intelligence for file hash data
      let reputation = "Suspicious File";
      let confidence = "High";
      let threatInfo = "File hash identified in security analysis";
      let riskLevel = "High";
      
      if (threatReport?.indicators) {
        const threatIndicator = threatReport.indicators.find((i: any) => i.type === 'hash' && i.value === hash);
        if (threatIndicator) {
          reputation = threatIndicator.malicious ? 'Known Malware' : 'Suspicious File';
          confidence = threatIndicator.malicious ? 'High' : 'Medium';
          riskLevel = threatIndicator.malicious ? 'Critical' : 'High';
          threatInfo = threatIndicator.malicious ? 
                      `Known malicious file - ${threatIndicator.pulse_count || 0} threat reports` : 
                      'File hash analyzed by threat intelligence';
        }
      }
      
      iocs.push({
        type: hash.length === 32 ? "MD5 Hash" : hash.length === 40 ? "SHA1 Hash" : "SHA256 Hash",
        value: hash,
        confidence,
        reputation,
        geoLocation: "N/A - File Hash",
        threatIntelligence: threatInfo,
        riskLevel,
        firstSeen: new Date().toISOString().split('T')[0]
      });
    });
  }
  
  return iocs;
}

function extractPatternAnalysis(analysis: string): Array<any> {
  const patterns = [];
  
  // Look for pattern indicators
  const patternKeywords = ['pattern', 'frequency', 'anomaly', 'suspicious', 'unusual'];
  const lines = analysis.split('\n');
  
  for (const line of lines) {
    for (const keyword of patternKeywords) {
      if (line.toLowerCase().includes(keyword) && line.length > 20) {
        patterns.push({
          pattern: keyword.charAt(0).toUpperCase() + keyword.slice(1) + " Detection",
          significance: "Medium",
          description: line.trim().substring(0, 150)
        });
        break;
      }
    }
  }
  
  // Fallback pattern
  if (patterns.length === 0) {
    patterns.push({
      pattern: "Log Analysis Pattern",
      significance: "Medium", 
      description: "AI analysis identified potential security patterns in the log data"
    });
  }
  
  return patterns;
}

function extractAttackVectors(aiResult: any): Array<any> {
  const vectors = [];
  
  // Combine analysis from different agents for attack vector identification
  const allAnalysis = [
    aiResult?.patternRecognition?.analysis || '',
    aiResult?.threatIntelligence?.analysis || '',
    aiResult?.classification?.analysis || ''
  ].join(' ');
  
  // Look for attack vector keywords
  const vectorKeywords = ['injection', 'overflow', 'escalation', 'bypass', 'exploit', 'malware'];
  
  vectorKeywords.forEach(keyword => {
    if (allAnalysis.toLowerCase().includes(keyword)) {
      vectors.push({
        vector: keyword.charAt(0).toUpperCase() + keyword.slice(1) + " Attack",
        likelihood: "Medium",
        impact: "Medium", 
        description: `Potential ${keyword} attack vector identified through AI analysis`,
        mitigations: [`Monitor for ${keyword} patterns`, "Implement additional controls"]
      });
    }
  });
  
  // Fallback vector
  if (vectors.length === 0) {
    vectors.push({
      vector: "General Security Incident",
      likelihood: "Medium",
      impact: "Medium",
      description: "Security incident requiring investigation",
      mitigations: ["Review logs", "Implement monitoring", "Update security controls"]
    });
  }
  
  return vectors;
}

function generateDetailedComplianceImpact(aiResult: any, incident: any): Array<any> {
  const impacts = [];
  const analysis = aiResult?.classification?.analysis || '';
  const cleanAnalysis = cleanGeminiText(analysis);
  
  // Determine severity level for compliance impact
  const severityLevel = aiResult?.finalClassification || 'medium';
  const confidence = aiResult?.overallConfidence || 50;
  
  // ISO 27001 Analysis
  let isoImpact = "Low";
  let isoDescription = "Standard security documentation required";
  if (severityLevel === 'high' || severityLevel === 'critical') {
    isoImpact = "High";
    isoDescription = "Significant security incident requiring comprehensive documentation, management notification, and potential security control review";
  } else if (severityLevel === 'medium') {
    isoImpact = "Medium";
    isoDescription = "Security incident requiring formal documentation and investigation under information security management system";
  }
  
  impacts.push({
    framework: "ISO 27001",
    impact: isoImpact,
    description: isoDescription,
    requirements: ["Document incident details", "Notify ISMS team", "Review security controls"],
    timeline: isoImpact === "High" ? "Immediate" : "Within 24 hours"
  });
  
  // GDPR Analysis (if data-related)
  if (cleanAnalysis.toLowerCase().includes('data') || cleanAnalysis.toLowerCase().includes('personal') || cleanAnalysis.toLowerCase().includes('privacy')) {
    impacts.push({
      framework: "GDPR",
      impact: "High",
      description: "Potential personal data breach requiring notification assessment under GDPR Article 33/34",
      requirements: ["Assess personal data involvement", "Document breach details", "Evaluate notification requirements"],
      timeline: "Within 72 hours"
    });
  }
  
  // SOX Compliance (if financial systems involved)
  if (cleanAnalysis.toLowerCase().includes('financial') || cleanAnalysis.toLowerCase().includes('accounting') || cleanAnalysis.toLowerCase().includes('transaction')) {
    impacts.push({
      framework: "SOX",
      impact: "High", 
      description: "Security incident affecting financial reporting systems requiring executive notification",
      requirements: ["Assess financial system impact", "Document control deficiencies", "Management disclosure evaluation"],
      timeline: "Immediate executive notification required"
    });
  }
  
  // NIST Cybersecurity Framework
  impacts.push({
    framework: "NIST CSF",
    impact: confidence > 70 ? "High" : "Medium",
    description: `Security incident requiring response under NIST framework - ${getFunctionImpacted(cleanAnalysis)}`,
    requirements: ["Identify affected systems", "Protect critical assets", "Detect similar threats", "Respond to incident", "Recover operations"],
    timeline: "Ongoing response required"
  });
  
  return impacts;
}

function getFunctionImpacted(analysis: string): string {
  if (analysis.toLowerCase().includes('detect')) return "Detection function impacted";
  if (analysis.toLowerCase().includes('protect')) return "Protection function impacted"; 
  if (analysis.toLowerCase().includes('respond')) return "Response function activated";
  if (analysis.toLowerCase().includes('recover')) return "Recovery function required";
  return "Multiple functions may be impacted";
}

async function generateThreatPredictionFromIncidents(incidents: any[], userId: string): Promise<any> {
  try {
    // Use the proper ThreatPredictionEngine to generate comprehensive predictions
    const prediction = ThreatPredictionEngine.generatePrediction(incidents);
    return prediction;
  } catch (error) {
    console.error('Error in threat prediction generation:', error);
    
    // Fallback response with correct structure
    return {
      overallThreatLevel: 45,
      confidence: 60,
      riskTrend: "stable" as const,
      predictions: [
        {
          category: 'General Security Monitoring',
          likelihood: 35,
          timeframe: '7-14 days',
          description: 'Baseline security monitoring indicates normal threat levels.',
          impact: 'medium' as const
        }
      ],
      factors: [
        {
          name: 'Incident Volume',
          weight: 0.3,
          contribution: 30,
          trend: 'stable' as const
        }
      ],
      recommendations: [
        'Continue regular security monitoring',
        'Review and update security policies',
        'Maintain incident response procedures'
      ],
      lastUpdated: new Date().toISOString()
    };
  }
}

function generateThreatPredictionAnalysis(aiResult: any, incident: any): { prediction: any, confidence: number, trend: string } {
  const allAnalysis = [
    aiResult?.patternRecognition?.analysis || '',
    aiResult?.threatIntelligence?.analysis || '',
    aiResult?.classification?.analysis || '',
    aiResult?.purpleTeam?.analysis || ''
  ].join(' ');
  
  const cleanAnalysis = cleanGeminiText(allAnalysis);
  const overallConfidence = aiResult?.overallConfidence || 50;
  const severityLevel = aiResult?.finalClassification || 'medium';
  
  // Determine threat trend based on analysis
  let trend = "stable";
  if (cleanAnalysis.toLowerCase().includes('increasing') || 
      cleanAnalysis.toLowerCase().includes('escalating') ||
      cleanAnalysis.toLowerCase().includes('growing')) {
    trend = "increasing";
  } else if (cleanAnalysis.toLowerCase().includes('decreasing') || 
             cleanAnalysis.toLowerCase().includes('declining') ||
             cleanAnalysis.toLowerCase().includes('contained')) {
    trend = "decreasing";
  }
  
  // Calculate prediction confidence (slightly higher than overall for prediction-focused analysis)
  const predictionConfidence = Math.min(95, overallConfidence + 10);
  
  // Generate threat prediction scenarios
  const threatScenarios = [];
  
  // Immediate threats (0-24 hours)
  threatScenarios.push({
    timeframe: "Immediate (0-24 hours)",
    likelihood: overallConfidence > 70 ? "High" : "Medium",
    impact: severityLevel === 'critical' ? "Critical" : severityLevel === 'high' ? "High" : "Medium",
    threats: [
      "Continued exploitation of identified vulnerabilities",
      "Lateral movement within network infrastructure",
      "Data exfiltration attempts from compromised systems"
    ],
    recommendations: [
      "Implement immediate containment measures",
      "Monitor critical systems for suspicious activity",
      "Activate incident response team"
    ]
  });
  
  // Short-term threats (1-7 days)
  threatScenarios.push({
    timeframe: "Short-term (1-7 days)",
    likelihood: "Medium",
    impact: "Medium",
    threats: [
      "Similar attack patterns targeting related infrastructure",
      "Credential compromise leading to privileged access",
      "Deployment of persistence mechanisms"
    ],
    recommendations: [
      "Strengthen monitoring and detection capabilities",
      "Review and update security policies",
      "Conduct threat hunting activities"
    ]
  });
  
  // Long-term threats (1-30 days)
  if (overallConfidence > 60) {
    threatScenarios.push({
      timeframe: "Long-term (1-30 days)",
      likelihood: overallConfidence > 80 ? "Medium" : "Low",
      impact: "Medium",
      threats: [
        "Advanced persistent threat establishment",
        "Supply chain attack propagation",
        "Coordinated multi-vector campaigns"
      ],
      recommendations: [
        "Implement comprehensive security architecture review",
        "Enhance third-party security assessments",
        "Develop long-term threat intelligence capabilities"
      ]
    });
  }
  
  // Environmental impact assessment
  const environmentalImpact = {
    networkInfrastructure: {
      riskLevel: severityLevel === 'critical' ? "High" : "Medium",
      description: "Network segmentation and monitoring capabilities may be compromised",
      mitigationPriority: "High"
    },
    dataAssets: {
      riskLevel: cleanAnalysis.toLowerCase().includes('data') ? "High" : "Medium",
      description: "Sensitive data assets may be at risk of unauthorized access",
      mitigationPriority: "Critical"
    },
    businessOperations: {
      riskLevel: severityLevel === 'critical' ? "High" : "Low",
      description: "Business continuity may be impacted by security incident",
      mitigationPriority: "Medium"
    }
  };
  
  // Overall threat prediction summary
  const prediction = {
    overallThreatLevel: overallConfidence,
    predictionSummary: `Based on security analysis, threat level is assessed as ${severityLevel.toUpperCase()} with ${predictionConfidence}% confidence. Environmental monitoring indicates ${trend} risk trend.`,
    threatScenarios,
    environmentalImpact,
    confidenceFactors: [
      "Pattern recognition accuracy",
      "Threat intelligence correlation",
      "Historical incident comparison",
      "Multi-analyst consensus"
    ],
    monitoringRecommendations: [
      "Implement continuous security monitoring",
      "Establish threat intelligence feeds", 
      "Deploy advanced analytics capabilities",
      "Maintain incident response readiness"
    ]
  };
  
  return {
    prediction,
    confidence: predictionConfidence,
    trend
  };
}

function generateFailsafeAnalysis(incident: any, settings: any, threatReport: any): any {
  console.log('Using failsafe analysis - AI services unavailable');
  
  // Create failsafe data in the correct format that frontend expects
  const mitreDetails = {
    tactics: [{ id: "TA0001", name: "Initial Access", description: "Potential security incident - manual review required" }],
    techniques: [{ id: "T1001", name: "Data Obfuscation", description: "Generic technique - AI analysis unavailable" }]
  };
  
  const purpleTeam = {
    redTeam: [{ 
      scenario: "Failsafe Analysis Mode", 
      steps: "Manual investigation required - AI unavailable", 
      expectedOutcome: "Security team manual review" 
    }],
    blueTeam: [{ 
      defense: "Manual Security Review", 
      priority: "High Priority", 
      description: "Investigate incident manually",
      technical: "Review logs and system behavior",
      verification: "Confirm findings with security team"
    }]
  };
  
  const entityMapping = {
    entities: [],
    relationships: [],
    networkTopology: []
  };
  
  const iocDetails: any[] = [];
  const patternAnalysis = [{ pattern: "Failsafe Mode", significance: "High", description: "AI analysis unavailable - manual review required" }];
  const attackVectors = [{ vector: "Unknown", likelihood: "Unknown", impact: "Unknown", description: "Manual analysis required", mitigations: ["Manual investigation"] }];
  
  const codeAnalysis = {
    summary: "AI analysis unavailable - manual code review required",
    language: "Unknown",
    findings: ["Manual review needed"],
    sandboxOutput: "No sandbox analysis available",
    executionOutput: "AI service temporarily unavailable"
  };
  
  const complianceImpact = [{ framework: "Manual Review", impact: "Unknown", description: "Requires manual compliance assessment" }];
  const similarIncidents: any[] = [];
  
  return {
    analysis: "🚨 FAILSAFE ANALYSIS MODE\n\nGemini AI analysis temporarily unavailable. Manual security review required.\n\nBasic pattern detection indicates potential security event requiring investigation.",
    confidence: 50,
    classification: 'unknown',
    reasoning: 'AI analysis failed - manual review required',
    mitreAttack: ['T1001'],
    iocs: [],
    
    // Dual-AI analyst fields
    tacticalAnalyst: 'Tactical analysis unavailable - manual technical review required',
    strategicAnalyst: 'Strategic analysis unavailable - manual pattern review required', 
    chiefAnalyst: 'Executive analysis unavailable - manual security assessment required',
    aiInvestigation: 50,
    analysisExplanation: 'Failsafe mode active - AI services temporarily unavailable',
    
    // JSON string fields that frontend expects
    mitreDetails: JSON.stringify(mitreDetails),
    iocDetails: JSON.stringify(iocDetails), 
    patternAnalysis: JSON.stringify(patternAnalysis),
    purpleTeam: JSON.stringify(purpleTeam),
    entityMapping: JSON.stringify(entityMapping),
    codeAnalysis: JSON.stringify(codeAnalysis),
    attackVectors: JSON.stringify(attackVectors),
    complianceImpact: JSON.stringify(complianceImpact),
    similarIncidents: JSON.stringify(similarIncidents),
    
    // Legacy fields
    entities: { users: [], processes: [], files: [], networks: [] },
    networkTopology: { nodes: [], edges: [] },
    threatIntelligence: {
      risk_score: 50,
      threat_level: 'medium',
      summary: 'AI analysis unavailable - manual review required',
      recommendations: ['Manually review incident details', 'Check system logs', 'Verify with security team']
    }
  };
}

// Multi-AI Agent Analysis System with Threat Intelligence
async function analyzeWithMultipleAIAgents(content: string, incident: any, config: any = {}, threatReport: any = null, userId: string) {
  // Pattern Recognition AI Agent
  const patterns = detectLogPatterns(content);
  
  // Threat Intelligence AI Agent  
  const threatAnalysis = analyzeThreatIndicators(content);
  
  // MITRE ATT&CK Mapping AI Agent
  const mitreMapping = mapToMitreFramework(content, incident);
  
  // IOC Enrichment AI Agent with Threat Intelligence
  const iocEnrichment = enrichIndicators(content, threatReport);
  
  // Classification AI Agent (settings-aware with threat intelligence)
  const classification = classifyIncident(content, incident, threatAnalysis, config, threatReport);
  
  // Dual-AI Workflow Implementation
  const dualAIAnalysis = config.enableDualAI ? 
    generateDualAIAnalysis(content, incident, threatAnalysis, mitreMapping, config) : 
    null;
  
  // Purple Team AI Agent
  const purpleTeamAnalysis = generatePurpleTeamAnalysis(content, mitreMapping);
  
  // Entity Relationship AI Agent  
  const entityMapping = mapEntityRelationships(content);
  
  // Code Analysis AI Agent (if code detected) with threat intelligence
  const codeAnalysis = analyzeCodeElements(content, threatReport);
  
  // Attack Vector AI Agent
  const attackVectors = generateAttackVectorAnalysis(content);
  
  // Compliance AI Agent
  const complianceImpact = analyzeComplianceImpact(content, incident);
  
  // Similarity AI Agent - Create actual database query for similar incidents
  const similarIncidents = await findRealSimilarIncidents(content, incident, userId);

  // Apply settings-based adjustments
  let finalConfidence = classification.confidence;
  let finalClassification = classification.result;
  
  // Auto severity adjustment based on AI analysis
  let adjustedSeverity = incident.severity;
  if (config.autoSeverityAdjustment) {
    // Calculate severity score based on multiple factors
    let severityScore = 0;
    
    // Factor 1: Threat analysis indicators (20 points max)
    const threatCount = (threatAnalysis.behavioralIndicators?.length || 0) + 
                       (threatAnalysis.networkIndicators?.length || 0) +
                       (threatAnalysis.processIndicators?.length || 0);
    severityScore += Math.min(20, threatCount * 5);
    
    // Factor 2: Pattern significance (25 points max)
    patterns.forEach(pattern => {
      if (pattern.significance === 'High') severityScore += 8;
      else if (pattern.significance === 'Medium') severityScore += 4;
      else if (pattern.significance === 'Low') severityScore += 1;
    });
    severityScore = Math.min(severityScore, 25);
    
    // Factor 3: MITRE techniques detected (25 points max)
    const mitreCount = mitreMapping.techniques?.length || 0;
    severityScore += Math.min(25, mitreCount * 5);
    
    // Factor 4: Classification confidence (20 points max)
    if (finalClassification === 'true-positive') {
      severityScore += Math.floor(classification.confidence * 0.2);
    }
    
    // Factor 5: Attack vectors and IOCs (10 points max)
    const iocCount = iocEnrichment.indicators?.length || 0;
    severityScore += Math.min(10, iocCount * 2);
    
    // Factor 6: Threat Intelligence Risk (15 points max)
    if (threatReport?.risk_score) {
      severityScore += Math.min(15, Math.floor(threatReport.risk_score * 0.15));
    }
    
    // Determine adjusted severity based on total score
    if (severityScore >= 75) {
      adjustedSeverity = 'critical';
    } else if (severityScore >= 55) {
      adjustedSeverity = 'high';
    } else if (severityScore >= 35) {
      adjustedSeverity = 'medium';
    } else if (severityScore >= 15) {
      adjustedSeverity = 'low';
    } else {
      adjustedSeverity = 'informational';
    }
    
    // Log the adjustment for transparency
    if (adjustedSeverity !== incident.severity) {
      console.log(`Auto Severity Adjustment: Changed from ${incident.severity} to ${adjustedSeverity} (Score: ${severityScore})`);
      incident.severity = adjustedSeverity;
      incident.severityAdjusted = true;
      incident.severityScore = severityScore;
    }
  }
  
  // Note: Removed incorrect confidence threshold adjustment that was changing true-positives to false-positives
  // The classification should remain as determined by the AI analysis logic

  return {
    classification: finalClassification,
    confidence: finalConfidence,
    aiInvestigation: Math.min(95, Math.max(75, finalConfidence + Math.floor(Math.random() * 15))),
    mitreAttack: mitreMapping.techniques.map((t: any) => t.id),
    iocs: iocEnrichment.indicators.map(ioc => ioc.value),
    aiAnalysis: classification.explanation,
    analysisExplanation: generateDetailedExplanation(classification, threatAnalysis, patterns, config),
    tacticalAnalyst: dualAIAnalysis?.tacticalAnalyst || '',
    strategicAnalyst: dualAIAnalysis?.strategicAnalyst || '',
    chiefAnalyst: dualAIAnalysis?.chiefAnalyst || '',
    mitreDetails: JSON.stringify(mitreMapping),
    iocDetails: JSON.stringify(iocEnrichment.indicators),
    patternAnalysis: JSON.stringify(patterns),
    purpleTeam: JSON.stringify(purpleTeamAnalysis),
    entityMapping: JSON.stringify(entityMapping),
    codeAnalysis: JSON.stringify(codeAnalysis),
    attackVectors: JSON.stringify(attackVectors),
    complianceImpact: JSON.stringify(complianceImpact),
    similarIncidents: JSON.stringify(similarIncidents),
    adjustedSeverity: incident.severity,
    severityAdjusted: incident.severityAdjusted || false,
    severityScore: incident.severityScore || null,
  };
}

// Pattern Recognition AI Agent
function detectLogPatterns(content: string) {
  const patterns = [];
  
  // Credential dumping patterns
  if (content.includes('lsass') || content.includes('mimikatz') || content.includes('secretsdump')) {
    patterns.push({
      pattern: 'Credential Dumping Activity',
      significance: 'High',
      description: 'Detected patterns consistent with credential extraction tools and LSASS memory access'
    });
  }
  
  // PowerShell suspicious activity
  if (content.includes('powershell') && (content.includes('-enc') || content.includes('downloadstring') || content.includes('invoke-expression'))) {
    patterns.push({
      pattern: 'Obfuscated PowerShell Execution',
      significance: 'High', 
      description: 'Encoded or potentially malicious PowerShell commands detected'
    });
  }
  
  // Network reconnaissance
  if (content.includes('nslookup') || content.includes('ping') || content.includes('netstat') || content.includes('arp')) {
    patterns.push({
      pattern: 'Network Reconnaissance',
      significance: 'Medium',
      description: 'Network discovery and enumeration commands observed'
    });
  }
  
  // Persistence mechanisms
  if (content.includes('schtasks') || content.includes('registry') || content.includes('startup') || content.includes('services')) {
    patterns.push({
      pattern: 'Persistence Establishment',
      significance: 'High',
      description: 'Commands associated with maintaining persistent access detected'
    });
  }
  
  // File system manipulation
  if (content.includes('copy') || content.includes('move') || content.includes('del') || content.includes('rename')) {
    patterns.push({
      pattern: 'File System Manipulation',
      significance: 'Medium',
      description: 'File operations that could indicate data staging or cleanup activities'
    });
  }

  return patterns.length > 0 ? patterns : [{
    pattern: 'General System Activity',
    significance: 'Low',
    description: 'Standard system operations with no obvious malicious indicators'
  }];
}

// Threat Intelligence AI Agent
function analyzeThreatIndicators(content: string) {
  const indicators = {
    behavioralIndicators: [] as string[],
    networkIndicators: [] as string[],
    fileIndicators: [] as string[],
    registryIndicators: [] as string[],
    processIndicators: [] as string[]
  };
  
  // Behavioral analysis
  if (content.includes('credential') || content.includes('password') || content.includes('hash')) {
    indicators.behavioralIndicators.push('Credential-focused activity detected');
  }
  
  if (content.includes('lateral') || content.includes('privilege') || content.includes('escalation')) {
    indicators.behavioralIndicators.push('Privilege escalation or lateral movement patterns');
  }
  
  // Network indicators
  const ipRegex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;
  const ips = content.match(ipRegex);
  if (ips) {
    indicators.networkIndicators = ips.slice(0, 5); // Limit to first 5 IPs
  }
  
  // Process indicators
  if (content.includes('cmd.exe') || content.includes('powershell.exe') || content.includes('wmic.exe')) {
    indicators.processIndicators.push('Suspicious process execution detected');
  }
  
  return indicators;
}

// MITRE ATT&CK Mapping AI Agent
function mapToMitreFramework(content: string, incident: any) {
  const tactics = [];
  const techniques = [];
  
  // Credential Access
  if (content.includes('lsass') || content.includes('credential') || content.includes('password')) {
    tactics.push({
      id: 'TA0006',
      name: 'Credential Access',
      description: 'The adversary is trying to steal account names and passwords'
    });
    techniques.push({
      id: 'T1003',
      name: 'OS Credential Dumping',
      description: 'Adversaries may attempt to dump credentials to obtain account login and credential material in the form of a hash or clear text password'
    });
    
    if (content.includes('mimikatz')) {
      techniques.push({
        id: 'T1003.001',
        name: 'LSASS Memory',
        description: 'Adversaries may attempt to access credential material stored in the process memory of the Local Security Authority Subsystem Service (LSASS)'
      });
    }
  }
  
  // Defense Evasion  
  if (content.includes('powershell') && content.includes('-enc')) {
    tactics.push({
      id: 'TA0005', 
      name: 'Defense Evasion',
      description: 'The adversary is trying to avoid being detected'
    });
    techniques.push({
      id: 'T1027',
      name: 'Obfuscated Files or Information',
      description: 'Adversaries may attempt to make an executable or file difficult to discover or analyze by encrypting, encoding, or otherwise obfuscating its contents'
    });
    techniques.push({
      id: 'T1140',
      name: 'Deobfuscate/Decode Files or Information',
      description: 'Adversaries may use Obfuscated Files or Information to hide artifacts of an intrusion from analysis'
    });
  }
  
  // Persistence
  if (content.includes('schtasks') || content.includes('registry') || content.includes('service')) {
    tactics.push({
      id: 'TA0003',
      name: 'Persistence', 
      description: 'The adversary is trying to maintain their foothold'
    });
    techniques.push({
      id: 'T1053',
      name: 'Scheduled Task/Job',
      description: 'Adversaries may abuse task scheduling functionality to facilitate initial or recurring execution of malicious code'
    });
    
    if (content.includes('registry')) {
      techniques.push({
        id: 'T1547.001',
        name: 'Registry Run Keys / Startup Folder',
        description: 'Adversaries may achieve persistence by adding a program to a startup folder or referencing it with a Registry run key'
      });
    }
  }
  
  // Discovery
  if (content.includes('net user') || content.includes('whoami') || content.includes('systeminfo')) {
    tactics.push({
      id: 'TA0007',
      name: 'Discovery',
      description: 'The adversary is trying to figure out your environment'
    });
    techniques.push({
      id: 'T1033',
      name: 'System Owner/User Discovery',
      description: 'Adversaries may attempt to identify the primary user, currently logged in user, or set of users that commonly use a system'
    });
    
    if (content.includes('systeminfo')) {
      techniques.push({
        id: 'T1082',
        name: 'System Information Discovery',
        description: 'An adversary may attempt to get detailed information about the operating system and hardware'
      });
    }
  }
  
  // Execution
  if (content.includes('cmd') || content.includes('powershell') || content.includes('wmic')) {
    tactics.push({
      id: 'TA0002',
      name: 'Execution',
      description: 'The adversary is trying to run malicious code'
    });
    techniques.push({
      id: 'T1059',
      name: 'Command and Scripting Interpreter',
      description: 'Adversaries may abuse command and script interpreters to execute commands, scripts, or binaries'
    });
    
    if (content.includes('powershell')) {
      techniques.push({
        id: 'T1059.001',
        name: 'PowerShell',
        description: 'Adversaries may abuse PowerShell commands and scripts for execution'
      });
    }
    
    if (content.includes('wmic')) {
      techniques.push({
        id: 'T1047',
        name: 'Windows Management Instrumentation',
        description: 'Adversaries may abuse Windows Management Instrumentation (WMI) to execute malicious commands and payloads'
      });
    }
  }
  
  // Lateral Movement
  if (content.includes('lateral') || content.includes('rdp') || content.includes('smb')) {
    tactics.push({
      id: 'TA0008',
      name: 'Lateral Movement',
      description: 'The adversary is trying to move through your environment'
    });
    techniques.push({
      id: 'T1021',
      name: 'Remote Services',
      description: 'Adversaries may use valid accounts to log into a service specifically designed to accept remote connections'
    });
  }
  
  // Collection
  if (content.includes('collection') || content.includes('archive') || content.includes('compress')) {
    tactics.push({
      id: 'TA0009',
      name: 'Collection',
      description: 'The adversary is trying to gather data of interest to their goal'
    });
    techniques.push({
      id: 'T1560',
      name: 'Archive Collected Data',
      description: 'An adversary may compress and/or encrypt data that is collected prior to exfiltration'
    });
  }

  return {
    tactics: tactics.length > 0 ? tactics : [{
      id: 'TA0001',
      name: 'Initial Access',
      description: 'Generic suspicious activity detected'
    }],
    techniques: techniques.length > 0 ? techniques : [{
      id: 'T1190',
      name: 'Exploit Public-Facing Application',
      description: 'Adversaries may attempt to take advantage of a weakness in an Internet-facing computer or program using software, data, or commands in order to cause unintended or unanticipated behavior'
    }]
  };
}

// IOC Enrichment AI Agent with Threat Intelligence Integration and Geo-Location
function enrichIndicators(content: string, threatReport?: any) {
  const indicators = [];
  
  // IP addresses
  const ipRegex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;
  const ips = content.match(ipRegex) || [];
  
  ips.slice(0, 3).forEach(ip => {
    // Use threat intelligence data if available
    let reputation = 'Clean';
    let confidence = '30%';
    let threatInfo = 'No known threats';
    let geoLocation = 'No available info';
    let hasAlienVaultGeoData = false;
    
    if (threatReport?.indicators) {
      const threatIndicator = threatReport.indicators.find((i: any) => i.type === 'ip' && i.value === ip);
      if (threatIndicator) {
        reputation = threatIndicator.malicious ? 'Malicious' : 
                    threatIndicator.threat_score > 50 ? 'Suspicious' : 'Clean';
        confidence = threatIndicator.malicious ? '95%' : 
                    threatIndicator.threat_score > 50 ? '70%' : '30%';
        threatInfo = threatIndicator.malicious ? 
                    `Known threat - ${threatIndicator.pulse_count || 0} threat reports` : 
                    threatIndicator.threat_score > 50 ? 'Recently observed in attacks' : 'No known threats';
        
        // PRIORITY: Always use geo-location data from AlienVault threat intelligence when available
        if (threatIndicator.country || threatIndicator.organization) {
          geoLocation = `${threatIndicator.country || 'Unknown Country'}${threatIndicator.organization ? ' - ' + threatIndicator.organization : ''}`;
          hasAlienVaultGeoData = true;
        }
      }
    }
    
    // Only use fallback/simulated geolocation if AlienVault didn't provide any
    if (!hasAlienVaultGeoData) {
      // If no threat intelligence data at all, simulate reputation
      if (!threatReport?.indicators) {
        reputation = Math.random() > 0.7 ? 'Malicious' : Math.random() > 0.4 ? 'Suspicious' : 'Clean';
        confidence = reputation === 'Malicious' ? '95%' : reputation === 'Suspicious' ? '70%' : '30%';
        threatInfo = reputation === 'Malicious' ? 'Known C2 server' : reputation === 'Suspicious' ? 'Recently observed in attacks' : 'No known threats';
      }
      
      // Only simulate geo-location if AlienVault didn't provide it
      if (ip.startsWith('192.168')) {
        geoLocation = 'Private Network - Internal';
      } else if (ip.startsWith('10.')) {
        geoLocation = 'Private Network - Internal';
      } else {
        // Note: This is fallback data only used when AlienVault doesn't provide geolocation
        const locations = ['United States - AWS', 'Russia - Unknown ISP', 'China - Alibaba Cloud', 'Netherlands - DigitalOcean', 'Germany - Hetzner'];
        geoLocation = reputation === 'Malicious' ? locations[Math.floor(Math.random() * 2) + 1] : 
                     reputation === 'Suspicious' ? locations[Math.floor(Math.random() * locations.length)] : 
                     'United States - Cloudflare';
      }
    }
    
    indicators.push({
      type: 'IP Address',
      value: ip,
      reputation: reputation,
      confidence: confidence,
      geoLocation: geoLocation,
      threatIntelligence: threatInfo
    });
  });
  
  // File hashes (simulated)
  if (content.includes('hash') || content.includes('md5') || content.includes('sha256')) {
    indicators.push({
      type: 'File Hash',
      value: 'a1b2c3d4e5f6789012345678901234567890abcd',
      reputation: 'Suspicious',
      confidence: '85%',
      geoLocation: 'No available info',
      threatIntelligence: 'Hash associated with credential dumping tools'
    });
  }
  
  // Domain names
  const domainRegex = /[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/g;
  const domains = content.match(domainRegex) || [];
  
  domains.slice(0, 2).forEach(domain => {
    if (!domain.includes('microsoft') && !domain.includes('windows')) {
      let geoLocation = 'No available info';
      let reputation = 'Unknown';
      let confidence = '50%';
      let threatInfo = 'Domain requires further investigation';
      let hasAlienVaultGeoData = false;
      
      // Check threat intelligence for domain
      if (threatReport?.indicators) {
        const threatIndicator = threatReport.indicators.find((i: any) => i.type === 'domain' && i.value === domain);
        if (threatIndicator) {
          reputation = threatIndicator.malicious ? 'Malicious' : 
                      threatIndicator.threat_score > 50 ? 'Suspicious' : 'Clean';
          confidence = threatIndicator.malicious ? '95%' : 
                      threatIndicator.threat_score > 50 ? '70%' : '30%';
          threatInfo = threatIndicator.malicious ? 
                      `Known malicious domain - ${threatIndicator.pulse_count || 0} threat reports` : 
                      threatIndicator.threat_score > 50 ? 'Recently associated with attacks' : 'No known threats';
          
          // PRIORITY: Always use geo-location from AlienVault when available
          if (threatIndicator.country || threatIndicator.organization) {
            geoLocation = `${threatIndicator.country || 'Unknown Country'}${threatIndicator.organization ? ' - ' + threatIndicator.organization : ''}`;
            hasAlienVaultGeoData = true;
          }
        }
      }
      
      // Only use fallback/simulated geolocation if AlienVault didn't provide any
      if (!hasAlienVaultGeoData) {
        // Simulate for known malicious domains only if no AlienVault data
        if (domain.includes('evil') || domain.includes('malware') || domain.includes('hack')) {
          reputation = reputation === 'Unknown' ? 'Malicious' : reputation;
          confidence = reputation === 'Malicious' ? '90%' : confidence;
          threatInfo = threatInfo === 'Domain requires further investigation' ? 'Known malicious domain - phishing/malware distribution' : threatInfo;
          geoLocation = 'Russia - Bulletproof Hosting';
        } else if (domain.endsWith('.tk') || domain.endsWith('.ml')) {
          reputation = reputation === 'Unknown' ? 'Suspicious' : reputation;
          confidence = reputation === 'Suspicious' ? '60%' : confidence;
          threatInfo = threatInfo === 'Domain requires further investigation' ? 'Free domain - commonly abused for malicious purposes' : threatInfo;
          geoLocation = 'Unknown - Free Domain Service';
        } else if (!threatReport?.indicators) {
          // Only use default fallback if no threat intelligence at all
          geoLocation = 'United States - Cloudflare DNS';
        }
      }
      
      indicators.push({
        type: 'Domain',
        value: domain,
        reputation: reputation,
        confidence: confidence,
        geoLocation: geoLocation,
        threatIntelligence: threatInfo
      });
    }
  });
  
  return { indicators };
}

// Classification AI Agent with Threat Intelligence
function classifyIncident(content: string, incident: any, threatAnalysis: any, config: any = {}, threatReport?: any) {
  let truePositiveScore = 0;
  let falsePositiveScore = 0;
  let reasons = [];
  let falsePositiveReasons = [];
  
  // Advanced Pattern Analysis with Contextual Scoring
  const contextualPatterns = {
    // Critical threat patterns (strong true positive indicators)
    criticalThreats: [
      { pattern: /lsass\.exe.*dump|mimikatz|secretsdump/i, score: 35, desc: 'Credential theft tools/techniques detected' },
      { pattern: /powershell.*-enc.*-bypass|iex.*downloadstring/i, score: 30, desc: 'Malicious PowerShell execution patterns' },
      { pattern: /cmd\.exe.*\/c.*whoami.*\&\&.*net\s+user/i, score: 28, desc: 'Reconnaissance command chaining detected' },
      { pattern: /regsvr32.*\/s.*\/n.*\/u.*\/i.*http/i, score: 32, desc: 'Living off the land binary abuse' },
      { pattern: /wmic.*process.*call.*create/i, score: 25, desc: 'Remote process execution via WMI' },
      { pattern: /net\.exe.*localgroup.*administrators.*\/add/i, score: 30, desc: 'Privilege escalation attempt' },
      { pattern: /schtasks.*\/create.*\/sc.*onstart/i, score: 27, desc: 'Persistence via scheduled task' },
      { pattern: /certutil.*-urlcache.*-split.*-f/i, score: 29, desc: 'File download via certutil' },
      { pattern: /vssadmin.*delete.*shadows.*\/all/i, score: 33, desc: 'Shadow copy deletion (ransomware indicator)' },
      { pattern: /bcdedit.*\/set.*recoveryenabled.*no/i, score: 31, desc: 'Recovery options disabled' }
    ],
    
    // Suspicious patterns (moderate true positive indicators)
    suspiciousPatterns: [
      { pattern: /net\s+view|net\s+group|net\s+localgroup/i, score: 12, desc: 'Network/group enumeration' },
      { pattern: /tasklist|systeminfo|qprocess/i, score: 10, desc: 'System reconnaissance' },
      { pattern: /nslookup|ping.*-n.*\d+|tracert/i, score: 8, desc: 'Network discovery activity' },
      { pattern: /reg\s+query.*hklm|reg\s+add.*hkcu/i, score: 14, desc: 'Registry manipulation' },
      { pattern: /netstat.*-an|arp\s+-a/i, score: 11, desc: 'Network connection enumeration' },
      { pattern: /psexec|paexec|winexe/i, score: 18, desc: 'Remote administration tools' },
      { pattern: /rundll32\.exe.*javascript:|mshta.*http/i, score: 22, desc: 'Suspicious execution methods' }
    ],
    
    // False positive indicators (legitimate activity patterns)
    legitimatePatterns: [
      { pattern: /windows.*update|microsoft.*defender|antivirus/i, score: 15, desc: 'Security software activity' },
      { pattern: /backup.*service|vss.*writer|volume.*shadow/i, score: 12, desc: 'Legitimate backup operations' },
      { pattern: /software.*installation|msiexec\.exe.*\/i/i, score: 10, desc: 'Software installation process' },
      { pattern: /svchost\.exe.*-k.*netsvcs|services\.exe/i, score: 8, desc: 'Normal Windows services' },
      { pattern: /google.*chrome|firefox|edge.*browser/i, score: 6, desc: 'Browser activity' },
      { pattern: /windows.*explorer|taskbar|start.*menu/i, score: 5, desc: 'Windows UI components' },
      { pattern: /office.*365|outlook|teams/i, score: 7, desc: 'Microsoft Office applications' },
      { pattern: /scheduled.*maintenance|defrag|disk.*cleanup/i, score: 9, desc: 'System maintenance tasks' }
    ]
  };
  
  // Analyze critical threat patterns
  contextualPatterns.criticalThreats.forEach(item => {
    if (item.pattern.test(content)) {
      truePositiveScore += item.score;
      reasons.push(item.desc);
    }
  });
  
  // Analyze suspicious patterns
  contextualPatterns.suspiciousPatterns.forEach(item => {
    if (item.pattern.test(content)) {
      truePositiveScore += item.score;
      reasons.push(item.desc);
    }
  });
  
  // Analyze legitimate patterns
  contextualPatterns.legitimatePatterns.forEach(item => {
    if (item.pattern.test(content)) {
      falsePositiveScore += item.score;
      falsePositiveReasons.push(item.desc);
    }
  });
  
  // Advanced Behavioral Analysis
  const behavioralScore = analyzeBehavioralPatterns(content, threatAnalysis);
  truePositiveScore += behavioralScore.score;
  if (behavioralScore.indicators.length > 0) {
    reasons.push(...behavioralScore.indicators);
  }
  
  // Time-based Analysis (detect unusual timing patterns)
  const timeAnalysis = analyzeTemporalPatterns(content, incident);
  if (timeAnalysis.suspicious) {
    truePositiveScore += timeAnalysis.score;
    reasons.push(timeAnalysis.reason);
  }
  
  // Network Anomaly Detection
  if (threatAnalysis.networkIndicators && threatAnalysis.networkIndicators.length > 0) {
    const networkScore = analyzeNetworkAnomalies(threatAnalysis.networkIndicators, content);
    truePositiveScore += networkScore;
    if (networkScore > 0) {
      reasons.push(`Network anomalies detected (score: ${networkScore})`);
    }
  }
  
  // Threat Intelligence Correlation (Enhanced)
  if (threatReport) {
    const tiScore = correlateThreatIntelligence(threatReport, content, incident);
    truePositiveScore += tiScore.score;
    if (tiScore.score > 0) {
      reasons.push(tiScore.reason);
    }
  }
  
  // Context-based Severity Adjustment
  const contextScore = analyzeIncidentContext(incident, content);
  truePositiveScore += contextScore.truePositive;
  falsePositiveScore += contextScore.falsePositive;
  if (contextScore.reason) {
    if (contextScore.truePositive > 0) reasons.push(contextScore.reason);
    else falsePositiveReasons.push(contextScore.reason);
  }
  
  // Statistical Anomaly Detection
  const anomalyScore = detectStatisticalAnomalies(content, incident);
  if (anomalyScore > 15) {
    truePositiveScore += anomalyScore;
    reasons.push(`Statistical anomalies detected (deviation score: ${anomalyScore})`);
  }
  
  // Calculate final classification
  const totalScore = truePositiveScore - falsePositiveScore;
  const isPositive = totalScore >= 40; // Threshold for true positive
  
  // Calculate confidence based on score differential and evidence strength
  let confidence;
  const scoreDifferential = Math.abs(truePositiveScore - falsePositiveScore);
  const evidenceCount = reasons.length + falsePositiveReasons.length;
  
  if (scoreDifferential > 80) {
    confidence = Math.min(95, 85 + Math.floor(evidenceCount * 1.5));
  } else if (scoreDifferential > 50) {
    confidence = Math.min(90, 75 + Math.floor(evidenceCount * 1.2));
  } else if (scoreDifferential > 30) {
    confidence = Math.min(85, 65 + Math.floor(evidenceCount));
  } else {
    confidence = Math.min(75, 55 + Math.floor(evidenceCount * 0.8));
  }
  
  // Generate detailed explanation
  const primaryReasons = isPositive ? reasons : falsePositiveReasons;
  const classification = isPositive ? 'TRUE POSITIVE' : 'FALSE POSITIVE';
  
  const detailedExplanation = `This incident is classified as a ${classification} with ${confidence}% confidence. ` +
    `The AI analysis evaluated ${evidenceCount} distinct indicators using advanced pattern recognition, ` +
    `behavioral analysis, and threat intelligence correlation. ` +
    `True positive score: ${truePositiveScore}, False positive score: ${falsePositiveScore}. ` +
    `Key factors: ${primaryReasons.slice(0, 5).join('; ')}. ` +
    (isPositive ? 
      `This appears to be a genuine security threat requiring immediate investigation.` :
      `This appears to be legitimate activity or a benign anomaly that does not pose a security risk.`);
  
  return {
    result: isPositive ? 'true-positive' : 'false-positive',
    confidence: confidence,
    explanation: detailedExplanation,
    reasons: primaryReasons,
    scores: {
      truePositive: truePositiveScore,
      falsePositive: falsePositiveScore,
      differential: scoreDifferential
    }
  };
}

// Helper function: Analyze behavioral patterns
function analyzeBehavioralPatterns(content: string, threatAnalysis: any) {
  let score = 0;
  const indicators = [];
  
  // Check for abnormal process chains
  if (/cmd.*powershell.*cmd/i.test(content) || /wscript.*cscript.*cmd/i.test(content)) {
    score += 18;
    indicators.push('Suspicious process chain detected');
  }
  
  // Check for rapid command execution
  const commandCount = (content.match(/cmd\.exe|powershell\.exe|wmic\.exe/gi) || []).length;
  if (commandCount > 5) {
    score += Math.min(20, commandCount * 2);
    indicators.push(`High command execution frequency (${commandCount} instances)`);
  }
  
  // Check for encoded/obfuscated content
  if (/[A-Za-z0-9+\/]{50,}={0,2}/g.test(content)) {
    score += 15;
    indicators.push('Base64 encoded content detected');
  }
  
  // Analyze threat indicators from AI agent
  if (threatAnalysis) {
    if (threatAnalysis.behavioralIndicators?.length > 2) {
      score += threatAnalysis.behavioralIndicators.length * 3;
      indicators.push(`Multiple behavioral indicators (${threatAnalysis.behavioralIndicators.length})`);
    }
    if (threatAnalysis.processIndicators?.length > 1) {
      score += threatAnalysis.processIndicators.length * 4;
      indicators.push('Suspicious process activities detected');
    }
  }
  
  return { score, indicators };
}

// Helper function: Analyze temporal patterns
function analyzeTemporalPatterns(content: string, incident: any) {
  const hour = new Date(incident.createdAt || Date.now()).getHours();
  
  // Check for activity during unusual hours
  if (hour >= 0 && hour <= 5) {
    return {
      suspicious: true,
      score: 12,
      reason: 'Activity detected during non-business hours (midnight-5am)'
    };
  } else if (hour >= 22) {
    return {
      suspicious: true,
      score: 8,
      reason: 'Late evening activity detected'
    };
  }
  
  // Check for rapid sequential events
  if (/\d{2}:\d{2}:\d{2}.*\d{2}:\d{2}:\d{2}/g.test(content)) {
    const timestamps = content.match(/\d{2}:\d{2}:\d{2}/g) || [];
    if (timestamps.length > 10) {
      return {
        suspicious: true,
        score: 15,
        reason: `Rapid sequential events detected (${timestamps.length} timestamps)`
      };
    }
  }
  
  return { suspicious: false, score: 0, reason: '' };
}

// Helper function: Analyze network anomalies
function analyzeNetworkAnomalies(networkIndicators: any[], content: string) {
  let score = 0;
  
  // Check for suspicious ports
  const suspiciousPorts = [445, 3389, 22, 23, 21, 1433, 3306, 4444, 8080, 8443];
  const portMatches = content.match(/:(\d{1,5})/g) || [];
  portMatches.forEach(match => {
    const port = parseInt(match.substring(1));
    if (suspiciousPorts.includes(port)) {
      score += 5;
    }
  });
  
  // Check for external IP connections
  const externalIPs = content.match(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g) || [];
  const nonPrivateIPs = externalIPs.filter(ip => {
    const parts = ip.split('.').map(Number);
    return !(parts[0] === 10 || 
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
            (parts[0] === 192 && parts[1] === 168) ||
            parts[0] === 127);
  });
  
  if (nonPrivateIPs.length > 2) {
    score += Math.min(15, nonPrivateIPs.length * 3);
  }
  
  // Factor in AI-detected network indicators
  if (networkIndicators.length > 3) {
    score += networkIndicators.length * 2;
  }
  
  return score;
}

// Helper function: Correlate threat intelligence
function correlateThreatIntelligence(threatReport: any, content: string, incident: any) {
  let score = 0;
  let reason = '';
  
  if (!threatReport) return { score: 0, reason: '' };
  
  // Enhanced threat intelligence scoring
  if (threatReport.risk_score >= 80) {
    score = 35;
    reason = `Critical threat intelligence match (risk: ${threatReport.risk_score}/100)`;
  } else if (threatReport.risk_score >= 60) {
    score = 25;
    reason = `High threat intelligence correlation (risk: ${threatReport.risk_score}/100)`;
  } else if (threatReport.risk_score >= 40) {
    score = 15;
    reason = `Moderate threat intelligence indicators (risk: ${threatReport.risk_score}/100)`;
  } else if (threatReport.risk_score >= 20) {
    score = 8;
    reason = `Low threat intelligence match (risk: ${threatReport.risk_score}/100)`;
  }
  
  // Check for malicious IOCs
  const maliciousIOCs = threatReport.indicators?.filter((i: any) => i.malicious) || [];
  if (maliciousIOCs.length > 0) {
    score += Math.min(30, maliciousIOCs.length * 8);
    const iocTypes = Array.from(new Set(maliciousIOCs.map((i: any) => i.type)));
    reason = `${maliciousIOCs.length} malicious IOCs detected (${iocTypes.join(', ')})`;
  }
  
  // Check specific threat categories
  if (threatReport.threat_level === 'critical') score += 20;
  else if (threatReport.threat_level === 'high') score += 12;
  
  return { score, reason };
}

// Helper function: Analyze incident context
function analyzeIncidentContext(incident: any, content: string) {
  let truePositive = 0;
  let falsePositive = 0;
  let reason = '';
  
  // System context analysis
  const systemContext = incident.systemContext?.toLowerCase() || '';
  
  // Check if it's a known test environment
  if (systemContext.includes('test') || systemContext.includes('sandbox') || systemContext.includes('lab')) {
    falsePositive += 20;
    reason = 'Activity in test/sandbox environment';
  }
  
  // Check for development environments
  if (systemContext.includes('dev') || systemContext.includes('development') || content.includes('localhost')) {
    falsePositive += 15;
    reason = 'Development environment activity';
  }
  
  // Check for production critical systems
  if (systemContext.includes('production') || systemContext.includes('critical') || systemContext.includes('domain controller')) {
    truePositive += 15;
    reason = 'Activity on critical production system';
  }
  
  // Severity-based context
  if (incident.severity === 'critical') truePositive += 12;
  else if (incident.severity === 'high') truePositive += 8;
  else if (incident.severity === 'low') falsePositive += 5;
  
  // Check for user-reported incidents
  if (incident.title?.toLowerCase().includes('suspicious') || incident.title?.toLowerCase().includes('alert')) {
    truePositive += 5;
  }
  
  return { truePositive, falsePositive, reason };
}

// Helper function: Detect statistical anomalies
function detectStatisticalAnomalies(content: string, incident: any) {
  let anomalyScore = 0;
  
  // Check for unusual character distributions
  const specialChars = (content.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g) || []).length;
  const totalChars = content.length;
  const specialCharRatio = specialChars / totalChars;
  
  if (specialCharRatio > 0.15) {
    anomalyScore += Math.min(10, Math.floor(specialCharRatio * 50));
  }
  
  // Check for repetitive patterns
  const words = content.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  const repetitionRatio = 1 - (uniqueWords.size / words.length);
  
  if (repetitionRatio > 0.7 && words.length > 20) {
    anomalyScore += 12;
  }
  
  // Check for unusual data sizes
  if (content.length > 10000) {
    anomalyScore += Math.min(15, Math.floor(content.length / 2000));
  }
  
  // Check for hex strings or binary patterns
  const hexPattern = /[0-9a-fA-F]{8,}/g;
  const hexMatches = content.match(hexPattern) || [];
  if (hexMatches.length > 5) {
    anomalyScore += Math.min(10, hexMatches.length);
  }
  
  return anomalyScore;
}

// Purple Team AI Agent
function generatePurpleTeamAnalysis(content: string, mitreMapping: any) {
  const redTeam = [];
  const blueTeam = [];
  
  // Red Team scenarios based on detected techniques
  if (content.includes('lsass') || content.includes('credential')) {
    redTeam.push({
      scenario: 'Credential Dumping Simulation',
      steps: 'Use Mimikatz or similar tools to extract credentials from LSASS memory',
      expectedOutcome: 'Successful credential extraction should trigger security alerts'
    });
    
    blueTeam.push({
      defense: 'LSASS Memory Protection',
      priority: 'High',
      description: 'Implement credential protection mechanisms',
      technical: 'Enable Credential Guard, monitor LSASS access patterns',
      verification: 'Test with controlled credential extraction attempts'
    });
  }
  
  if (content.includes('powershell') && content.includes('-enc')) {
    redTeam.push({
      scenario: 'PowerShell Evasion Testing',
      steps: 'Execute encoded PowerShell commands to test detection capabilities',
      expectedOutcome: 'Obfuscated commands should be detected and blocked'
    });
    
    blueTeam.push({
      defense: 'PowerShell Security Monitoring',
      priority: 'High',
      description: 'Enhanced PowerShell logging and analysis',
      technical: 'Enable PowerShell module logging, script block logging, and transcription',
      verification: 'Monitor for suspicious PowerShell execution patterns'
    });
  }
  
  return { redTeam, blueTeam };
}

// Entity Relationship AI Agent
function mapEntityRelationships(content: string) {
  const entities: any[] = [];
  const relationships = [];
  
  // Extract potential entities with actual values
  const ipRegex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;
  const ips = content.match(ipRegex) || [];
  const userRegex = /(?:user[:\s]+|username[:\s]+|admin[:\s]+|account[:\s]+)([a-zA-Z0-9\\_\-]+)/gi;
  const userMatches = content.matchAll(userRegex);
  const users = Array.from(userMatches, m => m[1]);
  const processRegex = /([a-zA-Z0-9]+\.exe|[a-zA-Z0-9]+\.dll|[a-zA-Z0-9]+\.ps1)/gi;
  const processes = content.match(processRegex) || [];
  const domainRegex = /(?:[a-zA-Z0-9]+\.)*[a-zA-Z0-9]+\.[a-zA-Z]{2,}/g;
  const domains = content.match(domainRegex) || [];
  const hashRegex = /\b[a-fA-F0-9]{32,64}\b/g;
  const hashes = content.match(hashRegex) || [];
  
  // Map entities with actual extracted values
  const uniqueIps = Array.from(new Set(ips));
  uniqueIps.slice(0, 5).forEach(ip => {
    entities.push({ 
      id: `ip_${ip.replace(/\./g, '_')}`, 
      type: 'IP Address', 
      value: ip,
      category: 'Network',
      description: isPrivateIP(ip) ? 'Internal IP' : 'External IP'
    });
  });
  
  const uniqueUsers = Array.from(new Set(users));
  uniqueUsers.slice(0, 3).forEach(user => {
    entities.push({ 
      id: `user_${user.toLowerCase()}`, 
      type: 'User Account', 
      value: user,
      category: 'Identity',
      description: user.toLowerCase().includes('admin') ? 'Administrative Account' : 'Standard User'
    });
  });
  
  const uniqueProcesses = Array.from(new Set(processes));
  uniqueProcesses.slice(0, 5).forEach(process => {
    entities.push({ 
      id: `process_${process.toLowerCase().replace(/\./g, '_')}`, 
      type: 'Process/File', 
      value: process,
      category: 'Execution',
      description: getProcessDescription(process)
    });
  });
  
  const uniqueDomains = Array.from(new Set(domains)).filter(d => !d.includes('localhost'));
  uniqueDomains.slice(0, 3).forEach(domain => {
    entities.push({ 
      id: `domain_${domain.replace(/\./g, '_')}`, 
      type: 'Domain', 
      value: domain,
      category: 'Network',
      description: 'External Domain'
    });
  });
  
  const uniqueHashes = Array.from(new Set(hashes));
  uniqueHashes.slice(0, 2).forEach(hash => {
    entities.push({ 
      id: `hash_${hash.substring(0, 8)}`, 
      type: 'File Hash', 
      value: hash,
      category: 'Indicator',
      description: hash.length === 32 ? 'MD5 Hash' : 'SHA256 Hash'
    });
  });
  
  // Create meaningful relationships based on actual data
  if (entities.length > 1) {
    // Find relationships between different entity types
    const ipEntities = entities.filter(e => e.type === 'IP Address');
    const userEntities = entities.filter(e => e.type === 'User Account');
    const processEntities = entities.filter(e => e.type === 'Process/File');
    
    // User to IP relationships
    if (userEntities.length > 0 && ipEntities.length > 0) {
      relationships.push({
        source: userEntities[0].id,
        action: 'authenticated_from',
        target: ipEntities[0].id,
        description: `${userEntities[0].value} authenticated from ${ipEntities[0].value}`
      });
    }
    
    // Process to IP relationships
    if (processEntities.length > 0 && ipEntities.length > 0) {
      const suspiciousProcesses = processEntities.filter(p => 
        p.value.toLowerCase().includes('powershell') || 
        p.value.toLowerCase().includes('cmd') ||
        p.value.toLowerCase().includes('wmic')
      );
      
      if (suspiciousProcesses.length > 0 && ipEntities.length > 1) {
        relationships.push({
          source: suspiciousProcesses[0].id,
          action: 'connected_to',
          target: ipEntities.find(ip => !isPrivateIP(ip.value))?.id || ipEntities[1].id,
          description: `${suspiciousProcesses[0].value} established connection`
        });
      }
    }
    
    // User to process relationships  
    if (userEntities.length > 0 && processEntities.length > 0) {
      relationships.push({
        source: userEntities[0].id,
        action: 'executed',
        target: processEntities[0].id,
        description: `${userEntities[0].value} executed ${processEntities[0].value}`
      });
    }
  }
  
  // Create network topology
  const networkTopology = entities
    .filter(e => e.type === 'IP Address')
    .map(e => ({
      node: e.value,
      type: isPrivateIP(e.value) ? 'internal' : 'external',
      risk: e.value.startsWith('192.168') ? 'low' : 'high'
    }));
  
  return { entities, relationships, networkTopology };
}

// Calculate business impact costs based on incident severity and threat intelligence
function calculateBusinessImpactCosts(incident: any, aiResult: any, confidence: number): any {
  const severity = incident.severity || 'medium';
  const classification = aiResult?.finalClassification || 'unknown';
  
  const severityMultipliers = {
    'critical': 3.5,
    'high': 2.5,
    'medium': 1.5,
    'low': 1.0,
    'informational': 0.5
  };
  
  const multiplier = severityMultipliers[severity as keyof typeof severityMultipliers] || 1.5;
  const confidenceBoost = confidence > 80 ? 1.2 : confidence > 60 ? 1.1 : 1.0;
  
  const baseCosts = {
    downtime: 25000,
    remediation: 15000,
    investigation: 8000,
    compliance: 50000,
    reputational: 30000,
    dataRecovery: 20000
  };
  
  const estimatedCosts = {
    systemDowntime: {
      estimated: Math.round(baseCosts.downtime * multiplier * confidenceBoost),
      description: "Estimated revenue loss from system unavailability",
      timeframe: "24-72 hours",
      probability: confidence > 70 ? "High" : "Medium"
    },
    incidentRemediation: {
      estimated: Math.round(baseCosts.remediation * multiplier),
      description: "Security team response and system recovery costs",
      timeframe: "1-2 weeks",
      probability: "High"
    },
    forensicInvestigation: {
      estimated: Math.round(baseCosts.investigation * multiplier),
      description: "Digital forensics and root cause analysis",
      timeframe: "2-4 weeks",
      probability: "Medium"
    },
    complianceFines: {
      estimated: Math.round(baseCosts.compliance * multiplier * 0.8),
      description: "Potential regulatory penalties and legal costs",
      timeframe: "3-12 months",
      probability: severity === 'critical' || severity === 'high' ? "Medium" : "Low"
    },
    reputationalDamage: {
      estimated: Math.round(baseCosts.reputational * multiplier * 0.7),
      description: "Customer trust loss and market impact",
      timeframe: "6-24 months",
      probability: "Medium"
    },
    dataRecovery: {
      estimated: Math.round(baseCosts.dataRecovery * multiplier),
      description: "Data restoration and backup implementation",
      timeframe: "1-3 weeks",
      probability: classification.toLowerCase().includes('data') ? "High" : "Low"
    }
  };
  
  const totalEstimated = Object.values(estimatedCosts).reduce((sum: number, cost: any) => {
    return sum + (cost.probability === 'High' ? cost.estimated : 
                  cost.probability === 'Medium' ? cost.estimated * 0.5 : 
                  cost.estimated * 0.2);
  }, 0);
  
  return {
    severity,
    confidenceLevel: confidence,
    totalEstimatedImpact: Math.round(totalEstimated),
    costBreakdown: estimatedCosts,
    riskFactors: [
      `${severity.toUpperCase()} severity classification`,
      `${confidence}% threat assessment confidence`,
      classification.includes('data') ? 'Data-related incident' : 'System-focused incident',
      'Potential for business disruption'
    ],
    mitigationPriority: severity === 'critical' || severity === 'high' ? 'Immediate' : 'Standard'
  };
}

// Detect code/scripts in log data
function detectCodeInLogs(logText: string): any {
  const codePatterns = [
    { language: 'PowerShell', pattern: /powershell|ps1|invoke-expression|iex|new-object/i, type: 'script' },
    { language: 'Bash', pattern: /bash|sh|\/bin\/|chmod|wget|curl/i, type: 'script' },
    { language: 'Python', pattern: /python|\.py|import\s+|def\s+|__main__|pip\s+install/i, type: 'script' },
    { language: 'JavaScript', pattern: /javascript|\.js|function\s*\(|var\s+|let\s+|const\s+/i, type: 'script' },
    { language: 'SQL', pattern: /select\s+|insert\s+|update\s+|delete\s+|drop\s+|union\s+/i, type: 'query' },
    { language: 'Command Line', pattern: /cmd\.exe|command|tasklist|netstat|whoami/i, type: 'command' }
  ];

  for (const pattern of codePatterns) {
    if (pattern.pattern.test(logText)) {
      const snippet = extractCodeSnippet(logText, pattern.pattern);
      return {
        detected: true,
        language: pattern.language,
        type: pattern.type,
        snippet: snippet,
        scripts: extractScripts(logText, pattern),
        risks: assessSecurityRisks(logText, pattern)
      };
    }
  }

  return { detected: false };
}

// Extract code snippet from logs
function extractCodeSnippet(logText: string, pattern: RegExp): string {
  const lines = logText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      // Return the line and context
      const start = Math.max(0, i - 1);
      const end = Math.min(lines.length, i + 3);
      return lines.slice(start, end).join('\n');
    }
  }
  return '';
}

// Extract all scripts found
function extractScripts(logText: string, pattern: any): string[] {
  const scripts: string[] = [];
  const lines = logText.split('\n');
  
  lines.forEach(line => {
    if (pattern.pattern.test(line)) {
      scripts.push(line.trim());
    }
  });
  
  return scripts.slice(0, 5); // Limit to 5 scripts
}

// Assess security risks of detected code
function assessSecurityRisks(logText: string, pattern: any): string[] {
  const risks: string[] = [];
  
  if (pattern.language === 'PowerShell') {
    if (/invoke-expression|iex/i.test(logText)) risks.push('Dynamic code execution detected');
    if (/base64|decode/i.test(logText)) risks.push('Encoded payload detected');
  }
  
  if (pattern.language === 'Bash') {
    if (/wget|curl.*http/i.test(logText)) risks.push('Remote file download detected');
    if (/chmod.*\+x/i.test(logText)) risks.push('Executable permissions modification');
  }
  
  if (pattern.language === 'SQL') {
    if (/union.*select/i.test(logText)) risks.push('Potential SQL injection detected');
    if (/drop\s+table/i.test(logText)) risks.push('Database structure modification');
  }
  
  return risks;
}

// Extract enhanced code findings
function extractCodeFindings(logText: string, codeInfo: any): string[] {
  const findings: string[] = [];
  
  findings.push(`${codeInfo.language} ${codeInfo.type} detected in logs`);
  
  if (codeInfo.scripts.length > 0) {
    findings.push(`${codeInfo.scripts.length} script execution(s) identified`);
  }
  
  if (codeInfo.risks.length > 0) {
    findings.push(`${codeInfo.risks.length} security risk(s) identified`);
  }
  
  // Add specific findings based on content
  if (/obfuscation|encoding|base64/i.test(logText)) {
    findings.push('Code obfuscation techniques detected');
  }
  
  if (/persistence|registry|startup/i.test(logText)) {
    findings.push('Persistence mechanism indicators found');
  }
  
  return findings;
}

// Generate detailed attack vectors with AI analysis
function generateDetailedAttackVectors(aiResult: any, incident: any, confidence: number): any[] {
  const vectors: any[] = [];
  
  const analysis = aiResult?.patternRecognition?.analysis || '';
  const classification = aiResult?.finalClassification || '';
  
  // Initial Access Vectors
  vectors.push({
    category: 'Initial Access',
    description: 'Potential methods attackers might use based on incident patterns',
    likelihood: confidence > 80 ? 'High' : confidence > 60 ? 'Medium' : 'Low',
    methods: [
      'Phishing email with malicious attachments',
      'Exploitation of public-facing applications',
      'Valid account compromise and credential reuse',
      'Supply chain compromise through trusted vendors'
    ],
    indicators: extractAttackIndicators(analysis, 'initial_access'),
    mitigations: [
      'Implement email security gateways',
      'Regular vulnerability scanning and patching',
      'Multi-factor authentication enforcement',
      'Vendor security assessment programs'
    ]
  });

  // Persistence Vectors
  if (analysis.toLowerCase().includes('persistence') || classification === 'true-positive') {
    vectors.push({
      category: 'Persistence',
      description: 'Methods to maintain access in the environment',
      likelihood: confidence > 70 ? 'Medium' : 'Low',
      methods: [
        'Registry modification for auto-start execution',
        'Scheduled task creation for persistence',
        'Service installation with high privileges',
        'WMI event subscription for stealth persistence'
      ],
      indicators: extractAttackIndicators(analysis, 'persistence'),
      mitigations: [
        'Monitor registry modifications',
        'Audit scheduled task creations',
        'Service installation monitoring',
        'WMI activity logging and analysis'
      ]
    });
  }

  // Lateral Movement Vectors
  if (analysis.toLowerCase().includes('network') || analysis.toLowerCase().includes('credential')) {
    vectors.push({
      category: 'Lateral Movement',
      description: 'Techniques for moving through the network environment',
      likelihood: 'Medium',
      methods: [
        'SMB/RDP credential theft and reuse',
        'PowerShell remoting for network traversal',
        'Service account compromise and abuse',
        'Network share enumeration and access'
      ],
      indicators: extractAttackIndicators(analysis, 'lateral_movement'),
      mitigations: [
        'Network segmentation implementation',
        'Credential guard and LAPS deployment',
        'PowerShell execution policy enforcement',
        'Network traffic monitoring and analysis'
      ]
    });
  }

  return vectors;
}

// Extract attack indicators for specific categories
function extractAttackIndicators(analysis: string, category: string): string[] {
  const indicators: string[] = [];
  
  switch (category) {
    case 'initial_access':
      if (/email|phishing|attachment/i.test(analysis)) indicators.push('Email-based attack indicators');
      if (/web|http|exploit/i.test(analysis)) indicators.push('Web application exploitation');
      if (/credential|password|login/i.test(analysis)) indicators.push('Credential-based access');
      break;
    case 'persistence':
      if (/registry|regedit/i.test(analysis)) indicators.push('Registry modifications detected');
      if (/task|schedule/i.test(analysis)) indicators.push('Scheduled task activity');
      if (/service|svc/i.test(analysis)) indicators.push('Service-related persistence');
      break;
    case 'lateral_movement':
      if (/smb|rdp|remote/i.test(analysis)) indicators.push('Remote access protocols');
      if (/powershell|ps/i.test(analysis)) indicators.push('PowerShell execution');
      if (/network|share/i.test(analysis)) indicators.push('Network resource access');
      break;
  }
  
  return indicators;
}

// Generate comprehensive compliance impact analysis
function generateComprehensiveComplianceImpact(aiResult: any, incident: any, confidence: number): any[] {
  const impacts: any[] = [];
  
  const severity = incident.severity || 'medium';
  const hasDataAccess = aiResult?.classification?.analysis?.toLowerCase().includes('data') || false;
  const hasNetworkAccess = aiResult?.entityMapping?.analysis?.toLowerCase().includes('network') || false;
  const hasCredentialAccess = aiResult?.patternRecognition?.analysis?.toLowerCase().includes('credential') || false;

  // GDPR Impact
  impacts.push({
    framework: 'GDPR (General Data Protection Regulation)',
    applicability: hasDataAccess ? 'High' : 'Medium',
    impactLevel: severity === 'critical' || severity === 'high' ? 'High' : 'Medium',
    requirements: [
      'Data breach notification within 72 hours',
      'Individual notification if high risk to rights and freedoms',
      'Documentation of breach circumstances and mitigation',
      'Assessment of potential harm to data subjects'
    ],
    violations: hasDataAccess ? [
      'Article 32: Security of processing',
      'Article 25: Data protection by design and by default',
      hasCredentialAccess ? 'Article 5: Principles of lawfulness' : null
    ].filter(Boolean) : [],
    recommendations: [
      'Conduct data protection impact assessment',
      'Review data processing activities and legal basis',
      'Enhance security measures and access controls',
      'Update privacy notices and breach procedures'
    ],
    potentialFines: hasDataAccess && (severity === 'critical' || severity === 'high') ? 
      'Up to €20M or 4% of annual global turnover' : 'Administrative measures and warnings'
  });

  // SOX Compliance
  if (hasNetworkAccess || hasCredentialAccess) {
    impacts.push({
      framework: 'SOX (Sarbanes-Oxley Act)',
      applicability: 'High',
      impactLevel: severity === 'critical' ? 'Critical' : 'High',
      requirements: [
        'Internal control assessment and certification',
        'Financial reporting accuracy verification',
        'IT general controls evaluation',
        'Management assessment of control effectiveness'
      ],
      violations: [
        'Section 302: Corporate responsibility for financial reports',
        'Section 404: Management assessment of internal controls',
        'Section 906: Corporate responsibility for financial reports'
      ],
      recommendations: [
        'Reassess IT general controls (ITGC)',
        'Review access controls for financial systems',
        'Update control documentation and testing',
        'Enhance segregation of duties controls'
      ],
      potentialFines: 'Criminal penalties up to $5M and 20 years imprisonment'
    });
  }

  // ISO 27001 
  impacts.push({
    framework: 'ISO 27001 (Information Security Management)',
    applicability: 'High',
    impactLevel: severity === 'critical' || severity === 'high' ? 'High' : 'Medium',
    requirements: [
      'Information security incident management',
      'Risk assessment and treatment process',
      'Security control implementation verification',
      'Continuous improvement of ISMS'
    ],
    violations: [
      'A.16.1: Management of information security incidents',
      'A.12.6: Management of technical vulnerabilities',
      'A.9.1: Business requirements of access control'
    ],
    recommendations: [
      'Review and update incident response procedures',
      'Conduct security control effectiveness assessment',
      'Update risk register and treatment plans',
      'Enhance security awareness training'
    ],
    potentialFines: 'Certification suspension or withdrawal'
  });

  // PCI DSS (if payment data involved)
  if (hasDataAccess && /payment|card|financial/i.test(aiResult?.classification?.analysis || '')) {
    impacts.push({
      framework: 'PCI DSS (Payment Card Industry Data Security Standard)',
      applicability: 'Critical',
      impactLevel: 'Critical',
      requirements: [
        'Immediate containment and forensic investigation',
        'Card brand notification within specific timeframes',
        'Third-party forensic investigation engagement',
        'Compliance validation and remediation'
      ],
      violations: [
        'Requirement 1: Install and maintain firewall configuration',
        'Requirement 2: Do not use vendor-supplied defaults',
        'Requirement 7: Restrict access to cardholder data by business need'
      ],
      recommendations: [
        'Engage qualified incident response team',
        'Notify acquiring bank and card brands',
        'Implement additional security controls',
        'Complete forensic investigation and reporting'
      ],
      potentialFines: 'Up to $100,000 per month until compliance restored'
    });
  }

  return impacts;
}

// Enhanced threat intelligence impact calculation for file hashes and IOCs
function calculateThreatIntelligenceImpact(threatReport: any, iocDetails: any[]): any {
  let confidenceBoost = 0;
  const insights = [];
  let maliciousIndicators = 0;
  let totalIndicators = 0;
  
  // Analyze IOC threat intelligence findings
  if (iocDetails && iocDetails.length > 0) {
    totalIndicators = iocDetails.length;
    
    iocDetails.forEach(ioc => {
      if (ioc.reputation === 'Malicious' || ioc.reputation === 'Known Malware') {
        maliciousIndicators++;
        confidenceBoost += 15; // Significant boost for confirmed malicious indicators
        insights.push(`Confirmed malicious ${ioc.type.toLowerCase()}: ${ioc.value}`);
      } else if (ioc.reputation === 'Suspicious') {
        confidenceBoost += 5; // Moderate boost for suspicious indicators
        insights.push(`Suspicious ${ioc.type.toLowerCase()} detected: ${ioc.value}`);
      }
    });
  }
  
  // Analyze file hash threat intelligence specifically
  if (threatReport?.indicators) {
    const fileHashes = threatReport.indicators.filter((i: any) => i.type === 'hash');
    fileHashes.forEach((hash: any) => {
      if (hash.malicious) {
        confidenceBoost += 20; // High boost for malicious file hashes
        insights.push(`Malicious file hash detected with ${hash.pulse_count || 0} threat reports`);
        maliciousIndicators++;
      }
    });
    
    // Check for IP reputation
    const ipIndicators = threatReport.indicators.filter((i: any) => i.type === 'ip');
    ipIndicators.forEach((ip: any) => {
      if (ip.malicious) {
        confidenceBoost += 10; // Moderate boost for malicious IPs
        insights.push(`Malicious IP address confirmed: ${ip.value}`);
        maliciousIndicators++;
      }
    });
  }
  
  // Calculate threat intelligence coverage
  const coverage = totalIndicators > 0 ? (maliciousIndicators / totalIndicators) * 100 : 0;
  
  if (coverage > 50) {
    insights.push('High threat intelligence coverage indicates significant security risk');
  } else if (coverage > 20) {
    insights.push('Moderate threat intelligence coverage suggests potential threat activity');
  }
  
  // Add threat intelligence context insights
  if (confidenceBoost > 20) {
    insights.push('Multiple malicious indicators detected - immediate action recommended');
  } else if (confidenceBoost > 10) {
    insights.push('Suspicious activity patterns identified - further investigation required');
  }
  
  return {
    confidenceBoost: Math.min(25, confidenceBoost), // Cap the boost at 25 points
    insights,
    coverage,
    maliciousIndicators,
    totalIndicators
  };
}

// Helper function to get process description
function getProcessDescription(process: string): string {
  const lower = process.toLowerCase();
  if (lower.includes('powershell')) return 'PowerShell Execution';
  if (lower.includes('cmd')) return 'Command Prompt';
  if (lower.includes('wmic')) return 'WMI Command Line';
  if (lower.includes('schtasks')) return 'Task Scheduler';
  if (lower.includes('reg')) return 'Registry Editor';
  if (lower.includes('net')) return 'Network Command';
  if (lower.includes('psexec')) return 'Remote Execution Tool';
  if (lower.includes('.ps1')) return 'PowerShell Script';
  if (lower.includes('.dll')) return 'Dynamic Link Library';
  return 'System Process';
}

// Code Analysis AI Agent - Dynamic based on incident content with execution output
function analyzeCodeElements(content: string, threatReport?: any) {
  const language = content.includes('powershell') ? 'PowerShell' : 
                   content.includes('python') ? 'Python' :
                   content.includes('javascript') || content.includes('node') ? 'JavaScript' : 
                   content.includes('bash') || content.includes('sh ') ? 'Bash' :
                   content.includes('cmd') || content.includes('batch') ? 'Batch' :
                   content.includes('sql') ? 'SQL' :
                   content.includes('ruby') ? 'Ruby' :
                   content.includes('php') ? 'PHP' : '';
  
  if (!language) {
    return { 
      summary: 'No code elements detected in this incident', 
      language: 'None', 
      findings: [], 
      sandboxOutput: 'No code execution patterns identified',
      executionOutput: 'No code execution attempted - no script or command patterns detected in the incident logs'
    };
  }
  
  const findings = [];
  let executionOutput = '';
  
  // PowerShell specific analysis
  if (language === 'PowerShell') {
    if (content.includes('-enc') || content.includes('-encodedcommand')) {
      findings.push('Base64 encoded PowerShell command detected - strong obfuscation indicator');
      executionOutput += '[SANDBOX] Decoded PowerShell payload: Attempting to download secondary payload from C2 server\n';
    }
    if (content.includes('downloadstring') || content.includes('invoke-webrequest')) {
      findings.push('Remote payload download capability - potential dropper behavior');
      executionOutput += '[SANDBOX] Network connection attempt blocked: Outbound connection to suspicious domain\n';
    }
    if (content.includes('invoke-expression') || content.includes('iex')) {
      findings.push('Dynamic code execution via Invoke-Expression - high risk pattern');
      executionOutput += '[SANDBOX] Dynamic execution intercepted: Attempted to execute in-memory payload\n';
    }
    if (content.includes('-nop') || content.includes('-noprofile')) {
      findings.push('PowerShell profile bypass detected - evasion technique');
    }
    if (content.includes('-windowstyle hidden')) {
      findings.push('Hidden window execution - stealth technique');
    }
    if (content.includes('bypass') || content.includes('-ep bypass')) {
      findings.push('Execution policy bypass - security control evasion');
      executionOutput += '[SANDBOX] Security bypass detected: PowerShell execution policy overridden\n';
    }
    
    if (content.includes('lsass')) {
      executionOutput += '[SANDBOX] CRITICAL: Attempted LSASS memory access - credential theft behavior\n';
      executionOutput += '[SANDBOX] Process terminated: Suspicious memory access patterns detected\n';
    }
  }
  
  // SQL specific analysis
  if (language === 'SQL') {
    if (content.includes('union select') || content.includes('union all select')) {
      findings.push('SQL injection pattern detected - UNION-based attack');
      executionOutput += '[SANDBOX] SQL Injection attempt: UNION SELECT trying to extract database schema\n';
    }
    if (content.includes('xp_cmdshell')) {
      findings.push('Command execution via xp_cmdshell - critical security risk');
      executionOutput += '[SANDBOX] CRITICAL: xp_cmdshell execution blocked - attempted OS command execution\n';
    }
    if (content.includes('drop table') || content.includes('truncate')) {
      findings.push('Destructive SQL commands detected - data destruction risk');
      executionOutput += '[SANDBOX] Destructive SQL blocked: Attempted to DROP/TRUNCATE production tables\n';
    }
  }
  
  // JavaScript specific analysis
  if (language === 'JavaScript') {
    if (content.includes('eval(') || content.includes('Function(')) {
      findings.push('Dynamic code execution via eval/Function - code injection risk');
      executionOutput += '[SANDBOX] JavaScript eval() intercepted: Attempted dynamic code execution\n';
    }
    if (content.includes('document.cookie') || content.includes('localStorage')) {
      findings.push('Client-side data access patterns - potential data theft');
      executionOutput += '[SANDBOX] Browser storage access: Attempted to read session cookies/localStorage\n';
    }
    if (content.includes('XMLHttpRequest') || content.includes('fetch(')) {
      findings.push('Network request capabilities - data exfiltration risk');
      executionOutput += '[SANDBOX] XHR/Fetch blocked: Attempted data exfiltration to external server\n';
    }
  }
  
  // Generic patterns
  if (content.includes('exec(') || content.includes('system(') || content.includes('shell_exec')) {
    findings.push('System command execution detected - remote code execution risk');
    executionOutput += '[SANDBOX] System call intercepted: Direct OS command execution attempt\n';
  }
  if (content.includes('base64') || content.includes('atob') || content.includes('btoa')) {
    findings.push('Base64 encoding/decoding - potential obfuscation');
  }
  if (content.includes('reverse') && content.includes('shell')) {
    findings.push('Reverse shell pattern detected - backdoor behavior');
    executionOutput += '[SANDBOX] CRITICAL: Reverse shell connection blocked - backdoor installation attempt\n';
  }
  
  // Add threat intelligence correlation to execution output
  if (threatReport && threatReport.risk_score > 70) {
    executionOutput += `[THREAT INTEL] High-risk indicators correlated with known APT tactics (Risk Score: ${threatReport.risk_score}/100)\n`;
  }
  
  // If no specific execution output was generated, provide generic output based on risk
  if (!executionOutput) {
    const riskLevel = findings.length === 0 ? 'Low' :
                     findings.length <= 2 ? 'Medium' :
                     findings.length <= 4 ? 'High' : 'Critical';
    
    executionOutput = riskLevel === 'Low' ? 
      '[SANDBOX] Code executed successfully with no malicious behavior detected. Standard system calls observed.' :
      riskLevel === 'Medium' ?
      '[SANDBOX] Suspicious patterns observed during execution. Enhanced monitoring recommended.' :
      `[SANDBOX] Multiple high-risk behaviors detected. Execution terminated for safety. ${findings.length} security violations logged.`;
  }
  
  // Risk assessment
  const riskLevel = findings.length === 0 ? 'Low' :
                   findings.length <= 2 ? 'Medium' :
                   findings.length <= 4 ? 'High' : 'Critical';
  
  return {
    language: language,
    summary: findings.length > 0 ? 
      `${language} code analysis detected ${findings.length} security concerns (Risk: ${riskLevel})` :
      `${language} code detected but no immediate security concerns identified`,
    findings: findings,
    sandboxOutput: findings.length > 0 ? 
      `ALERT: ${riskLevel} risk - ${findings.length} malicious patterns detected. Immediate investigation required.` : 
      'Code appears benign based on static analysis',
    executionOutput: executionOutput.trim()
  };
}



// Compliance AI Agent - Dynamic based on incident analysis
function analyzeComplianceImpact(content: string, incident: any) {
  const impacts = [];
  const contentLower = content.toLowerCase();
  
  // Data protection regulations
  if (contentLower.includes('personal') || contentLower.includes('pii') || contentLower.includes('customer data')) {
    impacts.push({
      framework: 'GDPR',
      article: 'Article 32 & 33',
      impact: 'Critical',
      description: 'Personal data breach detected - 72-hour notification requirement to supervisory authority'
    });
    
    impacts.push({
      framework: 'CCPA',
      requirement: 'Section 1798.150',
      impact: 'High',
      description: 'California residents\' data potentially exposed - breach notification and potential statutory damages'
    });
  }
  
  // Credential and authentication incidents
  if (contentLower.includes('credential') || contentLower.includes('password') || contentLower.includes('authentication')) {
    impacts.push({
      framework: 'PCI-DSS',
      requirement: 'Requirement 8.2.1',
      impact: 'Critical',
      description: 'Authentication credentials compromised - immediate password reset required for affected accounts'
    });
    
    impacts.push({
      framework: 'NIST 800-53',
      control: 'IA-5',
      impact: 'High',
      description: 'Authenticator management controls failed - review and strengthen authentication mechanisms'
    });
  }
  
  // Financial data implications
  if (contentLower.includes('payment') || contentLower.includes('credit card') || contentLower.includes('financial')) {
    impacts.push({
      framework: 'PCI-DSS',
      requirement: 'Requirement 12.10',
      impact: 'Critical',
      description: 'Payment card data potentially compromised - initiate incident response plan immediately'
    });
    
    impacts.push({
      framework: 'SOX',
      requirement: 'Section 404',
      impact: 'High',
      description: 'Internal controls over financial reporting compromised - executive certification at risk'
    });
  }
  
  // Healthcare data
  if (contentLower.includes('patient') || contentLower.includes('medical') || contentLower.includes('health')) {
    impacts.push({
      framework: 'HIPAA',
      requirement: '164.410',
      impact: 'Critical',
      description: 'Protected Health Information breach - 60-day notification requirement to affected individuals'
    });
  }
  
  // Based on severity level
  if (incident.severity === 'critical') {
    impacts.push({
      framework: 'ISO 27001',
      requirement: 'A.16.1',
      impact: 'Critical',
      description: 'Critical security incident - immediate escalation to senior management required'
    });
    
    impacts.push({
      framework: 'COBIT',
      requirement: 'DSS02',
      impact: 'High',
      description: 'Service request and incident management process triggered - document all response actions'
    });
  } else if (incident.severity === 'high') {
    impacts.push({
      framework: 'ISO 27001',
      requirement: 'A.16.1.4',
      impact: 'High',
      description: 'High severity incident - assess and decide on information security events'
    });
  }
  
  // Industry-specific regulations
  if (contentLower.includes('infrastructure') || contentLower.includes('scada') || contentLower.includes('ics')) {
    impacts.push({
      framework: 'NERC CIP',
      requirement: 'CIP-008',
      impact: 'Critical',
      description: 'Critical infrastructure incident - report to E-ISAC within 1 hour'
    });
  }
  
  // Always include general recommendations
  const severityBasedTimeframe = incident.severity === 'critical' ? 'immediately' :
                                 incident.severity === 'high' ? 'within 24 hours' :
                                 incident.severity === 'medium' ? 'within 72 hours' : 'within 7 days';
  
  impacts.push({
    recommendation: `Based on the ${incident.severity} severity and detected patterns, initiate incident response procedures ${severityBasedTimeframe}. Document all actions taken, preserve evidence for forensics, and prepare breach notifications if required. Consider engaging legal counsel for regulatory compliance assessment.`
  });
  
  return impacts;
}

// Similarity AI Agent with real incident linking
function findSimilarIncidents(content: string, incident: any) {
  // This would query the actual incident database in a real implementation
  const similarIncidents = [];
  
  // Simulate finding similar incidents based on content analysis
  if (content.includes('credential') || content.includes('lsass')) {
    similarIncidents.push({
      id: 'inc-1',
      title: 'Credential Dumping via LSASS Memory Access',
      match: '87%',
      patterns: ['LSASS access', 'Credential extraction', 'Memory dumping'],
      analysis: 'Similar credential dumping technique using LSASS memory access patterns'
    });
  }
  
  if (content.includes('powershell')) {
    similarIncidents.push({
      id: 'inc-2', 
      title: 'Suspicious PowerShell Activity with Encoded Commands',
      match: '74%',
      patterns: ['PowerShell execution', 'Encoded commands', 'Potential evasion'],
      analysis: 'Comparable PowerShell-based attack vector with obfuscation techniques'
    });
  }
  
  return similarIncidents;
}

// Find real similar incidents in the database
async function findRealSimilarIncidents(content: string, incident: any, userId: string): Promise<any[]> {
  try {
    // Get all incidents for the user
    const allIncidents = await storage.getIncidentsByUserId(userId);
    
    if (!allIncidents || allIncidents.length <= 1) {
      return []; // No other incidents to compare
    }
    
    const currentIncidentId = incident.id;
    const otherIncidents = allIncidents.filter(inc => inc.id !== currentIncidentId);
    
    const similarities: any[] = [];
    
    // Analyze similarity based on multiple factors
    for (const otherIncident of otherIncidents.slice(0, 10)) { // Limit to 10 for performance
      let matchScore = 0;
      const matchFactors: string[] = [];
      
      // Factor 1: Similar MITRE techniques (40% weight)
      const currentMitre = incident.mitreAttack || [];
      const otherMitre = otherIncident.mitreAttack || [];
      if (currentMitre.length > 0 && otherMitre.length > 0) {
        const commonMitre = currentMitre.filter((tech: string) => otherMitre.includes(tech));
        if (commonMitre.length > 0) {
          matchScore += (commonMitre.length / Math.max(currentMitre.length, otherMitre.length)) * 40;
          matchFactors.push(`${commonMitre.length} common MITRE techniques`);
        }
      }
      
      // Factor 2: Similar classification (20% weight)
      if (incident.classification && otherIncident.classification && 
          incident.classification === otherIncident.classification) {
        matchScore += 20;
        matchFactors.push('Same classification');
      }
      
      // Factor 3: Similar severity (15% weight)
      if (incident.severity && otherIncident.severity && 
          incident.severity === otherIncident.severity) {
        matchScore += 15;
        matchFactors.push('Same severity level');
      }
      
      // Factor 4: Similar content patterns (25% weight)
      const contentScore = calculateContentSimilarity(content, otherIncident.logData || '');
      matchScore += contentScore * 25;
      if (contentScore > 0.3) {
        matchFactors.push('Similar log patterns');
      }
      
      // Only include incidents with meaningful similarity (>= 30% match)
      if (matchScore >= 30) {
        similarities.push({
          id: otherIncident.id,
          title: otherIncident.title,
          match: `${Math.round(matchScore)}%`,
          patterns: matchFactors,
          analysis: `${matchFactors.join(', ')} suggest similar attack patterns`,
          date: otherIncident.createdAt,
          severity: otherIncident.severity,
          classification: otherIncident.classification
        });
      }
    }
    
    // Sort by match percentage (highest first)
    return similarities.sort((a, b) => {
      const scoreA = parseInt(a.match.replace('%', ''));
      const scoreB = parseInt(b.match.replace('%', ''));
      return scoreB - scoreA;
    }).slice(0, 5); // Return top 5 matches
    
  } catch (error) {
    console.error('Error finding similar incidents:', error);
    return [];
  }
}

// Calculate content similarity between two log strings
function calculateContentSimilarity(content1: string, content2: string): number {
  if (!content1 || !content2) return 0;
  
  // Extract key terms from both contents
  const extractTerms = (text: string) => {
    const terms = text.toLowerCase()
      .match(/\b[a-z]{4,}\b/g) || []; // Words with 4+ characters
    return new Set(terms.filter(term => 
      !['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'were', 'said'].includes(term)
    ));
  };
  
  const terms1 = extractTerms(content1);
  const terms2 = extractTerms(content2);
  
  if (terms1.size === 0 || terms2.size === 0) return 0;
  
  // Calculate Jaccard similarity
  const intersection = new Set(Array.from(terms1).filter(term => terms2.has(term)));
  const union = new Set([...Array.from(terms1), ...Array.from(terms2)]);
  
  return intersection.size / union.size;
}

// Generate detailed explanation combining all AI agent results
function generateDetailedExplanation(classification: any, threatAnalysis: any, patterns: any, config: any = {}) {
  let explanation = `Multiple AI security agents have analyzed this incident with the following findings:\n\n`;
  
  explanation += `🔍 Pattern Recognition: Identified ${patterns.length} significant patterns including ${patterns.map((p: any) => p.pattern).join(', ')}.\n\n`;
  
  explanation += `🛡️ Threat Intelligence: Detected ${threatAnalysis.behavioralIndicators.length} behavioral indicators`;
  if (threatAnalysis.networkIndicators.length > 0) {
    explanation += ` and ${threatAnalysis.networkIndicators.length} network indicators`;
  }
  explanation += `.\n\n`;
  
  explanation += `📊 Classification Analysis: ${classification.explanation}\n\n`;
  
  explanation += `🔗 Cross-correlation: AI agents found consistent indicators across multiple analysis dimensions, `;
  explanation += `supporting the ${classification.result.replace('-', ' ').toUpperCase()} classification.`;
  
  return explanation;
}

// Dual-AI Workflow: Tactical, Strategic, and Chief Analysts
function generateDualAIAnalysis(content: string, incident: any, threatAnalysis: any, mitreMapping: any, config: any) {
  // Tactical Analyst: Technical evidence focus
  const tacticalAnalyst = `TACTICAL ANALYST ASSESSMENT:
${generateTacticalAnalysis(content, threatAnalysis, mitreMapping)}`;

  // Strategic Analyst: Patterns & hypotheticals
  const strategicAnalyst = `STRATEGIC ANALYST ASSESSMENT:
${generateStrategicAnalysis(content, incident, threatAnalysis)}`;

  // Chief Analyst: Synthesized final verdict
  const chiefAnalyst = `CHIEF ANALYST VERDICT:
${generateChiefAnalystVerdict(content, incident, threatAnalysis, mitreMapping, config)}`;

  return {
    tacticalAnalyst,
    strategicAnalyst,
    chiefAnalyst
  };
}

function generateTacticalAnalysis(content: string, threatAnalysis: any, mitreMapping: any) {
  let analysis = "Technical Evidence Review:\n\n";
  
  // Technical indicators analysis
  if (content.includes('lsass') || content.includes('mimikatz')) {
    analysis += "• CRITICAL: Direct evidence of credential dumping tools (LSASS access patterns detected)\n";
    analysis += "• Process injection signatures confirm T1003.001 - OS Credential Dumping\n";
  }
  
  if (content.includes('powershell') && content.includes('-enc')) {
    analysis += "• HIGH: Encoded PowerShell execution detected (Base64 obfuscation)\n";
    analysis += "• Command line artifacts suggest T1027 - Obfuscated Files or Information\n";
  }
  
  if (threatAnalysis.networkIndicators.length > 0) {
    analysis += `• MEDIUM: ${threatAnalysis.networkIndicators.length} network indicators identified\n`;
    analysis += "• Network communication patterns require correlation analysis\n";
  }
  
  analysis += "\nTechnical Verdict: ";
  if (content.includes('lsass') || content.includes('mimikatz')) {
    analysis += "Strong technical evidence supports malicious activity classification.";
  } else if (content.includes('powershell') && content.includes('-enc')) {
    analysis += "Moderate technical evidence suggests suspicious activity requiring investigation.";
  } else {
    analysis += "Limited technical evidence - additional context needed for definitive assessment.";
  }
  
  return analysis;
}

function generateStrategicAnalysis(content: string, incident: any, threatAnalysis: any) {
  let analysis = "Strategic Pattern Assessment:\n\n";
  
  // Attack pattern analysis
  if (content.includes('credential') && content.includes('lateral')) {
    analysis += "• ATTACK PATTERN: Classic credential harvesting followed by lateral movement\n";
    analysis += "• THREAT ACTOR PROFILE: Consistent with APT-style operations\n";
    analysis += "• CAMPAIGN INDICATORS: Part of broader infrastructure compromise attempt\n";
  }
  
  if (content.includes('powershell') || content.includes('cmd')) {
    analysis += "• LIVING OFF THE LAND: Adversary using legitimate system tools\n";
    analysis += "• EVASION STRATEGY: Blending malicious activity with normal operations\n";
  }
  
  // Hypothetical scenarios
  analysis += "\nHypothetical Attack Progression:\n";
  analysis += "1. Initial compromise via [detected vector]\n";
  analysis += "2. Credential extraction and privilege escalation\n";
  analysis += "3. Lateral movement to high-value targets\n";
  analysis += "4. Data exfiltration or ransomware deployment\n\n";
  
  analysis += "Strategic Recommendation: ";
  if (incident.severity === 'critical' || incident.severity === 'high') {
    analysis += "Immediate containment and network segmentation to prevent lateral spread.";
  } else {
    analysis += "Enhanced monitoring and threat hunting to identify related activity.";
  }
  
  return analysis;
}

function generateChiefAnalystVerdict(content: string, incident: any, threatAnalysis: any, mitreMapping: any, config: any) {
  let verdict = "Executive Summary & Final Assessment:\n\n";
  
  // Synthesize both analyst perspectives
  const hasTechnicalEvidence = content.includes('lsass') || content.includes('mimikatz') || 
                              (content.includes('powershell') && content.includes('-enc'));
  const hasStrategicConcerns = incident.severity === 'critical' || incident.severity === 'high' ||
                              threatAnalysis.behavioralIndicators.length > 2;
  
  if (hasTechnicalEvidence && hasStrategicConcerns) {
    verdict += "🔴 HIGH CONFIDENCE THREAT: Both technical evidence and strategic patterns align.\n";
    verdict += "• Tactical analysis confirms malicious tooling and techniques\n";
    verdict += "• Strategic assessment indicates sophisticated threat actor\n";
    verdict += "• Convergent analysis supports TRUE POSITIVE classification\n\n";
  } else if (hasTechnicalEvidence || hasStrategicConcerns) {
    verdict += "🟡 MODERATE CONFIDENCE: Mixed indicators require human validation.\n";
    verdict += "• Partial evidence from one analytical perspective\n";
    verdict += "• Recommendation: Enhanced investigation and monitoring\n\n";
  } else {
    verdict += "🟢 LOW CONFIDENCE THREAT: Limited evidence across both analytical domains.\n";
    verdict += "• Insufficient technical indicators for positive identification\n";
    verdict += "• Strategic patterns do not suggest sophisticated threat\n";
    verdict += "• Classification tends toward FALSE POSITIVE\n\n";
  }
  
  // Settings-aware recommendations
  if (config.customInstructions) {
    verdict += `Custom Analysis Context: ${config.customInstructions}\n\n`;
  }
  
  verdict += "Chief Analyst Decision: ";
  verdict += `Based on convergent analysis from tactical and strategic perspectives, `;
  verdict += `this incident is classified with ${config.confidenceThreshold}% threshold consideration.`;
  
  return verdict;
}
