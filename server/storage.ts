import { type User, type InsertUser, type Incident, type InsertIncident, type Settings, type InsertSettings } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getIncidents(): Promise<Incident[]>;
  getUserIncidents(userId: string): Promise<Incident[]>;
  getIncident(id: string): Promise<Incident | undefined>;
  createIncident(incident: InsertIncident): Promise<Incident>;
  updateIncident(id: string, incident: Partial<Incident>): Promise<Incident | undefined>;
  deleteIncident(id: string): Promise<boolean>;
  
  getUserSettings(userId: string): Promise<Settings | undefined>;
  updateUserSettings(userId: string, settings: Partial<InsertSettings>): Promise<Settings>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private incidents: Map<string, Incident>;
  private settings: Map<string, Settings>;

  constructor() {
    this.users = new Map();
    this.incidents = new Map();
    this.settings = new Map();
    
    // Create a default user
    const defaultUser: User = {
      id: "default-user",
      username: "Marcel Seiler",
      password: "password"
    };
    this.users.set(defaultUser.id, defaultUser);
    
    // Create default settings
    const defaultSettings: Settings = {
      id: "default-settings",
      userId: "default-user",
      analysisDepth: "comprehensive",
      confidenceThreshold: 80,
      enableDualAI: true,
      autoSeverityAdjustment: false,
      customInstructions: null,
      theme: "dark",
      sessionTimeout: 480,
      compactView: false,
      autoRefresh: false,
      requireComments: false,
      emailNotifications: false,
      highSeverityAlerts: false,
    };
    this.settings.set(defaultUser.id, defaultSettings);

    // Create sample incidents
    const sampleIncidents: Incident[] = [
      {
        id: "inc-1",
        userId: "default-user",
        title: "Credential Dumping via LSASS Access and Process Injection",
        severity: "high",
        status: "open",
        systemContext: "Domain controller handling authentication for 500+ users",
        logData: "Process injection detected on LSASS process",
        additionalLogs: null,
        classification: "true-positive",
        confidence: 95,
        aiInvestigation: 85,
        mitreAttack: ["T1055", "T1003.001"],
        iocs: ["192.168.1.100", "malicious.exe"],
        aiAnalysis: "High-confidence detection of credential dumping attack using LSASS access patterns",
        analysisExplanation: "A credential harvesting attack was executed by dumping the LSASS memory through procdump.exe. The logs indicate a high frequency of suspicious process creation attempts, predominantly targeting LSASS, with indicators of obfuscation and potential sandbox evasion. The attack is characterized by a clear pattern indicative of automated script execution for credential extraction. The associated IP and domain are well-documented in threat intelligence as malicious.",
        mitreDetails: JSON.stringify({
          tactics: [
            { id: "TA0001", name: "Initial Access", description: "The technique involves exploiting a legitimate process to gain entry into a system." },
            { id: "TA0002", name: "Execution", description: "The execution of malicious code in order to perform harmful actions within a target system." },
            { id: "TA0011", name: "Command and Control", description: "The use of controlled communications between compromised systems and the malicious actor." }
          ],
          techniques: [
            { id: "T1203", name: "Exploitation for Client Execution", description: "Exploit vulnerabilities in client applications to execute arbitrary code." },
            { id: "T1071", name: "Application Layer Protocol", description: "Use application layer protocols to communicate over a channel to evade detection." }
          ]
        }),
        iocDetails: JSON.stringify([
          {
            type: "IP",
            value: "192.168.68.173",
            reputation: "Internal network",
            geoLocation: "Local Network",
            threatIntelligence: "Identified as originating from a low integrity process.",
            confidence: "high"
          },
          {
            type: "MD5",
            value: "447b73fb96095c6daab4805632a8e9c1",
            reputation: "unknown",
            geoLocation: "N/A",
            threatIntelligence: "Hash matched against known DLL side-loading techniques.",
            confidence: "high"
          },
          {
            type: "MD5",
            value: "953c1b6e52d20fff6925bb6e72c925de",
            reputation: "unknown",
            geoLocation: "N/A",
            threatIntelligence: "Hash associated with suspicious file execution patterns.",
            confidence: "high"
          }
        ]),
        patternAnalysis: JSON.stringify([
          {
            pattern: "High frequency of file creation by a high integrity process",
            significance: "2x",
            description: "Frequent creation of DLL files by the same process suggest a potential automated malicious activity."
          },
          {
            pattern: "Low integrity process creating files accessed by high integrity",
            significance: "1x",
            description: "The creation of these DLLs by a medium integrity process (Explorer.EXE) could indicate suspicious activity."
          }
        ]),
        purpleTeam: JSON.stringify({
          redTeam: [
            {
              scenario: "DLL Search and Replace",
              steps: "Identify legitimate DLL paths, replace with malicious variants, execute under high integrity.",
              expectedOutcome: "DLL hijacking leads to execution of malicious code with elevated privileges."
            },
            {
              scenario: "Process Injection",
              steps: "Inject code into the explorer.exe process to manipulate file operations.",
              expectedOutcome: "Control over high integrity operations without need for a separate executable."
            }
          ],
          blueTeam: [
            {
              defense: "Monitor for FileCreate events in sensitive directories",
              priority: "High Priority",
              description: "Log creation of DLL files in directories not typically associated with legitimate software.",
              technical: "Implement file monitoring tools to alert on changes in paths like c:\\eurotax\\upd\\.",
              verification: "Review logs for unusual timestamps and processes making changes."
            },
            {
              defense: "Implement Application Whitelisting",
              priority: "Medium Priority",
              description: "Restrict the execution of DLLs to only those that are approved and signed by trusted publishers.",
              technical: "Use Windows Defender Application Control to enforce whitelisting policies.",
              verification: "Audit execution logs for any unauthorized DLLs executed."
            }
          ]
        }),
        entityMapping: JSON.stringify({
          entities: [
            { id: "explorer.exe", type: "PROCESS", category: "process" },
            { id: "etgupdater.exe", type: "PROCESS", category: "process" },
            { id: "goeoperator", type: "USER", category: "user" },
            { id: "a000s81.a000d.greconet.at", type: "HOST", category: "host" },
            { id: "etgupdcommon.dll", type: "FILE", category: "file" },
            { id: "bitsupd.dll", type: "FILE", category: "file" }
          ],
          relationships: [
            { source: "etgupdater.exe", action: "Creates", target: "etgupdcommon.dll" },
            { source: "etgupdater.exe", action: "Creates", target: "bitsupd.dll" },
            { source: "explorer.exe", action: "Initiates", target: "etgupdater.exe" },
            { source: "goeoperator", action: "Executes", target: "explorer.exe" },
            { source: "a000s81.a000d.greconet.at", action: "Runs", target: "explorer.exe" }
          ],
          networkTopology: [
            { entity: "explorer.exe", risk: 3 },
            { entity: "etgupdater.exe", risk: 3 },
            { entity: "goeoperator", risk: 1 },
            { entity: "a000s81.a000d.greconet.at", risk: 1 },
            { entity: "etgupdcommon.dll", risk: 1 },
            { entity: "bitsupd.dll", risk: 1 }
          ]
        }),
        codeAnalysis: JSON.stringify({
          summary: "The analyzed DLLs did not exhibit overt malicious patterns but are in suspicious directories and created by a lower integrity process. Careful monitoring advised.",
          language: "C/C++",
          findings: [],
          sandboxOutput: "The outputs of the DLLs suggest normal behavior when run in isolation. However, observed behavior during integration with explorer.exe must be monitored."
        }),
        attackVectors: JSON.stringify([
          {
            vector: "DLL Side-Loading",
            likelihood: "High Likelihood",
            description: "High integrity processes load potentially malicious DLLs that have been modified or created by lower integrity processes."
          },
          {
            vector: "Malicious Process Impersonation",
            likelihood: "Medium Likelihood",
            description: "A legitimate process (e.g., explorer.exe) is being used to execute unauthorized actions by a potential attacker."
          },
          {
            vector: "Privilege Escalation via User Context",
            likelihood: "Medium Likelihood",
            description: "Execution of the DLLs by a process running under a high integrity level (System), possibly exploiting a user process to elevate privileges."
          }
        ]),
        complianceImpact: JSON.stringify([
          {
            framework: "GDPR",
            article: "Article 32",
            impact: "Impact Level",
            description: "Potential exposure of personal data if the DLLs are compromised, leading to insufficient security measures."
          },
          {
            framework: "PCI-DSS",
            requirement: "Requirement 10",
            impact: "Impact Level",
            description: "Logging inadequate or possible manipulation affecting the traceability of secure transactions."
          },
          {
            recommendation: "Consult with your compliance team and legal department to assess the full impact of this incident. Document all remediation actions taken and consider whether breach notification requirements apply."
          }
        ]),
        similarIncidents: JSON.stringify([
          {
            title: "Malware Detected on IT Admin Workstation",
            match: "75% Match",
            patterns: ["Malware observed", "Indicators of compromise (IOCs) related to execution", "Suspicious file paths and behaviors"],
            analysis: "Both incidents involve malware detection with high confidence indicators, although the specific techniques and file paths differ."
          },
          {
            title: "Unusual PowerShell Activity from Finance Department Machine",
            match: "70% Match",
            patterns: ["Use of known malicious IPs", "Suspicious behavior patterns involving remote communication", "Application layer protocol usage"],
            analysis: "Similarities in communication patterns and suspicious activity contexts suggest that both incidents may have involved compromised integrity affecting internal processes."
          },
          {
            title: "Security principal reconnaissance (LDAP)",
            match: "65% Match",
            patterns: ["Malicious intent to explore system vulnerabilities", "Analysis of internal architecture and user access"],
            analysis: "While the techniques differ, both incidents indicate attempts to exploit system vulnerabilities for unauthorized access, reflecting persistent threats to network integrity."
          }
        ]),
        comments: [],
        createdAt: new Date("2025-08-07T07:50:00Z"),
        updatedAt: new Date("2025-08-07T07:50:00Z"),
      },
      {
        id: "inc-2",
        userId: "default-user",
        title: "Suspicious PowerShell Execution with Obfuscated Payload and C2 Indicators",
        severity: "high",
        status: "open",
        systemContext: "Marketing workstation with access to customer database",
        logData: "PowerShell execution with base64 encoded payload",
        additionalLogs: null,
        classification: "true-positive",
        confidence: 95,
        aiInvestigation: 85,
        mitreAttack: ["T1059.001", "T1027"],
        iocs: ["powershell.exe", "192.168.1.200"],
        aiAnalysis: "Obfuscated PowerShell script with C2 communication patterns detected",
        analysisExplanation: "Malicious PowerShell activity detected with high confidence indicators of command and control communication.",
        mitreDetails: JSON.stringify({ tactics: [], techniques: [] }),
        iocDetails: JSON.stringify([]),
        patternAnalysis: JSON.stringify([]),
        purpleTeam: JSON.stringify({ redTeam: [], blueTeam: [] }),
        entityMapping: JSON.stringify({ entities: [], relationships: [], networkTopology: [] }),
        codeAnalysis: JSON.stringify({ summary: "", language: "", findings: [], sandboxOutput: "" }),
        attackVectors: JSON.stringify([]),
        complianceImpact: JSON.stringify([]),
        similarIncidents: JSON.stringify([]),
        comments: [],
        createdAt: new Date("2025-08-07T07:46:00Z"),
        updatedAt: new Date("2025-08-07T07:46:00Z"),
      },
      {
        id: "inc-3",
        userId: "default-user",
        title: "Hijack Execution Flow - DLL Side-Loading", 
        severity: "critical",
        status: "open",
        systemContext: "File server with sensitive financial data",
        logData: "Suspicious DLL loading pattern detected",
        additionalLogs: null,
        classification: "true-positive",
        confidence: 95,
        aiInvestigation: 95,
        mitreAttack: ["T1574.002"],
        iocs: ["malicious.dll", "192.168.1.150"],
        aiAnalysis: "DLL side-loading attack targeting critical infrastructure",
        analysisExplanation: "Critical DLL side-loading attack detected on financial server infrastructure.",
        mitreDetails: JSON.stringify({ tactics: [], techniques: [] }),
        iocDetails: JSON.stringify([]),
        patternAnalysis: JSON.stringify([]),
        purpleTeam: JSON.stringify({ redTeam: [], blueTeam: [] }),
        entityMapping: JSON.stringify({ entities: [], relationships: [], networkTopology: [] }),
        codeAnalysis: JSON.stringify({ summary: "", language: "", findings: [], sandboxOutput: "" }),
        attackVectors: JSON.stringify([]),
        complianceImpact: JSON.stringify([]),
        similarIncidents: JSON.stringify([]),
        comments: [],
        createdAt: new Date("2025-08-07T06:18:00Z"),
        updatedAt: new Date("2025-08-07T06:18:00Z"),
      },
      {
        id: "inc-4",
        userId: "default-user",
        title: "Malware Detected on IT Admin Workstation",
        severity: "medium",
        status: "open", 
        systemContext: "IT administrator workstation with elevated privileges",
        logData: "Antivirus detection of suspicious executable",
        additionalLogs: null,
        classification: "false-positive",
        confidence: 85,
        aiInvestigation: 75,
        mitreAttack: [],
        iocs: ["false-positive.exe"],
        aiAnalysis: "False positive detection - legitimate administrative tool flagged",
        analysisExplanation: "Administrative tool incorrectly flagged by antivirus system.",
        mitreDetails: JSON.stringify({ tactics: [], techniques: [] }),
        iocDetails: JSON.stringify([]),
        patternAnalysis: JSON.stringify([]),
        purpleTeam: JSON.stringify({ redTeam: [], blueTeam: [] }),
        entityMapping: JSON.stringify({ entities: [], relationships: [], networkTopology: [] }),
        codeAnalysis: JSON.stringify({ summary: "", language: "", findings: [], sandboxOutput: "" }),
        attackVectors: JSON.stringify([]),
        complianceImpact: JSON.stringify([]),
        similarIncidents: JSON.stringify([]),
        comments: [],
        createdAt: new Date("2025-08-06T13:58:00Z"),
        updatedAt: new Date("2025-08-06T13:58:00Z"),
      },
      {
        id: "inc-5",
        userId: "default-user",
        title: "Unusual PowerShell Activity from Finance Department Machine",
        severity: "critical",
        status: "open",
        systemContext: "Finance department workstation with access to banking systems",
        logData: "PowerShell script execution outside normal business hours",
        additionalLogs: null,
        classification: "true-positive", 
        confidence: 95,
        aiInvestigation: 90,
        mitreAttack: ["T1059.001"],
        iocs: ["192.168.1.75", "finance-ws-01"],
        aiAnalysis: "Suspicious PowerShell activity detected during off-hours on critical financial system",
        analysisExplanation: "After-hours PowerShell execution on critical financial infrastructure.",
        mitreDetails: JSON.stringify({ tactics: [], techniques: [] }),
        iocDetails: JSON.stringify([]),
        patternAnalysis: JSON.stringify([]),
        purpleTeam: JSON.stringify({ redTeam: [], blueTeam: [] }),
        entityMapping: JSON.stringify({ entities: [], relationships: [], networkTopology: [] }),
        codeAnalysis: JSON.stringify({ summary: "", language: "", findings: [], sandboxOutput: "" }),
        attackVectors: JSON.stringify([]),
        complianceImpact: JSON.stringify([]),
        similarIncidents: JSON.stringify([]),
        comments: [],
        createdAt: new Date("2025-08-06T13:47:00Z"),
        updatedAt: new Date("2025-08-06T13:47:00Z"),
      }
    ];

    sampleIncidents.forEach(incident => {
      this.incidents.set(incident.id, incident);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getIncidents(): Promise<Incident[]> {
    return Array.from(this.incidents.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getUserIncidents(userId: string): Promise<Incident[]> {
    return Array.from(this.incidents.values())
      .filter(incident => incident.userId === userId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getIncident(id: string): Promise<Incident | undefined> {
    return this.incidents.get(id);
  }

  async createIncident(insertIncident: InsertIncident): Promise<Incident> {
    const id = randomUUID();
    const now = new Date();
    const incident: Incident = { 
      ...insertIncident, 
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    this.incidents.set(id, incident);
    return incident;
  }

  async updateIncident(id: string, update: Partial<Incident>): Promise<Incident | undefined> {
    const incident = this.incidents.get(id);
    if (!incident) return undefined;
    
    const updated = { ...incident, ...update, updatedAt: new Date() };
    this.incidents.set(id, updated);
    return updated;
  }

  async deleteIncident(id: string): Promise<boolean> {
    return this.incidents.delete(id);
  }

  async getUserSettings(userId: string): Promise<Settings | undefined> {
    return this.settings.get(userId);
  }

  async updateUserSettings(userId: string, update: Partial<InsertSettings>): Promise<Settings> {
    const existing = this.settings.get(userId);
    const settings: Settings = {
      id: existing?.id || randomUUID(),
      userId,
      analysisDepth: "comprehensive",
      confidenceThreshold: 80,
      enableDualAI: true,
      autoSeverityAdjustment: false,
      customInstructions: null,
      theme: "dark",
      sessionTimeout: 480,
      compactView: false,
      autoRefresh: false,
      requireComments: false,
      emailNotifications: false,
      highSeverityAlerts: false,
      ...existing,
      ...update,
    };
    
    this.settings.set(userId, settings);
    return settings;
  }
}

export const storage = new MemStorage();
