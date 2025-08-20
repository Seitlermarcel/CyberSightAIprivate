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
        // Fallback to basic analysis if AI fails
        aiAnalysisResult = {
          patternRecognition: { agent: "Pattern Recognition", analysis: "Analysis failed", confidence: 50, keyFindings: [], recommendations: [] },
          threatIntelligence: { agent: "Threat Intelligence", analysis: "Analysis failed", confidence: 50, keyFindings: [], recommendations: [] },
          mitreMapping: { agent: "MITRE ATT&CK", analysis: "Analysis failed", confidence: 50, keyFindings: [], recommendations: [] },
          iocEnrichment: { agent: "IOC Enrichment", analysis: "Analysis failed", confidence: 50, keyFindings: [], recommendations: [] },
          classification: { agent: "Classification", analysis: "Analysis failed", confidence: 50, keyFindings: [], recommendations: [] },
          dualAI: { tacticalAnalyst: "Analysis failed", strategicAnalyst: "Analysis failed", chiefAnalyst: "Analysis failed" },
          purpleTeam: { agent: "Purple Team", analysis: "Analysis failed", confidence: 50, keyFindings: [], recommendations: [] },
          entityMapping: { agent: "Entity Mapping", analysis: "Analysis failed", confidence: 50, keyFindings: [], recommendations: [] },
          overallConfidence: 50,
          finalClassification: "needs-review",
          reasoning: "AI analysis system encountered an error"
        };
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
        })
      };
      
      console.log('💾 Saving incident with comprehensive AI analysis to database...');
      const incident = await storage.createIncident(incidentData, userId);
      
      console.log('✅ Incident analysis complete:', {
        id: incident.id,
        confidence: incident.confidence,
        classification: incident.classification,
        mitreCount: mitreAttackTechniques.length,
        iocCount: extractedIOCs.length
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

  // Basic health check
  app.get("/api/health", async (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Return the HTTP server instance for WebSocket upgrade
  return createServer(app);
}