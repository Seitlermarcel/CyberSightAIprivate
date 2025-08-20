// Create a comprehensive test incident to showcase Gemini AI integration
const { Pool } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
const ws = require("ws");

// Set up database connection
const neonConfig = require('@neondatabase/serverless').neonConfig;
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

async function createTestIncident() {
  const userId = "46095879"; // User ID from logs
  
  // Comprehensive test incident data
  const testIncident = {
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

  console.log('🔥 Creating comprehensive test incident to trigger real Gemini AI analysis...');
  console.log('📊 Incident Title:', testIncident.title);
  console.log('📝 Log Data Length:', testIncident.logData.length, 'characters');
  console.log('💰 This will trigger 8+ real Gemini API calls!');
  
  return testIncident;
}

// Export the function
module.exports = { createTestIncident };

if (require.main === module) {
  createTestIncident().then(incident => {
    console.log('Test incident data prepared:', incident);
  }).catch(console.error);
}