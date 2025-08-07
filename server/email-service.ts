import { MailService } from '@sendgrid/mail';
import type { Incident, User } from '@shared/schema';
import { generateIncidentPDF } from '../client/src/utils/pdf-export';

const mailService = new MailService();

if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailNotificationData {
  incident: Incident;
  user: User;
  recipientEmail: string;
  isHighSeverityAlert?: boolean;
}

export async function sendIncidentNotification(data: EmailNotificationData): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured, skipping email notification');
    return false;
  }

  try {
    const { incident, user, recipientEmail, isHighSeverityAlert } = data;
    
    const subject = isHighSeverityAlert 
      ? `🚨 HIGH SEVERITY ALERT: ${incident.title}`
      : `🛡️ New Security Incident: ${incident.title}`;
    
    const severityBadge = getSeverityBadge(incident.severity);
    const classificationBadge = getClassificationBadge(incident.classification);
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #f8f9fa; border-radius: 8px; padding: 20px; }
          .header { background: #1e293b; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .incident-title { font-size: 20px; margin-bottom: 15px; }
          .metadata { background: white; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
          .metadata-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
          .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; color: white; }
          .badge-critical { background: #dc2626; }
          .badge-high { background: #ea580c; }
          .badge-medium { background: #d97706; }
          .badge-low { background: #65a30d; }
          .badge-info { background: #0891b2; }
          .badge-true-positive { background: #dc2626; }
          .badge-false-positive { background: #16a34a; }
          .progress-container { background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden; margin-top: 5px; }
          .progress-bar { height: 100%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
          .cta { background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🛡️ CyberSight AI</div>
            <div>${isHighSeverityAlert ? 'HIGH SEVERITY SECURITY ALERT' : 'Security Incident Notification'}</div>
          </div>
          
          <div class="incident-title">${incident.title}</div>
          
          <div class="metadata">
            <div class="metadata-row">
              <strong>Incident ID:</strong>
              <span>${incident.id}</span>
            </div>
            <div class="metadata-row">
              <strong>Severity:</strong>
              <span class="badge ${severityBadge.class}">${severityBadge.text}</span>
            </div>
            <div class="metadata-row">
              <strong>Classification:</strong>
              <span class="badge ${classificationBadge.class}">${classificationBadge.text}</span>
            </div>
            <div class="metadata-row">
              <strong>Confidence Score:</strong>
              <div>
                <span>${incident.confidence}%</span>
                <div class="progress-container">
                  <div class="progress-bar" style="width: ${incident.confidence}%"></div>
                </div>
              </div>
            </div>
            <div class="metadata-row">
              <strong>AI Investigation:</strong>
              <div>
                <span>${incident.aiInvestigation || 85}%</span>
                <div class="progress-container">
                  <div class="progress-bar" style="width: ${incident.aiInvestigation || 85}%"></div>
                </div>
              </div>
            </div>
            <div class="metadata-row">
              <strong>Created:</strong>
              <span>${incident.createdAt ? new Date(incident.createdAt).toLocaleString() : 'N/A'}</span>
            </div>
          </div>
          
          ${incident.analysisExplanation ? `
          <div class="metadata">
            <strong>Analysis Summary:</strong>
            <p>${incident.analysisExplanation}</p>
          </div>
          ` : ''}
          
          <a href="${process.env.REPLIT_DOMAINS || 'http://localhost:5000'}" class="cta">
            View Full Incident Details
          </a>
          
          <div class="footer">
            <p>This notification was sent by CyberSight AI Security Platform</p>
            <p>Analyst: ${user.username}</p>
            <p>${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const msg = {
      to: recipientEmail,
      from: 'security@cybersight-ai.com', // Configure this with your verified sender
      subject,
      html: htmlContent,
    };

    await mailService.send(msg);
    console.log(`Email notification sent to ${recipientEmail} for incident ${incident.id}`);
    return true;
  } catch (error) {
    console.error('Failed to send email notification:', error);
    return false;
  }
}

function getSeverityBadge(severity: string) {
  switch (severity?.toLowerCase()) {
    case 'critical': return { class: 'badge-critical', text: 'CRITICAL' };
    case 'high': return { class: 'badge-high', text: 'HIGH' };
    case 'medium': return { class: 'badge-medium', text: 'MEDIUM' };
    case 'low': return { class: 'badge-low', text: 'LOW' };
    default: return { class: 'badge-info', text: 'INFORMATIONAL' };
  }
}

function getClassificationBadge(classification: string) {
  return classification === 'true-positive' 
    ? { class: 'badge-true-positive', text: 'TRUE POSITIVE' }
    : { class: 'badge-false-positive', text: 'FALSE POSITIVE' };
}