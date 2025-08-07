import { type User, type InsertUser, type Incident, type InsertIncident, type Settings, type InsertSettings } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getIncidents(): Promise<Incident[]>;
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
        title: "Credential Dumping via LSASS Access and Process Injection",
        severity: "high",
        status: "open",
        systemContext: "Domain controller handling authentication for 500+ users",
        logData: "Process injection detected on LSASS process",
        additionalLogs: null,
        classification: "true-positive",
        confidence: 95,
        mitreAttack: ["T1055", "T1003.001"],
        iocs: ["192.168.1.100", "malicious.exe"],
        aiAnalysis: "High-confidence detection of credential dumping attack using LSASS access patterns",
        createdAt: new Date("2025-08-07T07:50:00Z"),
        updatedAt: new Date("2025-08-07T07:50:00Z"),
      },
      {
        id: "inc-2", 
        title: "Suspicious PowerShell Execution with Obfuscated Payload and C2 Indicators",
        severity: "high",
        status: "open",
        systemContext: "Marketing workstation with access to customer database",
        logData: "PowerShell execution with base64 encoded payload",
        additionalLogs: null,
        classification: "true-positive",
        confidence: 95,
        mitreAttack: ["T1059.001", "T1027"],
        iocs: ["powershell.exe", "192.168.1.200"],
        aiAnalysis: "Obfuscated PowerShell script with C2 communication patterns detected",
        createdAt: new Date("2025-08-07T07:46:00Z"),
        updatedAt: new Date("2025-08-07T07:46:00Z"),
      },
      {
        id: "inc-3",
        title: "Hijack Execution Flow - DLL Side-Loading", 
        severity: "critical",
        status: "high",
        systemContext: "File server with sensitive financial data",
        logData: "Suspicious DLL loading pattern detected",
        additionalLogs: null,
        classification: "true-positive",
        confidence: 95,
        mitreAttack: ["T1574.002"],
        iocs: ["malicious.dll", "192.168.1.150"],
        aiAnalysis: "DLL side-loading attack targeting critical infrastructure",
        createdAt: new Date("2025-08-07T06:18:00Z"),
        updatedAt: new Date("2025-08-07T06:18:00Z"),
      },
      {
        id: "inc-4",
        title: "Malware Detected on IT Admin Workstation",
        severity: "medium",
        status: "open", 
        systemContext: "IT administrator workstation with elevated privileges",
        logData: "Antivirus detection of suspicious executable",
        additionalLogs: null,
        classification: "false-positive",
        confidence: 85,
        mitreAttack: [],
        iocs: ["false-positive.exe"],
        aiAnalysis: "False positive detection - legitimate administrative tool flagged",
        createdAt: new Date("2025-08-06T13:58:00Z"),
        updatedAt: new Date("2025-08-06T13:58:00Z"),
      },
      {
        id: "inc-5",
        title: "Unusual PowerShell Activity from Finance Department Machine",
        severity: "critical",
        status: "open",
        systemContext: "Finance department workstation with access to banking systems",
        logData: "PowerShell script execution outside normal business hours",
        additionalLogs: null,
        classification: "true-positive", 
        confidence: 95,
        mitreAttack: ["T1059.001"],
        iocs: ["192.168.1.75", "finance-ws-01"],
        aiAnalysis: "Suspicious PowerShell activity detected during off-hours on critical financial system",
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
