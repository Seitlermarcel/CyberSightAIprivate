import nodemailer from 'nodemailer';
import type { Incident } from '../shared/schema';
import { generateIncidentPDF } from './pdf-service';

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
  
  // Generate PDF attachment
  let pdfAttachment = null;
  try {
    const pdfBuffer = await generateIncidentPDF({ incident });
    pdfAttachment = {
      filename: `incident-report-${incident.id.substring(0, 8)}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    };
    console.log(`Generated PDF attachment: ${pdfAttachment.filename}`);
  } catch (error) {
    console.error('Failed to generate PDF attachment:', error);
  }
  
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
  if ((incident as any).threatIntelligence) {
    try {
      const threatData = JSON.parse((incident as any).threatIntelligence);
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
          ${(incident as any).workflowStage ? `
          <div style="background-color: #0d1117; border-left: 4px solid #00BFFF; padding: 20px; margin: 20px 0;">
            <h3 style="color: #00BFFF; margin-top: 0; font-size: 16px;">AI Analysis Summary</h3>
            <p style="color: #ccc; line-height: 1.6; margin: 10px 0;">
              <strong>Workflow Stage:</strong> ${(incident as any).workflowStage}
            </p>
            ${(incident as any).analysisExplanation ? `
            <p style="color: #ccc; line-height: 1.6; margin: 10px 0;">
              ${(incident as any).analysisExplanation.substring(0, 300)}${(incident as any).analysisExplanation.length > 300 ? '...' : ''}
            </p>
            ` : ''}
          </div>
          ` : ''}
          
          <!-- MITRE ATT&CK Mapping -->
          ${(incident as any).mitreMapping ? (() => {
            try {
              const mitre = JSON.parse((incident as any).mitreMapping);
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
          
          <!-- Business Impact Analysis -->
          <div style="background: linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%); padding: 20px; margin: 20px 0; border-radius: 8px; border: 1px solid #dc2626;">
            <h3 style="color: #fff; margin: 0 0 15px; font-size: 16px; font-weight: bold;">⚡ BUSINESS IMPACT ASSESSMENT</h3>
            <div style="color: #fecaca;">
              <p style="margin: 8px 0;"><strong>Risk Level:</strong> ${incident.severity === 'critical' ? 'EXTREME' : incident.severity === 'high' ? 'HIGH' : 'MODERATE'} Financial & Operational Impact</p>
              <p style="margin: 8px 0;"><strong>Potential Losses:</strong> ${incident.severity === 'critical' ? '$50K-500K+ in downtime, compliance fines' : incident.severity === 'high' ? '$10K-50K in productivity loss' : '$1K-10K in investigation costs'}</p>
              <p style="margin: 8px 0;"><strong>Compliance:</strong> ${incident.severity === 'critical' ? 'GDPR/SOX/HIPAA violations likely' : 'Regulatory review required'}</p>
              <p style="margin: 8px 0;"><strong>Reputation:</strong> ${incident.severity === 'critical' ? 'Major brand damage risk' : 'Minor reputation impact'}</p>
            </div>
          </div>

          <!-- PDF Report Notice -->
          <div style="padding: 25px 0; text-align: center; background: linear-gradient(135deg, #1f2937 0%, #111827 100%); border-radius: 12px; margin: 20px 0; border: 2px solid #00BFFF;">
            <h3 style="color: #00BFFF; margin: 0 0 15px; font-size: 18px; font-weight: bold;">📊 COMPREHENSIVE ANALYSIS REPORT</h3>
            <p style="color: #d1d5db; margin: 0 0 20px; font-size: 14px;">Complete incident analysis with AI insights, threat intelligence, and visual analytics</p>
            <div style="background: linear-gradient(135deg, #00BFFF 0%, #0080FF 100%); 
                       color: white; padding: 18px 40px; border-radius: 10px; 
                       font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; 
                       box-shadow: 0 6px 20px rgba(0, 191, 255, 0.4); 
                       border: 2px solid #00BFFF; font-size: 16px; display: inline-block;">
              📎 ATTACHED: FULL PDF REPORT
            </div>
            <p style="color: #9ca3af; margin: 15px 0 0; font-size: 12px;">
              Includes: AI Analysis • Threat Intel • MITRE Mapping • Visual Charts • Executive Summary
            </p>
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
  
  // Add PDF attachment if generated successfully
  const attachments: any[] = [];
  if (pdfAttachment) {
    attachments.push(pdfAttachment);
  }

  try {
    const mailOptions = {
      from: `CyberSight AI <${process.env.GMAIL_EMAIL}>`,
      to,
      subject,
      text: textContent,
      html: htmlContent,
      attachments,
      priority: (isHighSeverity ? 'high' : 'normal') as 'high' | 'normal'
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