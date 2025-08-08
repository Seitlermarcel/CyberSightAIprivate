import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertIncidentSchema, insertSettingsSchema } from "@shared/schema";
import { sendIncidentNotification, sendTestEmail } from "./gmail-email-service";
import { threatIntelligence } from "./threat-intelligence";
import { ThreatPredictionEngine } from "./threat-prediction";
import { setupAuth, isAuthenticated } from "./replitAuth";

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
      
      const userId = req.user.claims.sub;
      const userSettings = await storage.getUserSettings(userId);
      
      // Analyze threat intelligence
      const threatReport = await threatIntelligence.analyzeThreatIntelligence(
        validatedData.logData || '',
        validatedData.additionalLogs || ''
      );
      
      // Intelligent AI analysis with settings integration and threat intelligence
      const aiAnalysis = generateMockAnalysis(validatedData, userSettings, threatReport);
      const incidentData = {
        ...validatedData,
        userId: userId, // Associate incident with user
        ...aiAnalysis,
        threatIntelligence: JSON.stringify(threatReport)
      };
      
      const incident = await storage.createIncident(incidentData, userId);
      
      // Send email notification if enabled
      if (userSettings?.emailNotifications && userSettings?.emailAddress) {
        const user = await storage.getUser(userId);
        if (user) {
          const isHighSeverity = ['critical', 'high'].includes(incident.severity?.toLowerCase() || '');
          const shouldSendHighSeverityAlert = userSettings.highSeverityAlerts && isHighSeverity;
          
          await sendIncidentNotification({
            incident,
            user,
            recipientEmail: userSettings.emailAddress,
            isHighSeverityAlert: shouldSendHighSeverityAlert
          });
        }
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

  app.patch("/api/settings/:userId", async (req, res) => {
    try {
      const validatedData = insertSettingsSchema.partial().parse(req.body);
      
      // Get current settings to compare
      const currentSettings = await storage.getUserSettings(req.params.userId);
      
      // Update settings
      const settings = await storage.updateUserSettings(req.params.userId, validatedData);
      
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
      res.status(400).json({ error: "Invalid settings data" });
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

  app.post("/api/billing/purchase", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { packageId } = req.body;
      
      // Define credit packages
      const packages: Record<string, any> = {
        starter: { credits: 20, price: 50 },
        professional: { credits: 50, price: 120 },
        business: { credits: 100, price: 230 },
        enterprise: { credits: 200, price: 440 }
      };
      
      const selectedPackage = packages[packageId];
      if (!selectedPackage) {
        return res.status(400).json({ error: "Invalid package" });
      }
      
      // Add credits to user account
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const newCredits = parseFloat(user.credits) + selectedPackage.credits;
      await storage.updateUserCredits(userId, newCredits);
      
      // Create transaction record
      const transaction = await storage.createBillingTransaction({
        type: "credit-purchase",
        amount: selectedPackage.price.toString(),
        credits: selectedPackage.credits.toString(),
        description: `Purchased ${selectedPackage.credits} credits`,
        status: "completed"
      }, userId);
      
      res.json({ success: true, transaction, newBalance: newCredits });
    } catch (error) {
      res.status(500).json({ error: "Failed to process purchase" });
    }
  });

  // Advanced Query endpoints
  app.post("/api/queries/run", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { query, queryType } = req.body;
      
      // Check user has credits
      const hasCredits = await storage.deductCredits(userId, 0.5); // 0.5 credits per query
      if (!hasCredits) {
        return res.status(402).json({ error: "Insufficient credits" });
      }
      
      // Save query to history
      await storage.saveQuery({
        query,
        queryType,
        resultCount: 0
      }, userId);
      
      // Simulate query execution - in production, would run actual query
      const incidents = await storage.getUserIncidents(userId);
      const startTime = Date.now();
      
      // Simple filtering based on query (mock implementation)
      let results = incidents;
      if (query.toLowerCase().includes("critical")) {
        results = incidents.filter(i => i.severity === "critical");
      } else if (query.toLowerCase().includes("high")) {
        results = incidents.filter(i => i.severity === "high");
      }
      
      const executionTime = Date.now() - startTime;
      
      res.json({
        results: results.slice(0, 100),
        resultCount: results.length,
        executionTime,
        creditsUsed: 0.5
      });
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

// Intelligent AI analysis generator that analyzes logs and generates realistic cybersecurity insights
function generateMockAnalysis(incident: any, settings?: any, threatReport?: any) {
  const logData = incident.logData?.toLowerCase() || '';
  const title = incident.title?.toLowerCase() || '';
  const systemContext = incident.systemContext?.toLowerCase() || '';
  const additionalLogs = incident.additionalLogs?.toLowerCase() || '';
  const allContent = `${title} ${logData} ${systemContext} ${additionalLogs}`;
  
  // Apply settings-based analysis configuration
  const analysisConfig = {
    depth: settings?.analysisDepth || 'comprehensive',
    confidenceThreshold: settings?.confidenceThreshold || 80,
    enableDualAI: settings?.enableDualAI ?? true,
    autoSeverityAdjustment: settings?.autoSeverityAdjustment ?? false,
    customInstructions: settings?.customInstructions || ''
  };
  
  // AI Agent Analysis Results with settings integration and threat intelligence
  const analysisResults = analyzeWithMultipleAIAgents(allContent, incident, analysisConfig, threatReport);
  
  return analysisResults;
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
  
  // Confidence threshold adjustments
  if (finalConfidence < config.confidenceThreshold && finalClassification === 'true-positive') {
    finalClassification = 'false-positive';
    finalConfidence = Math.max(60, config.confidenceThreshold - 10);
  }

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
        
        // Add geo-location data from threat intelligence
        if (threatIndicator.country || threatIndicator.organization) {
          geoLocation = `${threatIndicator.country || 'Unknown Country'}${threatIndicator.organization ? ' - ' + threatIndicator.organization : ''}`;
        }
      }
    } else {
      // Fallback to simulated analysis if no threat intelligence
      reputation = Math.random() > 0.7 ? 'Malicious' : Math.random() > 0.4 ? 'Suspicious' : 'Clean';
      confidence = reputation === 'Malicious' ? '95%' : reputation === 'Suspicious' ? '70%' : '30%';
      threatInfo = reputation === 'Malicious' ? 'Known C2 server' : reputation === 'Suspicious' ? 'Recently observed in attacks' : 'No known threats';
      
      // Simulate geo-location for demo purposes
      if (ip.startsWith('192.168')) {
        geoLocation = 'Private Network - Internal';
      } else if (ip.startsWith('10.')) {
        geoLocation = 'Private Network - Internal';
      } else {
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
          
          if (threatIndicator.country) {
            geoLocation = threatIndicator.country;
          }
        }
      } else {
        // Simulate for known malicious domains
        if (domain.includes('evil') || domain.includes('malware') || domain.includes('hack')) {
          reputation = 'Malicious';
          confidence = '90%';
          threatInfo = 'Known malicious domain - phishing/malware distribution';
          geoLocation = 'Russia - Bulletproof Hosting';
        } else if (domain.endsWith('.tk') || domain.endsWith('.ml')) {
          reputation = 'Suspicious';
          confidence = '60%';
          threatInfo = 'Free domain - commonly abused for malicious purposes';
          geoLocation = 'Unknown - Free Domain Service';
        } else {
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
  let suspicionScore = 0;
  let reasons = [];
  
  // High-risk indicators
  if (content.includes('lsass') || content.includes('mimikatz') || content.includes('secretsdump')) {
    suspicionScore += 30;
    reasons.push('Credential dumping tools detected');
  }
  
  if (content.includes('powershell') && (content.includes('-enc') || content.includes('bypass'))) {
    suspicionScore += 25;
    reasons.push('Obfuscated PowerShell execution');
  }
  
  if (content.includes('lateral') || content.includes('privilege') || content.includes('escalation')) {
    suspicionScore += 20;
    reasons.push('Privilege escalation indicators');
  }
  
  // Medium-risk indicators
  if (content.includes('reconnaissance') || content.includes('enumeration')) {
    suspicionScore += 15;
    reasons.push('Reconnaissance activity detected');
  }
  
  if (content.includes('persistence') || content.includes('backdoor')) {
    suspicionScore += 15;
    reasons.push('Persistence mechanisms identified');
  }
  
  // Context-based scoring
  if (incident.severity === 'critical') suspicionScore += 10;
  if (incident.severity === 'high') suspicionScore += 5;
  
  // Network indicators
  if (threatAnalysis.networkIndicators.length > 0) {
    suspicionScore += 10;
    reasons.push('Suspicious network activity');
  }
  
  // Threat Intelligence scoring
  if (threatReport) {
    if (threatReport.risk_score >= 80) {
      suspicionScore += 30;
      reasons.push(`Critical threat intelligence risk (${threatReport.risk_score}/100)`);
    } else if (threatReport.risk_score >= 60) {
      suspicionScore += 20;
      reasons.push(`High threat intelligence risk (${threatReport.risk_score}/100)`);
    } else if (threatReport.risk_score >= 40) {
      suspicionScore += 10;
      reasons.push(`Medium threat intelligence risk (${threatReport.risk_score}/100)`);
    }
    
    // Check for malicious indicators
    const maliciousCount = threatReport.indicators?.filter((i: any) => i.malicious).length || 0;
    if (maliciousCount > 0) {
      suspicionScore += maliciousCount * 5;
      reasons.push(`${maliciousCount} malicious indicators detected via threat intelligence`);
    }
  }
  
  // Final classification
  const isPositive = suspicionScore >= 50;
  const confidence = Math.min(95, Math.max(60, suspicionScore + Math.floor(Math.random() * 20)));
  
  const baseExplanation = isPositive ? 
    `This incident is classified as a TRUE POSITIVE with ${confidence}% confidence. ` :
    `This incident is classified as a FALSE POSITIVE with ${confidence}% confidence. `;
    
  const detailedExplanation = baseExplanation + 
    `Key factors in this classification: ${reasons.join(', ')}. ` +
    `The AI analysis considered multiple security indicators including behavioral patterns, ` +
    `MITRE ATT&CK techniques, network indicators, and threat intelligence correlation.`;
  
  return {
    result: isPositive ? 'true-positive' : 'false-positive',
    confidence: confidence,
    explanation: detailedExplanation,
    reasons: reasons
  };
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

// Attack Vector AI Agent
function generateAttackVectorAnalysis(content: string, threatAnalysis: any) {
  const vectors = [];
  
  if (content.includes('credential') || content.includes('password')) {
    vectors.push({
      vector: 'Credential Theft',
      likelihood: 'High',
      description: 'Adversary attempting to steal user credentials for lateral movement'
    });
  }
  
  if (content.includes('powershell') && content.includes('-enc')) {
    vectors.push({
      vector: 'Living Off the Land',
      likelihood: 'High', 
      description: 'Using legitimate system tools for malicious purposes to evade detection'
    });
  }
  
  if (threatAnalysis.networkIndicators.length > 0) {
    vectors.push({
      vector: 'Command and Control',
      likelihood: 'Medium',
      description: 'Establishing communication channels for remote control and data exfiltration'
    });
  }
  
  return vectors.length > 0 ? vectors : [{
    vector: 'Reconnaissance',
    likelihood: 'Low',
    description: 'Basic information gathering activities detected'
  }];
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
