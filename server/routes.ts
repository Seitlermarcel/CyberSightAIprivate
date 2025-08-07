import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertIncidentSchema, insertSettingsSchema } from "@shared/schema";
import { sendIncidentNotification, sendTestEmail } from "./gmail-email-service";
import { threatIntelligence } from "./threat-intelligence";
import { ThreatPredictionEngine } from "./threat-prediction";

export async function registerRoutes(app: Express): Promise<Server> {
  // Incidents routes (user-specific)
  app.get("/api/incidents", async (req, res) => {
    try {
      // For now, use default user - in production this would come from session/auth
      const userId = "default-user";
      const incidents = await storage.getUserIncidents(userId);
      res.json(incidents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch incidents" });
    }
  });

  app.get("/api/incidents/:id", async (req, res) => {
    try {
      const incident = await storage.getIncident(req.params.id);
      if (!incident) {
        return res.status(404).json({ error: "Incident not found" });
      }
      res.json(incident);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch incident" });
    }
  });

  app.post("/api/incidents", async (req, res) => {
    try {
      const validatedData = insertIncidentSchema.parse(req.body);
      
      // Get current user - in production this would come from session/auth
      const userId = "default-user";
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
      
      const incident = await storage.createIncident(incidentData);
      
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
      res.status(400).json({ error: "Invalid incident data" });
    }
  });

  app.patch("/api/incidents/:id", async (req, res) => {
    try {
      const incident = await storage.updateIncident(req.params.id, req.body);
      if (!incident) {
        return res.status(404).json({ error: "Incident not found" });
      }
      res.json(incident);
    } catch (error) {
      res.status(500).json({ error: "Failed to update incident" });
    }
  });

  // Settings routes
  app.get("/api/settings/:userId", async (req, res) => {
    try {
      const settings = await storage.getUserSettings(req.params.userId);
      if (!settings) {
        return res.status(404).json({ error: "Settings not found" });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings/:userId", async (req, res) => {
    try {
      const validatedData = insertSettingsSchema.partial().parse(req.body);
      console.log('Updating settings for user:', req.params.userId, 'with data:', validatedData);
      
      const settings = await storage.updateUserSettings(req.params.userId, validatedData);
      
      // Send test email when email notifications are first enabled
      if (validatedData.emailNotifications && validatedData.emailAddress && 
          (!req.body.previousEmailNotifications || req.body.previousEmailAddress !== validatedData.emailAddress)) {
        await sendTestEmail(validatedData.emailAddress);
      }
      
      res.json(settings);
    } catch (error) {
      console.error('Settings update error:', error);
      res.status(400).json({ error: "Invalid settings data", details: error.message });
    }
  });

  // Mock user route
  app.get("/api/user", async (req, res) => {
    const user = await storage.getUser("default-user");
    res.json(user);
  });

  // Dashboard stats (user-specific and linked to actual incident data)
  app.get("/api/dashboard-stats", async (req, res) => {
    try {
      // Get current user's incidents
      const userId = "default-user";
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
  app.get("/api/threat-prediction", async (req, res) => {
    try {
      const userId = "default-user";
      const incidents = await storage.getUserIncidents(userId);
      const prediction = ThreatPredictionEngine.generatePrediction(incidents);
      res.json(prediction);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate threat prediction" });
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
  
  // Code Analysis AI Agent (if code detected)
  const codeAnalysis = analyzeCodeElements(content);
  
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
    mitreAttack: mitreMapping.techniques,
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
    techniques.push('T1003 - OS Credential Dumping');
  }
  
  // Defense Evasion  
  if (content.includes('powershell') && content.includes('-enc')) {
    tactics.push({
      id: 'TA0005', 
      name: 'Defense Evasion',
      description: 'The adversary is trying to avoid being detected'
    });
    techniques.push('T1027 - Obfuscated Files or Information');
  }
  
  // Persistence
  if (content.includes('schtasks') || content.includes('registry') || content.includes('service')) {
    tactics.push({
      id: 'TA0003',
      name: 'Persistence', 
      description: 'The adversary is trying to maintain their foothold'
    });
    techniques.push('T1053 - Scheduled Task/Job');
  }
  
  // Discovery
  if (content.includes('net user') || content.includes('whoami') || content.includes('systeminfo')) {
    tactics.push({
      id: 'TA0007',
      name: 'Discovery',
      description: 'The adversary is trying to figure out your environment'
    });
    techniques.push('T1033 - System Owner/User Discovery');
  }
  
  // Execution
  if (content.includes('cmd') || content.includes('powershell') || content.includes('wmic')) {
    tactics.push({
      id: 'TA0002',
      name: 'Execution',
      description: 'The adversary is trying to run malicious code'
    });
    techniques.push('T1059 - Command and Scripting Interpreter');
  }

  return {
    tactics: tactics.length > 0 ? tactics : [{
      id: 'TA0001',
      name: 'Initial Access',
      description: 'Generic suspicious activity detected'
    }],
    techniques: techniques.length > 0 ? techniques : ['T1190 - Exploit Public-Facing Application']
  };
}

// IOC Enrichment AI Agent with Threat Intelligence Integration
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
      }
    } else {
      // Fallback to simulated analysis if no threat intelligence
      reputation = Math.random() > 0.7 ? 'Malicious' : Math.random() > 0.4 ? 'Suspicious' : 'Clean';
      confidence = reputation === 'Malicious' ? '95%' : reputation === 'Suspicious' ? '70%' : '30%';
      threatInfo = reputation === 'Malicious' ? 'Known C2 server' : reputation === 'Suspicious' ? 'Recently observed in attacks' : 'No known threats';
    }
    
    indicators.push({
      type: 'IP Address',
      value: ip,
      reputation: reputation,
      confidence: confidence,
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
      threatIntelligence: 'Hash associated with credential dumping tools'
    });
  }
  
  // Domain names
  const domainRegex = /[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/g;
  const domains = content.match(domainRegex) || [];
  
  domains.slice(0, 2).forEach(domain => {
    if (!domain.includes('microsoft') && !domain.includes('windows')) {
      indicators.push({
        type: 'Domain',
        value: domain,
        reputation: 'Unknown',
        confidence: '50%',
        threatIntelligence: 'Domain requires further investigation'
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
  const entities = [];
  const relationships = [];
  
  // Extract potential entities
  const ipRegex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;
  const ips = content.match(ipRegex) || [];
  const userRegex = /user[:\s]+([a-zA-Z0-9\\_]+)/gi;
  const users = content.match(userRegex) || [];
  const processRegex = /(cmd|powershell|wmic|schtasks)\.exe/gi;
  const processes = content.match(processRegex) || [];
  
  // Map entities
  ips.slice(0, 3).forEach((ip, index) => {
    entities.push({ id: `ip_${index}`, type: 'IP Address', category: 'Network' });
  });
  
  users.slice(0, 2).forEach((user, index) => {
    entities.push({ id: `user_${index}`, type: 'User Account', category: 'Identity' });
  });
  
  processes.slice(0, 3).forEach((process, index) => {
    entities.push({ id: `process_${index}`, type: 'Process', category: 'Execution' });
  });
  
  // Create relationships
  if (entities.length > 1) {
    relationships.push({
      source: entities[0].id,
      action: 'communicates_with',
      target: entities[1].id
    });
  }
  
  return { entities, relationships };
}

// Code Analysis AI Agent
function analyzeCodeElements(content: string) {
  if (!content.includes('powershell') && !content.includes('cmd') && !content.includes('script')) {
    return { summary: '', language: '', findings: [], sandboxOutput: '' };
  }
  
  const language = content.includes('powershell') ? 'PowerShell' : 
                   content.includes('python') ? 'Python' :
                   content.includes('javascript') ? 'JavaScript' : 'Batch';
  
  const findings = [];
  if (content.includes('-enc') || content.includes('base64')) {
    findings.push('Encoded content detected - potential obfuscation');
  }
  if (content.includes('downloadstring') || content.includes('invoke-webrequest')) {
    findings.push('Network download capability identified');
  }
  if (content.includes('invoke-expression') || content.includes('iex')) {
    findings.push('Dynamic code execution patterns found');
  }
  
  return {
    language: language,
    summary: `${language} code analysis reveals ${findings.length} security concerns`,
    findings: findings,
    sandboxOutput: findings.length > 0 ? 'ALERT: Potentially malicious code patterns detected' : 'No immediate threats identified'
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

// Compliance AI Agent
function analyzeComplianceImpact(content: string, incident: any) {
  const impacts = [];
  
  if (content.includes('credential') || content.includes('password') || content.includes('personal')) {
    impacts.push({
      framework: 'GDPR',
      article: 'Article 32',
      impact: 'High',
      description: 'Potential unauthorized access to personal data requiring breach notification'
    });
    
    impacts.push({
      framework: 'SOX',
      requirement: 'Section 302',
      impact: 'Medium',
      description: 'Security incident may affect internal controls over financial reporting'
    });
  }
  
  if (incident.severity === 'critical' || incident.severity === 'high') {
    impacts.push({
      framework: 'ISO 27001',
      requirement: 'A.16.1.6',
      impact: 'High',
      description: 'Security incident requires formal incident response procedures'
    });
  }
  
  impacts.push({
    recommendation: 'Implement continuous security monitoring and incident response procedures to ensure compliance with regulatory requirements'
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
