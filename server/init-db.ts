import { db } from './db';
import { users, settings, incidents } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function initializeDatabase() {
  console.log('Initializing database...');
  
  try {
    // Check if default user exists
    const [existingUser] = await db.select().from(users).where(eq(users.id, 'default-user'));
    
    if (!existingUser) {
      // Create default user
      await db.insert(users).values({
        id: 'default-user',
        username: 'Marcel Seiler',
        password: 'password'
      });
      console.log('Default user created');
    }
    
    // Check if user settings exist
    const [existingSettings] = await db.select().from(settings).where(eq(settings.userId, 'default-user'));
    
    if (!existingSettings) {
      // Create default settings with email already configured
      await db.insert(settings).values({
        id: 'default-settings',
        userId: 'default-user',
        analysisDepth: 'comprehensive',
        enableDualAI: true,
        autoSeverityAdjustment: false,
        customInstructions: '',
        theme: 'dark',
        sessionTimeout: 480,
        compactView: false,
        autoRefresh: false,
        requireComments: false,
        emailNotifications: true, // Keep enabled as user configured
        emailAddress: 'seitlermarcel24@gmail.com', // Preserve user's email
        highSeverityAlerts: false
      });
      console.log('Default settings created with email configuration');
    } else {
      console.log('Settings already exist, preserving user configuration');
    }
    
    // Check if sample incidents exist
    const existingIncidents = await db.select().from(incidents).where(eq(incidents.userId, 'default-user'));
    
    if (existingIncidents.length === 0) {
      // Create sample incidents
      const sampleIncidents = [
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
          analysisExplanation: "A credential harvesting attack was executed by dumping the LSASS memory through procdump.exe."
        },
        {
          id: "inc-2",
          userId: "default-user",
          title: "Suspicious PowerShell Command Execution",
          severity: "critical",
          status: "open",
          systemContext: "Production web server",
          logData: "PowerShell.exe executed with encoded command",
          additionalLogs: "Base64 encoded payload detected",
          classification: "true-positive",
          confidence: 88,
          aiInvestigation: 92,
          mitreAttack: ["T1059.001", "T1027"],
          iocs: ["encoded-payload.ps1", "192.168.1.50"],
          aiAnalysis: "Detected obfuscated PowerShell command execution attempting to bypass security controls",
          analysisExplanation: "The PowerShell execution used Base64 encoding to hide malicious intent. The decoded payload shows attempts to download and execute remote code."
        },
        {
          id: "inc-3",
          userId: "default-user",
          title: "Anomalous Network Traffic to Unknown External IP",
          severity: "medium",
          status: "open",
          systemContext: "Database server",
          logData: "Outbound connection to suspicious IP address",
          additionalLogs: "Large data transfer detected",
          classification: "false-positive",
          confidence: 65,
          aiInvestigation: 70,
          mitreAttack: ["T1071", "T1048"],
          iocs: ["185.220.101.45"],
          aiAnalysis: "Unusual network communication pattern detected, potentially legitimate cloud backup",
          analysisExplanation: "While the traffic pattern is unusual, further investigation suggests this may be related to a scheduled cloud backup service."
        },
        {
          id: "inc-4",
          userId: "default-user",
          title: "Registry Persistence Mechanism Detected",
          severity: "high",
          status: "open",
          systemContext: "Executive workstation",
          logData: "Registry Run key modification detected",
          additionalLogs: "New autostart entry added",
          classification: "true-positive",
          confidence: 91,
          aiInvestigation: 88,
          mitreAttack: ["T1547.001", "T1112"],
          iocs: ["HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"],
          aiAnalysis: "Malware establishing persistence through Windows registry modification",
          analysisExplanation: "A new registry entry was added to ensure malicious code executes at system startup. This is a common persistence technique used by advanced malware."
        },
        {
          id: "inc-5",
          userId: "default-user",
          title: "Brute Force Attack on RDP Service",
          severity: "medium",
          status: "closed",
          systemContext: "Remote access server",
          logData: "Multiple failed RDP authentication attempts",
          additionalLogs: "Source IPs from multiple countries",
          classification: "true-positive",
          confidence: 85,
          aiInvestigation: 80,
          mitreAttack: ["T1110", "T1021.001"],
          iocs: ["45.142.214.100", "185.225.73.155"],
          aiAnalysis: "Coordinated brute force attack targeting Remote Desktop Protocol service",
          analysisExplanation: "Multiple failed login attempts from various geographic locations indicate an automated brute force attack on the RDP service."
        }
      ];
      
      for (const incident of sampleIncidents) {
        await db.insert(incidents).values(incident);
      }
      console.log('Sample incidents created');
    }
    
    console.log('Database initialization complete');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}