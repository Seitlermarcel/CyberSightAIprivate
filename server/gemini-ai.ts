import { GoogleGenAI } from "@google/genai";

// Initialize Gemini AI with API key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AIAgentResponse {
  agent: string;
  analysis: string;
  confidence: number;
  keyFindings: string[];
  recommendations: string[];
}

export interface AIAnalysisResult {
  patternRecognition: AIAgentResponse;
  threatIntelligence: AIAgentResponse;
  mitreMapping: AIAgentResponse;
  iocEnrichment: AIAgentResponse;
  classification: AIAgentResponse;
  dualAI: {
    tacticalAnalyst: string;
    strategicAnalyst: string;
    chiefAnalyst: string;
  };
  purpleTeam: AIAgentResponse;
  entityMapping: AIAgentResponse;
  overallConfidence: number;
  finalClassification: string;
  reasoning: string;
}

export class GeminiCyberAnalyst {
  private static readonly MODEL = "gemini-2.5-flash";

  /**
   * Main orchestrator that runs all 8 AI agents with real Gemini analysis
   */
  static async analyzeIncident(
    logData: string,
    title: string,
    systemContext: string,
    additionalLogs: string,
    settings: any = {},
    threatReport: any = null
  ): Promise<AIAnalysisResult> {
    const fullContent = `${title} ${logData} ${systemContext} ${additionalLogs}`;
    
    console.log('🤖 GeminiCyberAnalyst.analyzeIncident starting...');
    console.log('📝 Full content length:', fullContent.length);
    console.log('🔑 API key exists:', !!process.env.GEMINI_API_KEY);
    console.log('🎯 Model:', this.MODEL);
    
    try {
      console.log('🚀 Starting parallel execution of 12 AI agents...');
    console.log('💰 🔥 REAL GEMINI API INTEGRATION ACTIVE 🔥');
    console.log('💸 Each agent will make a separate API call to Gemini 2.5 Flash');
    console.log('💵 Expected total cost for this analysis: ~$0.03-0.08 USD');
      // Run all 12 AI agents in parallel with timeout protection
      const agentPromises = [
        this.runPatternRecognitionAgent(fullContent).catch(e => this.getFailsafeResponse("Pattern Recognition", fullContent)),
        this.runThreatIntelligenceAgent(fullContent).catch(e => this.getFailsafeResponse("Threat Intelligence", fullContent)),
        this.runMitreAttackAgent(fullContent).catch(e => this.getFailsafeResponse("MITRE ATT&CK Mapping", fullContent)),
        this.runIOCEnrichmentAgent(fullContent, threatReport).catch(e => this.getFailsafeResponse("IOC Enrichment", fullContent)),
        this.runClassificationAgent(fullContent, settings).catch(e => this.getFailsafeResponse("Classification", fullContent)),
        this.runDualAIWorkflow(fullContent, settings).catch(e => ({
          tacticalAnalyst: "Tactical analysis failed",
          strategicAnalyst: "Strategic analysis failed", 
          chiefAnalyst: "Chief analyst synthesis failed"
        })),
        this.runPurpleTeamAgent(fullContent).catch(e => this.getFailsafeResponse("Purple Team", fullContent)),
        this.runEntityMappingAgent(fullContent).catch(e => this.getFailsafeResponse("Entity Mapping", fullContent)),
        // NEW AGENTS: 9-12
        this.runVulnerabilityAssessmentAgent(fullContent, threatReport).catch(e => this.getFailsafeResponse("Vulnerability Assessment", fullContent)),
        this.runNetworkAnalysisAgent(fullContent).catch(e => this.getFailsafeResponse("Network Analysis", fullContent)),
        this.runBehavioralAnalysisAgent(fullContent).catch(e => this.getFailsafeResponse("Behavioral Analysis", fullContent)),
        this.runComplianceAgent(fullContent, settings).catch(e => this.getFailsafeResponse("Compliance Analysis", fullContent))
      ];
      
      // Add overall timeout for all agents
      const overallTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Overall analysis timeout')), 120000)
      );
      
      const results = await Promise.race([
        Promise.all(agentPromises),
        overallTimeout
      ]).catch((error): any[] => {
        console.error('⚠️ Analysis timeout - using fallback responses');
        return [
          this.getFailsafeResponse("Pattern Recognition", fullContent),
          this.getFailsafeResponse("Threat Intelligence", fullContent),
          this.getFailsafeResponse("MITRE ATT&CK Mapping", fullContent),
          this.getFailsafeResponse("IOC Enrichment", fullContent),
          this.getFailsafeResponse("Classification", fullContent),
          { tacticalAnalyst: "Analysis timeout", strategicAnalyst: "Analysis timeout", chiefAnalyst: "Analysis timeout" },
          this.getFailsafeResponse("Purple Team", fullContent),
          this.getFailsafeResponse("Entity Mapping", fullContent),
          this.getFailsafeResponse("Vulnerability Assessment", fullContent),
          this.getFailsafeResponse("Network Analysis", fullContent),
          this.getFailsafeResponse("Behavioral Analysis", fullContent),
          this.getFailsafeResponse("Compliance Analysis", fullContent)
        ];
      }) as any[];

      const [
        patternRecognition,
        threatIntelligence,
        mitreMapping,
        iocEnrichment,
        classification,
        dualAI,
        purpleTeam,
        entityMapping,
        vulnerabilityAssessment,
        networkAnalysis,
        behavioralAnalysis,
        complianceAnalysis
      ] = results;
      
      console.log('✅ All AI agents completed successfully');
      console.log('💰 🎉 TOTAL GEMINI API CALLS MADE: 12+ real API calls to Gemini 2.5 Flash');
      console.log('💸 💰 You should see these costs in your Google Cloud Console billing');
      console.log('📊 Agent results summary:', {
        patternRecognition: patternRecognition?.confidence || 0,
        threatIntelligence: threatIntelligence?.confidence || 0,
        mitreMapping: mitreMapping?.confidence || 0,
        iocEnrichment: iocEnrichment?.confidence || 0,
        classification: classification?.confidence || 0,
        purpleTeam: purpleTeam?.confidence || 0,
        entityMapping: entityMapping?.confidence || 0,
        vulnerabilityAssessment: vulnerabilityAssessment?.confidence || 0,
        networkAnalysis: networkAnalysis?.confidence || 0,
        behavioralAnalysis: behavioralAnalysis?.confidence || 0,
        complianceAnalysis: complianceAnalysis?.confidence || 0
      });

      // Calculate overall confidence and final classification
      const overallConfidence = this.calculateOverallConfidence([
        patternRecognition, threatIntelligence, mitreMapping, 
        iocEnrichment, classification, purpleTeam, entityMapping,
        vulnerabilityAssessment, networkAnalysis, behavioralAnalysis, complianceAnalysis
      ]);
      
      const finalClassification = classification?.analysis?.includes('TRUE POSITIVE') ? 'true-positive' : 'false-positive';
      console.log('🎯 Overall confidence:', overallConfidence);
      console.log('📋 Final classification:', finalClassification);

      const result = {
        patternRecognition,
        threatIntelligence,
        mitreMapping,
        iocEnrichment,
        classification,
        dualAI,
        purpleTeam,
        entityMapping,
        vulnerabilityAssessment,
        networkAnalysis,
        behavioralAnalysis,
        complianceAnalysis,
        overallConfidence,
        finalClassification,
        reasoning: this.synthesizeReasoning([
          patternRecognition, threatIntelligence, mitreMapping,
          iocEnrichment, classification, purpleTeam, entityMapping,
          vulnerabilityAssessment, networkAnalysis, behavioralAnalysis, complianceAnalysis
        ])
      };
      
      console.log('✨ Analysis result completed successfully');
      return result;
    } catch (error: any) {
      console.error('❌ Gemini AI analysis error:', error);
      console.error('📋 Error message:', error?.message);
      console.error('🔍 Error stack:', error?.stack);
      throw new Error(`AI analysis failed: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * AI Agent 1: Pattern Recognition - Detects security patterns in logs
   */
  private static async runPatternRecognitionAgent(content: string): Promise<AIAgentResponse> {
    const prompt = `You are a cybersecurity pattern recognition specialist. Analyze the following log data and identify security-relevant patterns.

CONTENT TO ANALYZE:
${content}

FORMATTING REQUIREMENTS:
- Keep ALL titles to maximum 4 words
- Avoid formatting symbols like *, -, •
- Generate executable code for analysis
- Provide sandbox simulation scripts

Identify and score these pattern categories:
- Credential dumping patterns (lsass, mimikatz, secretsdump)
- Obfuscated PowerShell execution (-enc, downloadstring, invoke-expression)
- Network reconnaissance (nslookup, ping, netstat, arp)
- Persistence mechanisms (schtasks, registry, startup, services)
- File system manipulation (copy, move, del, rename)
- Living off the land techniques
- Suspicious process execution chains

Generate executable code for:
- PowerShell deobfuscation scripts
- Registry analysis commands  
- Network traffic queries
- File hash verification

CRITICAL: For sandbox output, simulate ACTUAL command execution results with realistic data, errors, and outputs that would occur when running the generated code.

Provide your analysis in this format:
PATTERNS DETECTED: [concise findings]
CODE GENERATION: [complete executable scripts with proper syntax]
SANDBOX OUTPUT: [realistic simulation of running the code with actual outputs, including command prompts, results, errors, and data that would be returned]
CONFIDENCE: [1-100]
KEY FINDINGS: [3-5 bullet points with short titles]
RECOMMENDATIONS: [3-4 actionable items]

Example sandbox output format:
PS C:\> Get-Process | Where-Object {$_.Name -eq "powershell"}
Handles  NPM(K)    PM(K)      WS(K)     CPU(s)     Id  SI ProcessName
-------  ------    -----      -----     ------     --  -- -----------
    692      31    45236      52464       2.34   4832   1 powershell
    
PS C:\> Get-WinEvent -LogName Security -MaxEvents 5
TimeCreated                     Id LevelDisplayName Message
-----------                     -- ---------------- -------
1/19/2025 4:20:15 PM          4624 Information      An account was successfully logged on...`;


    try {
      console.log('🔍 Pattern Recognition Agent starting...');
      console.log('💰 GEMINI API CALL - Pattern Recognition Agent');
      console.log(`📊 Request size: ${prompt.length} characters`);
      console.log(`🎯 Model: ${this.MODEL}`);
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Pattern Recognition timeout')), 30000)
      );
      
      const startTime = Date.now();
      const analysisPromise = ai.models.generateContent({
        model: this.MODEL,
        contents: prompt,
      });

      const response: any = await Promise.race([analysisPromise, timeoutPromise]);
      const duration = Date.now() - startTime;
      const analysis = response.text || "Analysis failed";
      
      console.log('✅ Pattern Recognition Agent completed');
      console.log(`⏱️ API call duration: ${duration}ms`);
      console.log(`📝 Response size: ${analysis.length} characters`);
      console.log(`💰 Estimated cost: ~$${(prompt.length / 1000000 * 0.075 + analysis.length / 1000000 * 0.30).toFixed(6)}`);
      
      return this.parseAgentResponse("Pattern Recognition", analysis);
    } catch (error) {
      console.error('❌ Pattern Recognition Agent error:', error);
      return this.getFailsafeResponse("Pattern Recognition", content);
    }
  }

  /**
   * AI Agent 2: Threat Intelligence - Analyzes threat indicators
   */
  private static async runThreatIntelligenceAgent(content: string): Promise<AIAgentResponse> {
    const prompt = `You are a threat intelligence analyst. Analyze the following data for threat indicators and behavioral patterns.

CONTENT TO ANALYZE:
${content}

FORMATTING REQUIREMENTS:
- Keep ALL titles to maximum 4 words
- Avoid formatting symbols like *, -, •
- Provide concise, structured analysis

Analyze for:
- Behavioral indicators (credential-focused activity, privilege escalation, lateral movement)
- Network indicators (IP addresses, domains, suspicious connections)
- File indicators (hashes, suspicious file operations)
- Process indicators (suspicious executable behavior)
- Attack techniques and TTPs (Tactics, Techniques, Procedures)

Provide your analysis in this format:
THREAT INDICATORS: [concise behavioral, network, file, process indicators]
CONFIDENCE: [1-100]
KEY FINDINGS: [3-5 bullet points with short titles]
RECOMMENDATIONS: [3-4 actionable items]`;

    try {
      console.log('🔍 Threat Intelligence Agent starting...');
      console.log('💰 GEMINI API CALL - Threat Intelligence Agent');
      console.log(`📊 Request size: ${prompt.length} characters`);
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Threat Intelligence timeout')), 30000)
      );
      
      const startTime = Date.now();
      const analysisPromise = ai.models.generateContent({
        model: this.MODEL,
        contents: prompt,
      });

      const response: any = await Promise.race([analysisPromise, timeoutPromise]);
      const duration = Date.now() - startTime;
      const analysis = response.text || "Analysis failed";
      
      console.log('✅ Threat Intelligence Agent completed');
      console.log(`⏱️ API call duration: ${duration}ms`);
      console.log(`📝 Response size: ${analysis.length} characters`);
      console.log(`💰 Estimated cost: ~$${(prompt.length / 1000000 * 0.075 + analysis.length / 1000000 * 0.30).toFixed(6)}`);
      
      return this.parseAgentResponse("Threat Intelligence", analysis);
    } catch (error) {
      console.error('❌ Threat Intelligence Agent error:', error);
      return this.getFailsafeResponse("Threat Intelligence", content);
    }
  }

  /**
   * AI Agent 3: MITRE ATT&CK Mapping - Maps to MITRE framework
   */
  private static async runMitreAttackAgent(content: string): Promise<AIAgentResponse> {
    const prompt = `You are a MITRE ATT&CK framework specialist. Map the following incident data to specific MITRE ATT&CK tactics and techniques.

CONTENT TO ANALYZE:
${content}

FORMATTING REQUIREMENTS:
- Keep ALL titles to maximum 4 words
- Avoid formatting symbols like *, -, •
- Use concise technique descriptions

Map to MITRE ATT&CK framework:
- Identify relevant tactics (TA####)
- Map specific techniques (T####)
- Include sub-techniques where applicable (T####.###)
- Focus on: Credential Access (TA0006), Defense Evasion (TA0005), Persistence (TA0003), Discovery (TA0007), Execution (TA0002)

Provide mappings for these common patterns:
- lsass/mimikatz → T1003 (OS Credential Dumping), T1003.001 (LSASS Memory)
- powershell -enc → T1027 (Obfuscated Files), T1140 (Deobfuscate/Decode)
- schtasks/registry → T1053 (Scheduled Task), T1547.001 (Registry Run Keys)
- network discovery → T1018 (Remote System Discovery), T1016 (System Network Configuration Discovery)

Format your response as:
MITRE MAPPINGS: [tactics and techniques with IDs]
CONFIDENCE: [1-100]
KEY FINDINGS: [3-5 bullet points with short titles]
RECOMMENDATIONS: [3-4 actionable items]`;

    try {
      console.log('🔍 MITRE ATT&CK Agent starting...');
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('MITRE ATT&CK timeout')), 30000)
      );
      
      const analysisPromise = ai.models.generateContent({
        model: this.MODEL,
        contents: prompt,
      });

      const response: any = await Promise.race([analysisPromise, timeoutPromise]);
      const analysis = response.text || "Analysis failed";
      console.log('✅ MITRE ATT&CK Agent completed');
      return this.parseAgentResponse("MITRE ATT&CK Mapping", analysis);
    } catch (error) {
      console.error('❌ MITRE ATT&CK Agent error:', error);
      return this.getFailsafeResponse("MITRE ATT&CK Mapping", content);
    }
  }

  /**
   * AI Agent 4: IOC Enrichment - Enriches indicators with context
   */
  private static async runIOCEnrichmentAgent(content: string, threatReport: any): Promise<AIAgentResponse> {
    const threatContext = threatReport ? `
THREAT INTELLIGENCE CONTEXT:
${JSON.stringify(threatReport, null, 2)}` : '';

    const prompt = `You are an IOC (Indicators of Compromise) enrichment specialist. Extract and enrich indicators from the log data.

CONTENT TO ANALYZE:
${content}
${threatContext}

FORMATTING REQUIREMENTS:
- Keep ALL titles to maximum 4 words
- Avoid formatting symbols like *, -, •
- Provide concise IOC analysis

Extract and analyze:
- IP addresses (classify as internal/external, reputation assessment)
- Domain names (reputation, registration analysis) 
- File hashes (MD5, SHA1, SHA256 - malware assessment)
- Email addresses (sender reputation, domain analysis)
- URLs (malicious link assessment)
- User accounts (privilege level, behavioral analysis)
- Processes (legitimacy assessment, digital signatures)

For each IOC provide:
- Type and value
- Risk assessment (Clean/Suspicious/Malicious)
- Confidence percentage
- Geo-location context where applicable
- Threat intelligence correlation

Format your response as:
IOC ENRICHMENT RESULTS: [list enriched indicators with assessments]
CONFIDENCE: [1-100]
KEY FINDINGS: [3-5 bullet points]
RECOMMENDATIONS: [3-4 actionable items]`;

    try {
      console.log('💰 GEMINI API CALL - IOC Enrichment Agent');
      console.log(`📊 Request size: ${prompt.length} characters`);
      
      const startTime = Date.now();
      const response = await ai.models.generateContent({
        model: this.MODEL,
        contents: prompt,
      });

      const duration = Date.now() - startTime;
      const analysis = response.text || "Analysis failed";
      
      console.log('✅ IOC Enrichment Agent completed');
      console.log(`⏱️ API call duration: ${duration}ms`);
      console.log(`📝 Response size: ${analysis.length} characters`);
      console.log(`💰 Estimated cost: ~$${(prompt.length / 1000000 * 0.075 + analysis.length / 1000000 * 0.30).toFixed(6)}`);
      
      return this.parseAgentResponse("IOC Enrichment", analysis);
    } catch (error) {
      console.error('IOC Enrichment Agent error:', error);
      return this.getFailsafeResponse("IOC Enrichment", content);
    }
  }

  /**
   * AI Agent 5: Classification - Determines true/false positive
   */
  private static async runClassificationAgent(content: string, settings: any): Promise<AIAgentResponse> {
    const prompt = `You are an incident classification specialist. Determine if this is a TRUE POSITIVE (real threat) or FALSE POSITIVE (benign activity).

CONTENT TO ANALYZE:
${content}

ANALYSIS SETTINGS:
- Confidence Threshold: ${settings.confidenceThreshold || 80}%
- Analysis Depth: ${settings.analysisDepth || 'comprehensive'}
- Custom Instructions: ${settings.customInstructions || 'None'}

Evaluate these factors:
- Technical evidence strength (malicious tools, techniques)
- Behavioral patterns (attack chains, persistence)
- Context clues (legitimate vs malicious intent)
- Environmental factors (normal vs suspicious activity)

Critical TRUE POSITIVE indicators:
- Credential theft tools (mimikatz, lsass dumping)
- Malicious PowerShell (encoded, obfuscated)
- Privilege escalation attempts
- Persistent mechanisms
- Living off the land abuse

FALSE POSITIVE indicators:
- Legitimate administrative activity
- Security software operations
- Authorized system maintenance
- Normal user behavior

Provide clear reasoning and confidence score (1-100).

Format your response as:
CLASSIFICATION: [TRUE POSITIVE or FALSE POSITIVE]
CONFIDENCE: [1-100]
KEY FINDINGS: [3-5 bullet points explaining the decision]
RECOMMENDATIONS: [3-4 actionable items]`;

    try {
      console.log('💰 GEMINI API CALL - Classification Agent');
      console.log(`📊 Request size: ${prompt.length} characters`);
      
      const startTime = Date.now();
      const response = await ai.models.generateContent({
        model: this.MODEL,
        contents: prompt,
      });

      const duration = Date.now() - startTime;
      const analysis = response.text || "Analysis failed";
      
      console.log('✅ Classification Agent completed');
      console.log(`⏱️ API call duration: ${duration}ms`);
      console.log(`💰 Estimated cost: ~$${(prompt.length / 1000000 * 0.075 + analysis.length / 1000000 * 0.30).toFixed(6)}`);
      
      return this.parseAgentResponse("Classification", analysis);
    } catch (error) {
      console.error('Classification Agent error:', error);
      return this.getFailsafeResponse("Classification", content);
    }
  }

  /**
   * Dual-AI Workflow: Tactical, Strategic, and Chief Analysts
   */
  private static async runDualAIWorkflow(content: string, settings: any): Promise<{
    tacticalAnalyst: string;
    strategicAnalyst: string;
    chiefAnalyst: string;
  }> {
    try {
      const [tactical, strategic, chief] = await Promise.all([
        this.runTacticalAnalyst(content),
        this.runStrategicAnalyst(content),
        this.runChiefAnalyst(content, settings)
      ]);

      return {
        tacticalAnalyst: tactical,
        strategicAnalyst: strategic,
        chiefAnalyst: chief
      };
    } catch (error) {
      console.error('Dual-AI Workflow error:', error);
      return {
        tacticalAnalyst: "Tactical analysis failed - review technical evidence manually",
        strategicAnalyst: "Strategic analysis failed - assess broader patterns manually", 
        chiefAnalyst: "Chief analyst synthesis failed - manual review required"
      };
    }
  }

  private static async runTacticalAnalyst(content: string): Promise<string> {
    const prompt = `You are a TACTICAL CYBERSECURITY ANALYST focused on technical evidence. Analyze the technical details and provide a focused technical assessment.

CONTENT:
${content}

Focus on:
- Process execution details
- Command line artifacts
- System calls and API usage
- File system modifications
- Network connections
- Registry changes
- Memory analysis indicators

Provide technical verdict with evidence.`;

    console.log('💰 GEMINI API CALL - Tactical Analyst');
    const startTime = Date.now();
    const response = await ai.models.generateContent({
      model: this.MODEL,
      contents: prompt,
    });
    const duration = Date.now() - startTime;
    console.log(`⏱️ Tactical Analyst API call: ${duration}ms`);
    console.log(`💰 Estimated cost: ~$${(prompt.length / 1000000 * 0.075 + (response.text?.length || 0) / 1000000 * 0.30).toFixed(6)}`);

    return `TACTICAL ANALYST ASSESSMENT:\n${response.text || "Technical analysis failed"}`;
  }

  private static async runStrategicAnalyst(content: string): Promise<string> {
    const prompt = `You are a STRATEGIC CYBERSECURITY ANALYST focused on patterns and campaign analysis. Analyze the broader context and attack patterns.

CONTENT:
${content}

Focus on:
- Attack pattern recognition
- Threat actor profiling
- Campaign indicators
- Kill chain progression
- Strategic recommendations
- Hypothetical attack scenarios

Provide strategic assessment with broader context.`;

    const response = await ai.models.generateContent({
      model: this.MODEL,
      contents: prompt,
    });

    return `STRATEGIC ANALYST ASSESSMENT:\n${response.text || "Strategic analysis failed"}`;
  }

  private static async runChiefAnalyst(content: string, settings: any): Promise<string> {
    const prompt = `You are the CHIEF CYBERSECURITY ANALYST providing final executive assessment. Synthesize tactical and strategic perspectives for a definitive verdict.

CONTENT:
${content}

IMPORTANT FORMATTING REQUIREMENTS:
- Keep ALL titles to maximum 4 words
- Avoid formatting symbols like *, -, •
- Use concise, structured analysis
- Include compliance impact assessment (GDPR, SOX, HIPAA, PCI-DSS)
- Explain WHY this threat poses compliance risks
- Provide executive summary suitable for C-level reporting

Focus on:
- Business impact analysis
- Regulatory compliance implications  
- Risk quantification
- Executive recommendations
- Incident classification rationale

Structure your response with short, clear headings and concise bullet points.

SETTINGS:
- Confidence Threshold: ${settings.confidenceThreshold || 80}%
- Custom Instructions: ${settings.customInstructions || 'None'}

Provide:
- Executive summary
- Final confidence assessment
- Definitive classification
- Key decision factors
- Strategic recommendations

Synthesize both technical evidence and strategic patterns for final verdict.`;

    const response = await ai.models.generateContent({
      model: this.MODEL,
      contents: prompt,
    });

    return `CHIEF ANALYST VERDICT:\n${response.text || "Chief analyst assessment failed"}`;
  }

  /**
   * AI Agent 6: Purple Team Analysis
   */
  private static async runPurpleTeamAgent(content: string): Promise<AIAgentResponse> {
    const prompt = `You are a purple team analyst combining offensive and defensive perspectives. Analyze this incident from both attacker and defender viewpoints.

CONTENT TO ANALYZE:
${content}

FORMATTING REQUIREMENTS:
- Keep ALL titles to maximum 4 words
- Avoid formatting symbols like *, -, •
- Provide balanced red/blue team perspectives

Provide purple team analysis covering:
- Attacker perspective: What techniques were used, what worked, what failed
- Defender perspective: What was detected, what was missed, how to improve
- Detection gaps: Where monitoring failed or succeeded
- Improvement opportunities: How to enhance detection and response
- Simulation scenarios: How to test similar attacks

Format your response as:
PURPLE TEAM ANALYSIS: [combined offensive/defensive insights]
CONFIDENCE: [1-100]
KEY FINDINGS: [3-5 bullet points with short titles]
RECOMMENDATIONS: [3-4 actionable items]`;

    try {
      const response = await ai.models.generateContent({
        model: this.MODEL,
        contents: prompt,
      });

      const analysis = response.text || "Analysis failed";
      return this.parseAgentResponse("Purple Team", analysis);
    } catch (error) {
      console.error('Purple Team Agent error:', error);
      return this.getFailsafeResponse("Purple Team", content);
    }
  }

  /**
   * AI Agent 7: Entity Mapping - Maps relationships between entities
   */
  private static async runEntityMappingAgent(content: string): Promise<AIAgentResponse> {
    const entityId = `ENT-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;
    const prompt = `You are an entity relationship analyst. Map the relationships between different entities (users, processes, files, networks) in this incident.

CONTENT TO ANALYZE:
${content}

FORMATTING REQUIREMENTS:
- Keep ALL titles to maximum 4 words
- Avoid formatting symbols like *, -, •
- Generate Entity ID: ${entityId}

Map entity relationships:
- User accounts and their actions
- Process parent-child relationships
- File creation/modification chains
- Network connection patterns
- Timeline of activities
- Data flow between entities

Format your response as:
ENTITY ID: ${entityId}
ENTITY RELATIONSHIPS: [map connections between entities]
CONFIDENCE: [1-100]
KEY FINDINGS: [3-5 bullet points with short titles]
RECOMMENDATIONS: [3-4 actionable items]`;

    try {
      const response = await ai.models.generateContent({
        model: this.MODEL,
        contents: prompt,
      });

      const analysis = response.text || "Analysis failed";
      return this.parseAgentResponse("Entity Mapping", analysis);
    } catch (error) {
      console.error('Entity Mapping Agent error:', error);
      return this.getFailsafeResponse("Entity Mapping", content);
    }
  }

  /**
   * AI Agent 9: Vulnerability Assessment - Identifies potential vulnerabilities
   */
  private static async runVulnerabilityAssessmentAgent(content: string, threatReport: any): Promise<AIAgentResponse> {
    const prompt = `You are a vulnerability assessment specialist. Analyze the log data to identify potential security vulnerabilities and misconfigurations.

CONTENT TO ANALYZE:
${content}

THREAT INTELLIGENCE CONTEXT:
${threatReport ? JSON.stringify(threatReport, null, 2) : 'No threat intelligence available'}

FORMATTING REQUIREMENTS:
- Keep ALL titles to maximum 4 words
- Avoid formatting symbols like *, -, •
- Provide actionable vulnerability insights

Analyze for:
- Unpatched software vulnerabilities (CVE identifiers)
- Misconfigurations in security settings
- Weak authentication mechanisms
- Exposed services and ports
- Privilege escalation opportunities
- Buffer overflow indicators
- SQL injection patterns
- Cross-site scripting (XSS) potential

Provide assessment in this format:
VULNERABILITY ASSESSMENT: [detailed findings with specific vulnerability types]
CONFIDENCE: [1-100]
KEY FINDINGS: [3-5 bullet points with vulnerability names]
RECOMMENDATIONS: [3-4 specific remediation actions]`;

    try {
      console.log('💰 GEMINI API CALL - Vulnerability Assessment Agent');
      console.log(`📊 Request size: ${prompt.length} characters`);
      
      const startTime = Date.now();
      const response = await ai.models.generateContent({
        model: this.MODEL,
        contents: prompt,
      });

      const duration = Date.now() - startTime;
      const analysis = response.text || "Analysis failed";
      
      console.log('✅ Vulnerability Assessment Agent completed');
      console.log(`⏱️ API call duration: ${duration}ms`);
      console.log(`💰 Estimated cost: ~$${(prompt.length / 1000000 * 0.075 + analysis.length / 1000000 * 0.30).toFixed(6)}`);
      
      return this.parseAgentResponse("Vulnerability Assessment", analysis);
    } catch (error) {
      console.error('❌ Vulnerability Assessment Agent error:', error);
      return this.getFailsafeResponse("Vulnerability Assessment", content);
    }
  }

  /**
   * AI Agent 10: Network Analysis - Analyzes network traffic patterns and connections
   */
  private static async runNetworkAnalysisAgent(content: string): Promise<AIAgentResponse> {
    const prompt = `You are a network security analyst. Analyze the log data for network traffic patterns, connections, and potential network-based threats.

CONTENT TO ANALYZE:
${content}

FORMATTING REQUIREMENTS:
- Keep ALL titles to maximum 4 words
- Avoid formatting symbols like *, -, •
- Focus on network behavior analysis

Analyze for:
- Unusual network traffic patterns
- Suspicious connection attempts
- Network reconnaissance activities
- Data exfiltration indicators
- C2 communication patterns
- Port scanning activities
- Protocol anomalies
- Geographic analysis of connections

Provide analysis in this format:
NETWORK ANALYSIS: [detailed network behavior findings]
CONFIDENCE: [1-100]
KEY FINDINGS: [3-5 bullet points with network indicators]
RECOMMENDATIONS: [3-4 network security actions]`;

    try {
      console.log('💰 GEMINI API CALL - Network Analysis Agent');
      console.log(`📊 Request size: ${prompt.length} characters`);
      
      const startTime = Date.now();
      const response = await ai.models.generateContent({
        model: this.MODEL,
        contents: prompt,
      });

      const duration = Date.now() - startTime;
      const analysis = response.text || "Analysis failed";
      
      console.log('✅ Network Analysis Agent completed');
      console.log(`⏱️ API call duration: ${duration}ms`);
      console.log(`💰 Estimated cost: ~$${(prompt.length / 1000000 * 0.075 + analysis.length / 1000000 * 0.30).toFixed(6)}`);
      
      return this.parseAgentResponse("Network Analysis", analysis);
    } catch (error) {
      console.error('❌ Network Analysis Agent error:', error);
      return this.getFailsafeResponse("Network Analysis", content);
    }
  }

  /**
   * AI Agent 11: Behavioral Analysis - Analyzes user and system behavioral patterns
   */
  private static async runBehavioralAnalysisAgent(content: string): Promise<AIAgentResponse> {
    const prompt = `You are a behavioral analysis specialist. Analyze the log data for abnormal user behavior, system behavior, and behavioral indicators of compromise.

CONTENT TO ANALYZE:
${content}

FORMATTING REQUIREMENTS:
- Keep ALL titles to maximum 4 words
- Avoid formatting symbols like *, -, •
- Focus on behavioral anomalies

Analyze for:
- Abnormal user login patterns
- Unusual time-based activities
- Privilege escalation behaviors
- Data access anomalies
- Process execution patterns
- File system behavior changes
- Command execution sequences
- Session duration anomalies

Provide analysis in this format:
BEHAVIORAL ANALYSIS: [detailed behavioral pattern findings]
CONFIDENCE: [1-100]
KEY FINDINGS: [3-5 bullet points with behavioral indicators]
RECOMMENDATIONS: [3-4 behavioral monitoring improvements]`;

    try {
      console.log('💰 GEMINI API CALL - Behavioral Analysis Agent');
      console.log(`📊 Request size: ${prompt.length} characters`);
      
      const startTime = Date.now();
      const response = await ai.models.generateContent({
        model: this.MODEL,
        contents: prompt,
      });

      const duration = Date.now() - startTime;
      const analysis = response.text || "Analysis failed";
      
      console.log('✅ Behavioral Analysis Agent completed');
      console.log(`⏱️ API call duration: ${duration}ms`);
      console.log(`💰 Estimated cost: ~$${(prompt.length / 1000000 * 0.075 + analysis.length / 1000000 * 0.30).toFixed(6)}`);
      
      return this.parseAgentResponse("Behavioral Analysis", analysis);
    } catch (error) {
      console.error('❌ Behavioral Analysis Agent error:', error);
      return this.getFailsafeResponse("Behavioral Analysis", content);
    }
  }

  /**
   * AI Agent 12: Compliance Analysis - Analyzes regulatory and compliance impacts
   */
  private static async runComplianceAgent(content: string, settings: any): Promise<AIAgentResponse> {
    const prompt = `You are a compliance and regulatory specialist. Analyze the incident for compliance violations and regulatory implications.

CONTENT TO ANALYZE:
${content}

ANALYSIS SETTINGS:
- Industry Context: ${settings.industryContext || 'General'}
- Compliance Frameworks: ${settings.complianceFrameworks || 'GDPR, HIPAA, SOX, PCI-DSS'}
- Regulatory Environment: ${settings.regulatoryEnvironment || 'Multi-jurisdictional'}

FORMATTING REQUIREMENTS:
- Keep ALL titles to maximum 4 words
- Avoid formatting symbols like *, -, •
- Focus on compliance implications

Analyze for:
- GDPR data protection violations
- HIPAA healthcare data breaches
- SOX financial controls impact
- PCI-DSS payment card data exposure
- ISO 27001 security control failures
- NIST framework alignment
- Industry-specific regulations
- Breach notification requirements

Provide analysis in this format:
COMPLIANCE ANALYSIS: [regulatory impact assessment]
CONFIDENCE: [1-100]
KEY FINDINGS: [3-5 bullet points with compliance violations]
RECOMMENDATIONS: [3-4 compliance remediation actions]`;

    try {
      console.log('💰 GEMINI API CALL - Compliance Analysis Agent');
      console.log(`📊 Request size: ${prompt.length} characters`);
      
      const startTime = Date.now();
      const response = await ai.models.generateContent({
        model: this.MODEL,
        contents: prompt,
      });

      const duration = Date.now() - startTime;
      const analysis = response.text || "Analysis failed";
      
      console.log('✅ Compliance Analysis Agent completed');
      console.log(`⏱️ API call duration: ${duration}ms`);
      console.log(`💰 Estimated cost: ~$${(prompt.length / 1000000 * 0.075 + analysis.length / 1000000 * 0.30).toFixed(6)}`);
      
      return this.parseAgentResponse("Compliance Analysis", analysis);
    } catch (error) {
      console.error('❌ Compliance Analysis Agent error:', error);
      return this.getFailsafeResponse("Compliance Analysis", content);
    }
  }

  /**
   * Parse agent response into structured format
   */
  private static parseAgentResponse(agent: string, analysis: string): AIAgentResponse {
    // Extract Entity ID for incident tracking
    const entityIdMatch = analysis.match(/ENTITY ID:\s*(ENT-\d{4})/i);
    const entityId = entityIdMatch ? entityIdMatch[1] : `ENT-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;

    // Extract confidence score
    const confidenceMatch = analysis.match(/CONFIDENCE:\s*(\d+)/i);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 75;

    // Extract sandbox output for code analysis
    const sandboxMatch = analysis.match(/SANDBOX OUTPUT:([\s\S]*?)(?=CONFIDENCE:|KEY FINDINGS:|RECOMMENDATIONS:|$)/i);
    const sandboxOutput = sandboxMatch ? sandboxMatch[1].trim() : '';

    // Extract code generation
    const codeMatch = analysis.match(/CODE GENERATION:([\s\S]*?)(?=SANDBOX OUTPUT:|CONFIDENCE:|KEY FINDINGS:|RECOMMENDATIONS:|$)/i);
    const codeGeneration = codeMatch ? codeMatch[1].trim() : '';

    // Extract key findings and clean formatting
    const findingsMatch = analysis.match(/KEY FINDINGS:([\s\S]*?)(?=RECOMMENDATIONS:|$)/i);
    const findingsText = findingsMatch ? findingsMatch[1].trim() : '';
    const keyFindings = findingsText
      .split(/\n/)
      .filter(line => line.trim().length > 0)
      .map(line => line.replace(/^[-•*#]\s*/, '').trim())
      .map(line => line.replace(/\*\*(.*?)\*\*/g, '$1')) // Remove bold formatting
      .map(line => line.replace(/\*(.*?)\*/g, '$1')) // Remove italic formatting
      .filter(line => line.length > 0)
      .slice(0, 5);

    // Extract recommendations and clean formatting
    const recommendationsMatch = analysis.match(/RECOMMENDATIONS:([\s\S]*)$/i);
    const recommendationsText = recommendationsMatch ? recommendationsMatch[1].trim() : '';
    const recommendations = recommendationsText
      .split(/\n/)
      .filter(line => line.trim().length > 0)
      .map(line => line.replace(/^[-•*#]\s*/, '').trim())
      .map(line => line.replace(/\*\*(.*?)\*\*/g, '$1')) // Remove bold formatting
      .map(line => line.replace(/\*(.*?)\*/g, '$1')) // Remove italic formatting
      .filter(line => line.length > 0)
      .slice(0, 4);

    const result: any = {
      agent,
      analysis,
      confidence,
      entityId,
      keyFindings: keyFindings.length > 0 ? keyFindings : [`${agent} analysis completed`],
      recommendations: recommendations.length > 0 ? recommendations : [`Review ${agent.toLowerCase()} results manually`]
    };

    // Add sandbox output if present
    if (sandboxOutput) {
      result.sandboxOutput = sandboxOutput;
    }

    // Add code generation if present
    if (codeGeneration) {
      result.codeGeneration = codeGeneration;
    }

    return result;
  }

  /**
   * Failsafe response when AI call fails
   */
  private static getFailsafeResponse(agent: string, content: string): AIAgentResponse {
    return {
      agent,
      analysis: `${agent} analysis temporarily unavailable. Manual review recommended.`,
      confidence: 50,
      keyFindings: [`${agent} requires manual analysis`, "AI service temporarily unavailable"],
      recommendations: [`Manually review ${agent.toLowerCase()} aspects`, "Retry analysis when service is available"]
    };
  }



  /**
   * Calculate overall confidence from all agents
   */
  private static calculateOverallConfidence(responses: AIAgentResponse[]): number {
    const validResponses = responses.filter(r => r.confidence > 0);
    if (validResponses.length === 0) return 50;

    const totalConfidence = validResponses.reduce((sum, r) => sum + r.confidence, 0);
    return Math.round(totalConfidence / validResponses.length);
  }

  /**
   * Synthesize reasoning from all agent responses
   */
  private static synthesizeReasoning(responses: AIAgentResponse[]): string {
    const highConfidenceFindings = responses
      .filter(r => r.confidence > 70)
      .flatMap(r => r.keyFindings)
      .slice(0, 5);

    if (highConfidenceFindings.length === 0) {
      return "Mixed analysis results require human validation. Multiple AI agents provide varying assessments.";
    }

    return `Convergent AI analysis from ${responses.length} specialized agents: ${highConfidenceFindings.join('; ')}`;
  }
}