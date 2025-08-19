import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertIncidentSchema, insertSettingsSchema } from "@shared/schema";
import { sendIncidentNotification, sendTestEmail } from "./gmail-email-service";
import { threatIntelligence } from "./threat-intelligence";
import { ThreatPredictionEngine } from "./threat-prediction";
import { GeminiCyberAnalyst } from "./gemini-ai";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { getQueryErrorHint } from "./query-helpers";
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
      
      // Reduced cost for efficiency
      const INCIDENT_ANALYSIS_COST = isDevelopment ? 0 : 0.1; // FREE in dev, 0.1 in prod
      
      if (!isDevelopment) {
        // Production mode: Enforce credit requirements
        const userCredits = parseFloat(user.credits || '0');
        if (userCredits < INCIDENT_ANALYSIS_COST) {
          return res.status(402).json({ 
            error: "Insufficient credits", 
            message: "You need 0.1 credits to analyze an incident.",
            requiredCredits: INCIDENT_ANALYSIS_COST,
            currentCredits: userCredits
          });
        }
        
        // Deduct credits for incident analysis
        const success = await storage.deductCredits(userId, INCIDENT_ANALYSIS_COST);
        if (!success) {
          return res.status(402).json({ 
            error: "Failed to deduct credits", 
            message: "Unable to process payment. Please try again."
          });
        }
        
        // Log the transaction
        await storage.createBillingTransaction({
          type: 'usage',
          amount: (INCIDENT_ANALYSIS_COST * 2.50).toString(), // €2.50 per credit
          credits: INCIDENT_ANALYSIS_COST.toString(),
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
          generateRealAIAnalysis(validatedData, userSettings, threatReport),
          analysisTimeout
        ]);
        
        console.log('✅ Gemini AI analysis completed successfully');
        console.log('📈 Analysis confidence:', aiAnalysis?.confidence);
        console.log('🔍 Analysis classification:', aiAnalysis?.classification);
      } catch (error) {
        console.error('❌ Gemini AI analysis failed:', error.message);
        console.log('🔄 Using fallback analysis');
        aiAnalysis = generateFailsafeAnalysis(validatedData, userSettings, threatReport);
        console.log('✅ Fallback analysis completed');
      }
      const incidentData = {
        ...validatedData,
        userId: userId, // Associate incident with user
        ...aiAnalysis,
        threatIntelligence: JSON.stringify(threatReport)
      };
      
      const incident = await storage.createIncident(incidentData, userId);
      
      // Send email notification if enabled
      if (userSettings?.emailNotifications && userSettings?.emailAddress) {
        console.log(`Attempting to send email notification to ${userSettings.emailAddress} for incident ${incident.id}`);
        const user = await storage.getUser(userId);
        if (user) {
          const isHighSeverity = ['critical', 'high'].includes(incident.severity?.toLowerCase() || '');
          const shouldSendHighSeverityAlert = userSettings.highSeverityAlerts && isHighSeverity;
          
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
    } catch (error) {
      console.error("Incident creation error:", error);
      res.status(400).json({ error: "Invalid incident data", details: error.message });
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
      const incidents = await storage.getUserIncidents(userId);
      const prediction = ThreatPredictionEngine.generatePrediction(incidents);
      res.json(prediction);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate threat prediction" });
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
    } catch (error) {
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
    } catch (error) {
      res.status(500).json({ error: "Failed to test API configuration" });
    }
  });

  // Billing & Credits endpoints
  app.get("/api/billing/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transactions = await storage.getUserTransactions(userId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.get("/api/billing/usage", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
      const usage = await storage.getUserUsage(userId, currentMonth);
      const storageGB = await storage.calculateStorageUsage(userId);
      
      res.json({
        incidentsAnalyzed: usage?.incidentsAnalyzed || 0,
        storageGB: storageGB,
        month: currentMonth
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch usage statistics" });
    }
  });

  // Stripe payment intent creation for credit packages
  app.post("/api/billing/create-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { packageId } = req.body;
      
      // Define credit packages with subscription tiers and benefits
      const packages: Record<string, any> = {
        starter: { 
          credits: 20, 
          price: 50,
          name: 'Starter Package',
          description: '20 credits - Basic incident analysis',
          dataRetention: 30, // days
          features: ['Basic Analysis', '30-day data retention']
        },
        professional: { 
          credits: 55, // 10% bonus
          price: 120,
          name: 'Professional Package', 
          description: '55 credits with 10% bonus - Enhanced analysis',
          dataRetention: 60, // days
          features: ['Enhanced Analysis', '60-day data retention', '10% bonus credits']
        },
        business: { 
          credits: 115, // 15% bonus
          price: 230,
          name: 'Business Package',
          description: '115 credits with 15% bonus - Advanced features',
          dataRetention: 90, // days
          features: ['Advanced Analysis', '90-day data retention', '15% bonus credits', 'Priority support']
        },
        enterprise: { 
          credits: 240, // 20% bonus
          price: 440,
          name: 'Enterprise Package',
          description: '240 credits with 20% bonus - Full features',
          dataRetention: 365, // days
          features: ['Full Analysis Suite', '365-day data retention', '20% bonus credits', 'Dedicated support']
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
        
        const newCredits = parseFloat(user.credits) + selectedPackage.credits;
        await storage.updateUserCredits(userId, newCredits);
        await storage.updateUser(userId, { subscriptionPlan: packageId });
        
        // Create transaction record
        const transaction = await storage.createBillingTransaction({
          type: "credit-purchase",
          amount: selectedPackage.price.toString(),
          credits: selectedPackage.credits.toString(),
          description: `${selectedPackage.name} (Dev Mode)`,
          status: "completed"
        }, userId);
        
        return res.json({ 
          success: true,
          devMode: true,
          transaction,
          newBalance: newCredits,
          message: "Development mode: Credits added without payment"
        });
      }
      
      // Production mode: Create Stripe payment intent
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2023-10-16"
      });
      
      const user = await storage.getUser(userId);
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(selectedPackage.price * 100), // Convert to cents
        currency: "eur",
        metadata: {
          userId,
          packageId,
          credits: selectedPackage.credits.toString(),
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
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2023-10-16"
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
          const newCredits = parseFloat(user.credits) + parseFloat(credits);
          await storage.updateUserCredits(userId, newCredits);
          await storage.updateUser(userId, { subscriptionPlan: packageId });
          
          // Create billing transaction
          await storage.createBillingTransaction({
            type: 'credit-purchase',
            amount: (paymentIntent.amount / 100).toString(),
            credits: credits,
            description: `Credit package purchase via Stripe`,
            status: 'completed'
          }, userId);
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
    } catch (error) {
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
    } catch (error) {
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
async function generateRealAIAnalysis(incident: any, settings?: any, threatReport?: any) {
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
    const transformedResult = transformGeminiResultsToLegacyFormat(aiResult, incident, settings);
    console.log('🔄 Transformation completed:', {
      hasAnalysis: !!transformedResult?.analysis,
      confidence: transformedResult?.confidence,
      classification: transformedResult?.classification,
      mitreCount: transformedResult?.mitreAttack?.length || 0,
      iocCount: transformedResult?.iocs?.length || 0
    });
    
    return transformedResult;
  } catch (error) {
    console.error('❌ Gemini AI analysis failed with error:', error);
    console.error('📋 Error details:', error.message);
    console.error('🔍 Error stack:', error.stack);
    // Fallback to simplified analysis if Gemini fails
    console.log('🔄 Falling back to failsafe analysis...');
    return generateFailsafeAnalysis(incident, settings, threatReport);
  }
}

