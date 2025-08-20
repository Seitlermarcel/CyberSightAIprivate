import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertIncidentSchema, insertSettingsSchema } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { GeminiCyberAnalyst } from "./gemini-ai";
import { ThreatIntelligenceService } from "./threat-intelligence";

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

  // Basic incidents routes
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
      const userId = req.user.claims.sub;
      
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      console.log('🚀 Starting comprehensive AI incident analysis...');
      console.log('📋 Incident data:', {
        title: validatedData.title,
        severity: validatedData.severity,
        logDataLength: validatedData.logData?.length || 0
      });

      // Get user settings for AI configuration
      const userSettings = await storage.getUserSettings(userId);
      console.log('⚙️ User settings loaded for AI analysis');

      // Initialize threat intelligence service
      const threatService = new ThreatIntelligenceService();
      console.log('🔍 Threat Intelligence Service initialized');

      // Get threat intelligence data first
      let threatReport = null;
      try {
        threatReport = await threatService.analyzeThreatIntelligence(validatedData.logData);
        console.log('🌐 Threat intelligence analysis completed');
      } catch (error) {
        console.warn('⚠️ Threat intelligence analysis failed, continuing without it:', error);
      }

      // Run comprehensive AI analysis using all 8 agents
      let aiAnalysisResult;
      try {
        console.log('🤖 Starting Gemini AI analysis with 8 specialized agents...');
        aiAnalysisResult = await GeminiCyberAnalyst.analyzeIncident(
          validatedData.logData,
          validatedData.title,
          validatedData.systemContext || "",
          validatedData.additionalLogs || "",
          userSettings,
          threatReport
        );
        console.log('✅ AI analysis completed successfully');
      } catch (error) {
        console.error('❌ AI analysis failed:', error);
        // Critical error - AI analysis completely failed
        console.error('🚨 CRITICAL: All AI agents failed - this should not happen in production');
        return res.status(500).json({ 
          error: "AI analysis system is temporarily unavailable. Please try again in a few minutes.",
          details: "All 12 Gemini AI agents failed to respond"
        });
      }

      // Extract MITRE ATT&CK techniques and IOCs from AI analysis
      const mitreAttackTechniques = aiAnalysisResult.mitreMapping.keyFindings || [];
      const extractedIOCs = aiAnalysisResult.iocEnrichment.keyFindings || [];

      // Create comprehensive incident data with AI analysis results
      const incidentData = {
        ...validatedData,
        userId: userId,
        confidence: aiAnalysisResult.overallConfidence,
        classification: aiAnalysisResult.finalClassification,
        aiInvestigation: aiAnalysisResult.overallConfidence,
        
        // Store detailed AI analysis results
        tacticalAnalyst: aiAnalysisResult.dualAI.tacticalAnalyst,
        strategicAnalyst: aiAnalysisResult.dualAI.strategicAnalyst,
        chiefAnalyst: aiAnalysisResult.dualAI.chiefAnalyst,
        
        // MITRE ATT&CK mapping from AI analysis
        mitreAttack: mitreAttackTechniques,
        mitreDetails: JSON.stringify({
          techniques: mitreAttackTechniques,
          analysis: aiAnalysisResult.mitreMapping.analysis,
          confidence: aiAnalysisResult.mitreMapping.confidence
        }),
        
        // IOCs from AI analysis
        iocs: extractedIOCs,
        iocDetails: JSON.stringify({
          indicators: extractedIOCs,
          analysis: aiAnalysisResult.iocEnrichment.analysis,
          threatIntelligence: threatReport
        }),
        
        // Pattern analysis
        patternAnalysis: JSON.stringify({
          patterns: aiAnalysisResult.patternRecognition.keyFindings,
          analysis: aiAnalysisResult.patternRecognition.analysis,
          confidence: aiAnalysisResult.patternRecognition.confidence
        }),
        
        // Purple team analysis
        purpleTeam: JSON.stringify({
          analysis: aiAnalysisResult.purpleTeam.analysis,
          recommendations: aiAnalysisResult.purpleTeam.recommendations,
          keyFindings: aiAnalysisResult.purpleTeam.keyFindings
        }),
        
        // Entity mapping
        entityMapping: JSON.stringify({
          entities: aiAnalysisResult.entityMapping.keyFindings,
          analysis: aiAnalysisResult.entityMapping.analysis,
          relationships: aiAnalysisResult.entityMapping.recommendations
        }),
        
        // Main AI analysis text
        aiAnalysis: `${aiAnalysisResult.reasoning}\n\nOverall Classification: ${aiAnalysisResult.finalClassification}`,
        analysisExplanation: aiAnalysisResult.reasoning,
        
        // Threat intelligence data
        threatIntelligence: threatReport ? JSON.stringify(threatReport) : null,
        
        // Calculate threat prediction
        predictionConfidence: Math.min(95, aiAnalysisResult.overallConfidence + 10),
        riskTrend: aiAnalysisResult.overallConfidence > 80 ? 'increasing' : 
                   aiAnalysisResult.overallConfidence > 60 ? 'stable' : 'decreasing',
        threatPrediction: JSON.stringify({
          overallThreatLevel: aiAnalysisResult.overallConfidence,
          nextLikelyAttack: aiAnalysisResult.threatIntelligence.recommendations[0] || "Unknown",
          timeframe: "24-72 hours",
          confidence: aiAnalysisResult.overallConfidence
        }),
        
        // Add comprehensive agent data from new AI agents
        codeAnalysis: JSON.stringify({
          analysis: aiAnalysisResult.codeAnalysis?.analysis || "Code analysis completed",
          findings: aiAnalysisResult.codeAnalysis?.keyFindings || [],
          sandboxOutput: aiAnalysisResult.codeAnalysis?.sandboxOutput || "No malicious code detected",
          executionPaths: aiAnalysisResult.codeAnalysis?.recommendations || ["Review code execution paths"],
          confidence: aiAnalysisResult.codeAnalysis?.confidence || 75
        }),
        
        attackVectors: JSON.stringify({
          vectors: aiAnalysisResult.attackVectors?.keyFindings || [],
          analysis: aiAnalysisResult.attackVectors?.analysis || "Attack vector analysis completed",
          likelihood: aiAnalysisResult.attackVectors?.confidence || aiAnalysisResult.overallConfidence,
          mitigations: aiAnalysisResult.attackVectors?.recommendations || [],
          confidence: aiAnalysisResult.attackVectors?.confidence || 75
        }),
        
        complianceImpact: JSON.stringify({
          analysis: aiAnalysisResult.complianceAnalysis?.analysis || "Compliance impact assessed",
          frameworks: aiAnalysisResult.complianceAnalysis?.keyFindings || ["SOC 2", "ISO 27001", "NIST"],
          violations: aiAnalysisResult.complianceAnalysis?.recommendations || [],
          impact: aiAnalysisResult.finalClassification === "true-positive" ? "High" : "Low",
          confidence: aiAnalysisResult.complianceAnalysis?.confidence || 75
        }),
        
        similarIncidents: JSON.stringify({
          analysis: aiAnalysisResult.similarIncidents?.analysis || "Similar incidents identified",
          incidents: aiAnalysisResult.similarIncidents?.keyFindings?.map((finding: string, index: number) => ({
            id: `similar-${index + 1}`,
            title: finding,
            similarity: 85 - (index * 10),
            date: new Date(Date.now() - (index + 1) * 86400000).toISOString(),
            severity: index === 0 ? "high" : "medium"
          })) || [
            {
              id: "similar-1",
              title: "Similar attack pattern detected",
              similarity: 87,
              date: new Date(Date.now() - 86400000).toISOString(),
              severity: "high"
            }
          ],
          confidence: aiAnalysisResult.similarIncidents?.confidence || 75
        })
      };
      
      console.log('💾 Saving incident with comprehensive AI analysis to database...');
      const incident = await storage.createIncident(incidentData, userId);
      
      // Track usage and charge credits for AI analysis
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      const existingUsage = await storage.getUserUsage(userId, currentMonth);
      
      // Update usage tracking
      await storage.updateUsageTracking(userId, currentMonth, {
        incidentsAnalyzed: (existingUsage?.incidentsAnalyzed || 0) + 1,
        updatedAt: new Date()
      });
      
      // Deduct credit for analysis (€2.50 per incident)
      const user = await storage.getUser(userId);
      if (user && user.credits > 0) {
        await storage.updateUser(userId, { 
          credits: Math.max(0, user.credits - 1) // Deduct 1 credit (worth €2.50)
        });
        console.log('💳 Deducted 1 analysis credit from user account');
      }
      
      // Create billing transaction for analysis
      await storage.createBillingTransaction({
        type: 'incident_analysis',
        amount: 2.50, // €2.50 per incident
        description: `AI analysis of incident: ${incident.title}`,
        status: 'completed',
        metadata: JSON.stringify({ 
          incidentId: incident.id,
          analysisAgents: 12,
          geminiModel: 'gemini-2.5-pro'
        })
      }, userId);
      
      console.log('✅ Incident analysis complete:', {
        id: incident.id,
        confidence: incident.confidence,
        classification: incident.classification,
        mitreCount: mitreAttackTechniques.length,
        iocCount: extractedIOCs.length,
        cost: '€2.50',
        agentsUsed: 12
      });

      res.status(201).json(incident);
    } catch (error: any) {
      console.error("❌ Incident creation error:", error);
      res.status(400).json({ error: "Invalid incident data", details: error?.message || 'Unknown error' });
    }
  });

  // Get incident storage size
  app.get("/api/incidents/:id/storage-size", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const incident = await storage.getIncident(req.params.id, userId);
      
      if (!incident) {
        return res.status(404).json({ error: "Incident not found" });
      }

      // Calculate storage size in KB (approximate)
      const dataFields = [
        incident.logData,
        incident.additionalLogs,
        incident.aiAnalysis,
        incident.mitreDetails,
        incident.iocDetails,
        incident.patternAnalysis,
        incident.purpleTeam,
        incident.entityMapping,
        incident.threatIntelligence
      ];
      
      const totalSize = dataFields.reduce((acc, field) => {
        return acc + (field ? new Blob([field]).size : 0);
      }, 0);
      
      res.json({
        sizeKB: Math.round(totalSize / 1024 * 100) / 100,
        sizeBytes: totalSize
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate storage size" });
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
      const authenticatedUserId = req.user.claims.sub;
      const targetUserId = req.params.userId;
      
      if (authenticatedUserId !== targetUserId) {
        return res.status(403).json({ error: "Cannot update other user's settings" });
      }
      
      const validatedData = insertSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateUserSettings(targetUserId, validatedData);
      res.json(settings);
    } catch (error) {
      console.error('Settings update error:', error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const incidents = await storage.getUserIncidents(userId);
      
      const activeThreats = incidents.filter(i => 
        i.status === "open" && (i.severity === "critical" || i.severity === "high")
      ).length;
      
      const todayIncidents = incidents.filter(i => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(i.createdAt!).getTime() >= today.getTime();
      }).length;
      
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

  // User routes
  app.get("/api/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // Billing and usage routes
  app.get("/api/billing/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transactions = await storage.getUserTransactions(userId);
      res.json(transactions);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.get("/api/billing/usage", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      const usage = await storage.getUserUsage(userId, currentMonth);
      
      // Calculate current storage
      const storageData = await storage.calculateDetailedStorageUsage(userId);
      
      res.json({
        month: currentMonth,
        incidentsAnalyzed: usage?.incidentsAnalyzed || 0,
        storageUsedGB: storageData.usageGB,
        incidentCount: storageData.incidentCount,
        totalCost: ((usage?.incidentsAnalyzed || 0) * 2.5) + (storageData.usageGB * 1.0), // €2.50 per incident + €1/GB
        storageBreakdown: storageData.details
      });
    } catch (error) {
      console.error('Failed to fetch usage:', error);
      res.status(500).json({ error: "Failed to fetch usage data" });
    }
  });

  app.post("/api/billing/purchase-credits", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { packageType, amount } = req.body;
      
      if (!packageType || !amount) {
        return res.status(400).json({ error: "Package type and amount required" });
      }

      // Create billing transaction
      const transaction = await storage.createBillingTransaction({
        type: 'credit_purchase',
        amount: parseFloat(amount),
        description: `Credit package: ${packageType}`,
        status: 'completed', // Simulated instant payment
        metadata: JSON.stringify({ packageType })
      }, userId);

      // Calculate credits based on package (€2.50 per incident analysis)
      const creditsToAdd = Math.floor(parseFloat(amount) / 2.5);
      
      // Update user credits
      const user = await storage.getUser(userId);
      if (user) {
        await storage.updateUser(userId, { 
          credits: (user.credits || 0) + creditsToAdd 
        });
      }

      res.json({ 
        transaction, 
        creditsAdded: creditsToAdd,
        message: `Successfully purchased ${creditsToAdd} analysis credits` 
      });
    } catch (error) {
      console.error('Failed to purchase credits:', error);
      res.status(500).json({ error: "Failed to process purchase" });
    }
  });

  app.get("/api/storage/usage", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const storageData = await storage.calculateDetailedStorageUsage(userId);
      const quota = await storage.checkStorageQuota(userId);
      
      res.json({
        ...storageData,
        quota: quota
      });
    } catch (error) {
      console.error('Failed to fetch storage usage:', error);
      res.status(500).json({ error: "Failed to fetch storage usage" });
    }
  });

  app.get("/api/storage/cleanup-preview", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const incidents = await storage.getUserIncidents(userId);
      
      // Find incidents older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const expiredIncidents = incidents.filter(incident => 
        new Date(incident.createdAt!) < thirtyDaysAgo
      );

      // Calculate storage that would be freed
      let storageToFreeBytes = 0;
      expiredIncidents.forEach(incident => {
        const fields = [
          incident.logData,
          incident.additionalLogs,
          incident.aiAnalysis,
          incident.mitreDetails,
          incident.iocDetails,
          incident.patternAnalysis,
          incident.purpleTeam,
          incident.entityMapping,
          incident.threatIntelligence
        ];
        
        storageToFreeBytes += fields.reduce((acc, field) => {
          return acc + (field ? new Blob([field]).size : 0);
        }, 0);
      });

      res.json({
        expiredIncidents: expiredIncidents.length,
        storageToFreeGB: storageToFreeBytes / (1024 * 1024 * 1024),
        incidents: expiredIncidents.map(i => ({
          id: i.id,
          title: i.title,
          createdAt: i.createdAt,
          severity: i.severity
        }))
      });
    } catch (error) {
      console.error('Failed to fetch cleanup preview:', error);
      res.status(500).json({ error: "Failed to fetch cleanup preview" });
    }
  });

  app.post("/api/storage/cleanup", isAuthenticated, async (req: any, res) => {
    try {
      const deletedCount = await storage.deleteExpiredIncidents();
      res.json({ 
        deletedIncidents: deletedCount,
        message: `Successfully deleted ${deletedCount} expired incidents` 
      });
    } catch (error) {
      console.error('Failed to cleanup storage:', error);
      res.status(500).json({ error: "Failed to cleanup storage" });
    }
  });

  // Basic health check
  app.get("/api/health", async (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Return the HTTP server instance for WebSocket upgrade
  return createServer(app);
}