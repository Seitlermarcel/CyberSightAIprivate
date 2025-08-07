import nodemailer from 'nodemailer';
import type { Incident } from '../shared/schema';

// Create reusable transporter object using Gmail SMTP
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter && process.env.GMAIL_EMAIL && process.env.GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_EMAIL,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
  }
  return transporter;
}

interface EmailNotificationData {
  incident: Incident;
  user: any;
  recipientEmail: string;
  isHighSeverityAlert: boolean;
}

export async function sendIncidentNotification(data: EmailNotificationData): Promise<boolean> {
  const transport = getTransporter();
  
  if (!transport) {
    console.log('Gmail credentials not configured, skipping email notification');
    return false;
  }

  const { recipientEmail: to, incident, isHighSeverityAlert: isHighSeverity } = data;
  
  // Determine email priority and subject
  const priority = isHighSeverity ? 'URGENT' : 'NEW';
  const subject = `[${priority}] Security Incident: ${incident.title}`;
  
  // Create severity badge color
  const severityColors = {
    critical: '#8B0000',
    high: '#FF0000',
    medium: '#FFA500',
    low: '#FFD700',
    info: '#808080'
  };
  
  const severityColor = severityColors[incident.severity as keyof typeof severityColors] || '#808080';
  
  // Parse threat intelligence if available
  let threatIntelHtml = '';
  if (incident.threatIntelligence) {
    try {
      const threatData = JSON.parse(incident.threatIntelligence);
      if (threatData.risk_score) {
        threatIntelHtml = `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #333; color: #999;">Threat Risk Score:</td>
            <td style="padding: 12px; border-bottom: 1px solid #333; color: #00BFFF; font-weight: bold;">${threatData.risk_score}/100</td>
          </tr>
        `;
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
  
  // Create HTML email content with cyber theme
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Security Incident Alert</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border: 1px solid #333;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); padding: 30px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; letter-spacing: 2px;">
            🛡️ CYBERSIGHT AI
          </h1>
          <p style="margin: 10px 0 0; color: #00BFFF; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
            Security Incident Detection System
          </p>
        </div>
        
        <!-- Alert Banner -->
        ${isHighSeverity ? `
        <div style="background-color: ${severityColor}; color: white; padding: 15px; text-align: center;">
          <strong style="text-transform: uppercase; letter-spacing: 1px;">⚠️ HIGH PRIORITY ALERT ⚠️</strong>
        </div>
        ` : ''}
        
        <!-- Incident Details -->
        <div style="padding: 30px;">
          <h2 style="color: #00BFFF; margin-top: 0; font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 10px;">
            Incident Details
          </h2>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #333; color: #999; width: 40%;">Incident ID:</td>
              <td style="padding: 12px; border-bottom: 1px solid #333; color: #fff; font-family: monospace;">${incident.id}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #333; color: #999;">Title:</td>
              <td style="padding: 12px; border-bottom: 1px solid #333; color: #fff; font-weight: bold;">${incident.title}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #333; color: #999;">Severity:</td>
              <td style="padding: 12px; border-bottom: 1px solid #333;">
                <span style="background-color: ${severityColor}; color: white; padding: 4px 12px; border-radius: 4px; text-transform: uppercase; font-size: 12px; font-weight: bold;">
                  ${incident.severity}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #333; color: #999;">Classification:</td>
              <td style="padding: 12px; border-bottom: 1px solid #333; color: ${incident.classification === 'true-positive' ? '#FF4444' : '#44FF44'}; font-weight: bold;">
                ${incident.classification?.toUpperCase().replace('-', ' ')}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #333; color: #999;">Confidence:</td>
              <td style="padding: 12px; border-bottom: 1px solid #333; color: #00BFFF; font-weight: bold;">${incident.confidence}%</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #333; color: #999;">Investigation:</td>
              <td style="padding: 12px; border-bottom: 1px solid #333; color: #00BFFF;">${incident.aiInvestigation}%</td>
            </tr>
            ${threatIntelHtml}
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #333; color: #999;">Status:</td>
              <td style="padding: 12px; border-bottom: 1px solid #333; color: #FFA500; text-transform: uppercase;">${incident.status}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #333; color: #999;">Created:</td>
              <td style="padding: 12px; border-bottom: 1px solid #333; color: #fff;">${new Date(incident.createdAt!).toLocaleString()}</td>
            </tr>
          </table>
          
          <!-- AI Analysis Summary -->
          ${incident.workflowStage ? `
          <div style="background-color: #0d1117; border-left: 4px solid #00BFFF; padding: 20px; margin: 20px 0;">
            <h3 style="color: #00BFFF; margin-top: 0; font-size: 16px;">AI Analysis Summary</h3>
            <p style="color: #ccc; line-height: 1.6; margin: 10px 0;">
              <strong>Workflow Stage:</strong> ${incident.workflowStage}
            </p>
            ${incident.analysisExplanation ? `
            <p style="color: #ccc; line-height: 1.6; margin: 10px 0;">
              ${incident.analysisExplanation.substring(0, 300)}${incident.analysisExplanation.length > 300 ? '...' : ''}
            </p>
            ` : ''}
          </div>
          ` : ''}
          
          <!-- MITRE ATT&CK Mapping -->
          ${incident.mitreMapping ? (() => {
            try {
              const mitre = JSON.parse(incident.mitreMapping);
              if (mitre.tactics && mitre.tactics.length > 0) {
                return `
                  <div style="margin: 20px 0;">
                    <h3 style="color: #00BFFF; font-size: 16px; border-bottom: 1px solid #333; padding-bottom: 10px;">
                      MITRE ATT&CK Tactics Detected
                    </h3>
                    <ul style="color: #ccc; line-height: 1.8;">
                      ${mitre.tactics.slice(0, 3).map((tactic: any) => `
                        <li><strong style="color: #FFA500;">${tactic.id}:</strong> ${tactic.name}</li>
                      `).join('')}
                    </ul>
                  </div>
                `;
              }
              return '';
            } catch (e) {
              return '';
            }
          })() : ''}
          
          <!-- Call to Action -->
          <div style="margin: 30px 0; padding: 20px; background-color: #0d1117; border-radius: 8px; text-align: center;">
            <p style="color: #ccc; margin: 0 0 15px;">
              ${isHighSeverity ? 
                'This incident requires immediate attention. Please review and respond promptly.' : 
                'Please review this incident in the CyberSight AI dashboard.'}
            </p>
            <a href="${process.env.REPLIT_URL || 'http://localhost:5000'}/incidents/${incident.id}" 
               style="display: inline-block; background: linear-gradient(135deg, #00BFFF, #0080FF); color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
              View Incident Details
            </a>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #0d1117; padding: 20px; text-align: center; border-top: 1px solid #333;">
          <p style="color: #666; margin: 0; font-size: 12px;">
            This is an automated alert from CyberSight AI Security Platform
          </p>
          <p style="color: #666; margin: 5px 0 0; font-size: 12px;">
            © ${new Date().getFullYear()} CyberSight AI - Advanced Threat Detection System
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  // Plain text fallback
  const textContent = `
CYBERSIGHT AI - SECURITY INCIDENT ALERT
${isHighSeverity ? '\n⚠️ HIGH PRIORITY ALERT ⚠️\n' : ''}
========================================

Incident Details:
-----------------
ID: ${incident.id}
Title: ${incident.title}
Severity: ${incident.severity?.toUpperCase()}
Classification: ${incident.classification?.toUpperCase().replace('-', ' ')}
Confidence: ${incident.confidence}%
Status: ${incident.status?.toUpperCase()}
Created: ${new Date(incident.createdAt!).toLocaleString()}

${incident.analysisExplanation ? `
AI Analysis:
${incident.analysisExplanation.substring(0, 500)}${incident.analysisExplanation.length > 500 ? '...' : ''}
` : ''}

Action Required:
${isHighSeverity ? 
  'This incident requires immediate attention. Please review and respond promptly.' : 
  'Please review this incident in the CyberSight AI dashboard.'}

View Details: ${process.env.REPLIT_URL || 'http://localhost:5000'}/incidents/${incident.id}

========================================
This is an automated alert from CyberSight AI
  `.trim();
  
  try {
    const mailOptions = {
      from: `CyberSight AI <${process.env.GMAIL_EMAIL}>`,
      to,
      subject,
      text: textContent,
      html: htmlContent,
      priority: isHighSeverity ? 'high' : 'normal'
    };
    
    await transport.sendMail(mailOptions);
    console.log(`Email notification sent to ${to} for incident ${incident.id}`);
    return true;
  } catch (error) {
    console.error('Failed to send email notification:', error);
    return false;
  }
}

export async function sendTestEmail(to: string): Promise<boolean> {
  const transport = getTransporter();
  
  if (!transport) {
    console.log('Gmail credentials not configured');
    return false;
  }
  
  try {
    const mailOptions = {
      from: `CyberSight AI <${process.env.GMAIL_EMAIL}>`,
      to,
      subject: 'CyberSight AI - Email Notifications Activated',
      html: `
        <div style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border: 1px solid #333; padding: 30px;">
          <h2 style="color: #00BFFF;">Email Notifications Activated ✅</h2>
          <p style="color: #ccc;">Your email notifications have been successfully configured for CyberSight AI.</p>
          <p style="color: #ccc;">You will receive alerts for:</p>
          <ul style="color: #ccc;">
            <li>New security incidents</li>
            <li>High severity alerts (if enabled)</li>
          </ul>
          <p style="color: #999; margin-top: 20px; font-size: 12px;">
            This confirmation email was sent from ${process.env.GMAIL_EMAIL}
          </p>
        </div>
      `,
      text: 'Your email notifications have been successfully configured for CyberSight AI.'
    };
    
    await transport.sendMail(mailOptions);
    console.log(`Test email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Failed to send test email:', error);
    return false;
  }
}