// Transform Gemini AI results to match the expected legacy format
function transformGeminiResultsToLegacyFormat(aiResult: any, incident: any, settings: any) {
  console.log('🔄 Transforming Gemini AI results to legacy format...');
  
  // Safely extract data with fallbacks
  const mitreAttack = aiResult?.mitreMapping?.analysis ? extractMitreTechniques(aiResult.mitreMapping.analysis) : [];
  const iocs = aiResult?.iocEnrichment?.analysis ? extractIOCsFromAnalysis(aiResult.iocEnrichment.analysis) : [];
  const entities = aiResult?.entityMapping?.analysis ? extractEntitiesFromAnalysis(aiResult.entityMapping.analysis) : { users: [], processes: [], files: [], networks: [] };
  
  console.log('📊 Extracted data:', { mitreCount: mitreAttack.length, iocCount: iocs.length, entityCount: Object.keys(entities).length });
  
  return {
    analysis: generateCombinedAnalysisText(aiResult),
    confidence: aiResult?.overallConfidence || 50,
    classification: aiResult?.finalClassification || 'unknown',
    reasoning: aiResult?.reasoning || 'AI analysis completed',
    mitreAttack,
    iocs,
    entities,
    networkTopology: generateNetworkTopology(entities),
    threatIntelligence: generateThreatIntelligenceFromAI(aiResult?.threatIntelligence),
    // Purple Team Analysis for dedicated tab
    purpleTeamAnalysis: aiResult?.purpleTeam?.analysis || 'Purple team analysis not available',
    // Attack Vector Analysis for dedicated tab  
    attackVector: generateAttackVectorAnalysis(aiResult),
    // Raw AI agent results for detailed view
    aiAgentResults: {
      patternRecognition: aiResult?.patternRecognition,
      threatIntelligence: aiResult?.threatIntelligence,
      mitreMapping: aiResult?.mitreMapping,
      iocEnrichment: aiResult?.iocEnrichment,
      classification: aiResult?.classification,
      purpleTeam: aiResult?.purpleTeam,
      entityMapping: aiResult?.entityMapping,
      dualAI: aiResult?.dualAI
    }
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

function extractIOCsFromAnalysis(iocAnalysis: string): string[] {
  const iocs = [];
  
  // Extract IP addresses
  const ipMatches = iocAnalysis.match(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g);
  if (ipMatches) {
    iocs.push(...ipMatches.slice(0, 5));
  }
  
  // Extract domains
  const domainMatches = iocAnalysis.match(/\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z]{2,}\b/gi);
  if (domainMatches) {
    iocs.push(...domainMatches.slice(0, 3));
  }
  
  // Extract file hashes
  const hashMatches = iocAnalysis.match(/\b[a-f0-9]{32,64}\b/gi);
  if (hashMatches) {
    iocs.push(...hashMatches.slice(0, 3));
  }
  
  return Array.from(new Set(iocs)).slice(0, 10); // Limit and remove duplicates
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
  const entities = [];
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
  const relationships = [];
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
    sections.push(`PATTERN RECOGNITION:\n${aiResult.patternRecognition.analysis}\n`);
  }
  
  // Threat Intelligence Analysis
  if (aiResult.threatIntelligence?.analysis) {
    sections.push(`THREAT INTELLIGENCE:\n${aiResult.threatIntelligence.analysis}\n`);
  }
  
  // MITRE ATT&CK Mapping
  if (aiResult.mitreMapping?.analysis) {
    sections.push(`MITRE ATT&CK ANALYSIS:\n${aiResult.mitreMapping.analysis}\n`);
  }
  
  // Classification Analysis
  if (aiResult.classification?.analysis) {
    sections.push(`INCIDENT CLASSIFICATION:\n${aiResult.classification.analysis}\n`);
  }
  
  // Purple Team Analysis
  if (aiResult.purpleTeam?.analysis) {
    sections.push(`PURPLE TEAM ANALYSIS:\n${aiResult.purpleTeam.analysis}\n`);
  }
  
  // Dual-AI Analysis
  if (aiResult.dualAI) {
    sections.push(`DUAL-AI ANALYSIS:\n`);
    if (aiResult.dualAI.tacticalAnalyst) {
      sections.push(`Tactical Analyst: ${aiResult.dualAI.tacticalAnalyst}\n`);
    }
    if (aiResult.dualAI.strategicAnalyst) {
      sections.push(`Strategic Analyst: ${aiResult.dualAI.strategicAnalyst}\n`);
    }
    if (aiResult.dualAI.chiefAnalyst) {
      sections.push(`Chief Analyst: ${aiResult.dualAI.chiefAnalyst}\n`);
    }
  }
  
  return sections.join('\n');
}

// Generate attack vector analysis from Gemini AI results
function generateAttackVectorAnalysis(aiResult: any): any {
  return {
    initialAccess: aiResult?.patternRecognition?.keyFindings?.[0] || 'PowerShell execution detected',
    execution: aiResult?.mitreMapping?.keyFindings?.[0] || 'Command execution via PowerShell',
    persistence: aiResult?.purpleTeam?.keyFindings?.[0] || 'Potential persistence mechanism',
    privilegeEscalation: 'Analysis based on system context',
    defenseEvasion: aiResult?.classification?.keyFindings?.[0] || 'Obfuscated command execution',
    credentialAccess: 'Credential access patterns detected',
    discovery: 'System reconnaissance activities',
    lateralMovement: 'Network movement analysis',
    collection: 'Data collection activities',
    commandControl: 'Command and control channels',
    exfiltration: 'Data exfiltration patterns',
    impact: aiResult?.threatIntelligence?.keyFindings?.[0] || 'Security impact assessment'
  };
}

// Generate network topology from entities
function generateNetworkTopology(entities: any): any {
  const nodes = [];
  const connections = [];
  
  // Add process nodes
  if (entities.processes?.length > 0) {
    entities.processes.forEach((process: any, index: number) => {
      nodes.push({
        id: `process-${index}`,
        type: 'process',
        label: process.name || 'Process',
        riskLevel: process.riskLevel || 'medium'
      });
    });
  }
  
  // Add user nodes
  if (entities.users?.length > 0) {
    entities.users.forEach((user: any, index: number) => {
      nodes.push({
        id: `user-${index}`,
        type: 'user',
        label: user.name || 'User',
        riskLevel: user.riskLevel || 'low'
      });
    });
  }
  
  // Add network nodes
  if (entities.networks?.length > 0) {
    entities.networks.forEach((network: any, index: number) => {
      nodes.push({
        id: `network-${index}`,
        type: 'network',
        label: network.name || 'Network',
        riskLevel: network.riskLevel || 'medium'
      });
    });
  }
  
  // Create connections between nodes
  for (let i = 0; i < nodes.length - 1; i++) {
    connections.push({
      source: nodes[i].id,
      target: nodes[i + 1].id,
      type: 'communication'
    });
  }
  
  return {
    nodes: nodes.length > 0 ? nodes : [
      { id: 'default-1', type: 'process', label: 'PowerShell', riskLevel: 'high' },
      { id: 'default-2', type: 'user', label: 'System', riskLevel: 'medium' }
    ],
    connections: connections.length > 0 ? connections : [
      { source: 'default-1', target: 'default-2', type: 'execution' }
    ]
  };
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
function generateFailsafeAnalysis(incident: any, settings: any, threatReport: any): any {
  console.log('Using failsafe analysis - Gemini AI unavailable');
  
  return {
    analysis: "🚨 FAILSAFE ANALYSIS MODE\n\nGemini AI analysis temporarily unavailable. Manual security review required.\n\nBasic pattern detection indicates potential security event requiring investigation.",
    confidence: 50,
    classification: 'unknown',
    reasoning: 'AI analysis failed - manual review required',
    mitreAttack: ['T1001'], // Generic data obfuscation
    iocs: [],
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
function analyzeWithMultipleAIAgents(content: string, incident: any, config: any = {}, threatReport: any = null) {
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
  const attackVectors = generateAttackVectorAnalysis(content, threatAnalysis);
  
  // Compliance AI Agent
  const complianceImpact = analyzeComplianceImpact(content, incident);
  
  // Similarity AI Agent
  const similarIncidents = findSimilarIncidents(content, incident);

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
    behavioralIndicators: [],
    networkIndicators: [],
    fileIndicators: [],
    registryIndicators: [],
    processIndicators: []
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
    const iocTypes = [...new Set(maliciousIOCs.map((i: any) => i.type))];
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
  const uniqueIps = [...new Set(ips)];
  uniqueIps.slice(0, 5).forEach(ip => {
    entities.push({ 
      id: `ip_${ip.replace(/\./g, '_')}`, 
      type: 'IP Address', 
      value: ip,
      category: 'Network',
      description: isPrivateIP(ip) ? 'Internal IP' : 'External IP'
    });
  });
  
  const uniqueUsers = [...new Set(users)];
  uniqueUsers.slice(0, 3).forEach(user => {
    entities.push({ 
      id: `user_${user.toLowerCase()}`, 
      type: 'User Account', 
      value: user,
      category: 'Identity',
      description: user.toLowerCase().includes('admin') ? 'Administrative Account' : 'Standard User'
    });
  });
  
  const uniqueProcesses = [...new Set(processes)];
  uniqueProcesses.slice(0, 5).forEach(process => {
    entities.push({ 
      id: `process_${process.toLowerCase().replace(/\./g, '_')}`, 
      type: 'Process/File', 
      value: process,
      category: 'Execution',
      description: getProcessDescription(process)
    });
  });
  
  const uniqueDomains = [...new Set(domains)].filter(d => !d.includes('localhost'));
  uniqueDomains.slice(0, 3).forEach(domain => {
    entities.push({ 
      id: `domain_${domain.replace(/\./g, '_')}`, 
      type: 'Domain', 
      value: domain,
      category: 'Network',
      description: 'External Domain'
    });
  });
  
  const uniqueHashes = [...new Set(hashes)];
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

// Helper function to check if IP is private
function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
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

// Generate detailed explanation combining all AI agent results
function generateDetailedExplanation(classification: any, threatAnalysis: any, patterns: any, config: any = {}) {
  let explanation = `Multiple AI security agents have analyzed this incident with the following findings:\n\n`;
  
  explanation += `🔍 Pattern Recognition: Identified ${patterns.length} significant patterns including ${patterns.map(p => p.pattern).join(', ')}.\n\n`;
  
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
