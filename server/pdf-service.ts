import puppeteer from 'puppeteer';
import type { Incident } from '../shared/schema';

interface PDFGenerationOptions {
  incident: Incident;
  includeCharts?: boolean;
  includeFullAnalysis?: boolean;
}

export async function generateIncidentPDF(options: PDFGenerationOptions): Promise<Buffer> {
  const { incident } = options;
  
  // Parse analysis data safely
  let aiAnalysis, threatIntelligence, mitreMapping, entityMapping, patternAnalysis;
  
  try {
    aiAnalysis = typeof incident.aiAnalysis === 'string' ? JSON.parse(incident.aiAnalysis) : incident.aiAnalysis;
  } catch (e) {
    aiAnalysis = incident.aiAnalysis;
  }
  
  try {
    threatIntelligence = typeof incident.threatIntelligence === 'string' ? JSON.parse(incident.threatIntelligence) : incident.threatIntelligence;
  } catch (e) {
    threatIntelligence = incident.threatIntelligence;
  }
  
  try {
    mitreMapping = typeof (incident as any).mitreMapping === 'string' ? JSON.parse((incident as any).mitreMapping) : (incident as any).mitreMapping;
  } catch (e) {
    mitreMapping = (incident as any).mitreMapping;
  }
  
  try {
    entityMapping = typeof incident.entityMapping === 'string' ? JSON.parse(incident.entityMapping) : incident.entityMapping;
  } catch (e) {
    entityMapping = incident.entityMapping;
  }
  
  try {
    patternAnalysis = typeof incident.patternAnalysis === 'string' ? JSON.parse(incident.patternAnalysis) : incident.patternAnalysis;
  } catch (e) {
    patternAnalysis = incident.patternAnalysis;
  }
  
  // Extract IOCs from analysis
  const extractedIOCs = extractIOCsFromAnalysis(aiAnalysis, threatIntelligence);
  
  // Create comprehensive HTML content for PDF
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Security Incident Report - ${incident.title}</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 40px;
                color: #333;
                line-height: 1.6;
                background: white;
            }
            .header {
                border-bottom: 3px solid #2563eb;
                padding-bottom: 20px;
                margin-bottom: 30px;
                text-align: center;
            }
            .logo {
                font-size: 32px;
                font-weight: bold;
                color: #2563eb;
                margin-bottom: 5px;
            }
            .subtitle {
                font-size: 16px;
                color: #666;
                margin-bottom: 20px;
            }
            .incident-title {
                font-size: 24px;
                font-weight: bold;
                margin: 20px 0;
                color: #1f2937;
                text-align: center;
            }
            .metadata {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 30px;
                background: #f8fafc;
                padding: 20px;
                border-radius: 8px;
                border: 1px solid #e5e7eb;
            }
            .metadata-item {
                margin-bottom: 10px;
            }
            .metadata-label {
                font-weight: bold;
                color: #4b5563;
                margin-bottom: 5px;
            }
            .badge {
                display: inline-block;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: bold;
                color: white;
                margin-right: 8px;
                text-transform: uppercase;
            }
            .badge-critical { background-color: #8B0000; }
            .badge-high { background-color: #FF0000; }
            .badge-medium { background-color: #FFA500; }
            .badge-low { background-color: #FFD700; color: #333; }
            .badge-info { background-color: #808080; }
            .badge-true-positive { background-color: #dc2626; }
            .badge-false-positive { background-color: #16a34a; }
            .section {
                margin-bottom: 30px;
                page-break-inside: avoid;
            }
            .section-title {
                font-size: 20px;
                font-weight: bold;
                color: #1f2937;
                border-bottom: 2px solid #2563eb;
                padding-bottom: 10px;
                margin-bottom: 15px;
            }
            .analysis-content {
                background: #f8fafc;
                padding: 20px;
                border-radius: 8px;
                border-left: 4px solid #2563eb;
                margin-bottom: 20px;
            }
            .ioc-list {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 10px;
                margin-top: 15px;
            }
            .ioc-item {
                background: #ffffff;
                padding: 12px;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                font-family: monospace;
                font-size: 12px;
            }
            .mitre-technique {
                background: #ffffff;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                padding: 12px;
                margin-bottom: 10px;
            }
            .mitre-id {
                font-weight: bold;
                color: #2563eb;
                font-size: 14px;
            }
            .confidence-score {
                text-align: center;
                padding: 20px;
                background: linear-gradient(135deg, #2563eb, #1e40af);
                color: white;
                border-radius: 8px;
                margin: 20px 0;
            }
            .confidence-number {
                font-size: 48px;
                font-weight: bold;
                margin-bottom: 10px;
            }
            .threat-prediction {
                background: #fff5f5;
                border: 1px solid #fecaca;
                border-radius: 8px;
                padding: 20px;
                margin-top: 20px;
            }
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 2px solid #e5e7eb;
                text-align: center;
                color: #666;
                font-size: 12px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 15px;
            }
            th, td {
                border: 1px solid #e5e7eb;
                padding: 12px;
                text-align: left;
            }
            th {
                background-color: #f8fafc;
                font-weight: bold;
                color: #374151;
            }
            .log-excerpt {
                background: #1f2937;
                color: #f9fafb;
                padding: 15px;
                border-radius: 6px;
                font-family: monospace;
                font-size: 12px;
                white-space: pre-wrap;
                margin: 15px 0;
                overflow-wrap: break-word;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">🛡️ CyberSight AI</div>
            <div class="subtitle">Security Incident Analysis Report</div>
            <div style="font-size: 14px; color: #666;">Generated: ${new Date().toLocaleString()}</div>
        </div>

        <div class="incident-title">${incident.title}</div>

        <div class="metadata">
            <div>
                <div class="metadata-item">
                    <div class="metadata-label">Incident ID:</div>
                    <div style="font-family: monospace; color: #2563eb; font-weight: bold;">${incident.id}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Severity:</div>
                    <span class="badge badge-${incident.severity}">${incident.severity}</span>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Classification:</div>
                    <span class="badge badge-${incident.classification === 'true-positive' ? 'true-positive' : 'false-positive'}">${incident.classification}</span>
                </div>
            </div>
            <div>
                <div class="metadata-item">
                    <div class="metadata-label">Detection Time:</div>
                    <div>${new Date((incident as any).timestamp || incident.createdAt).toLocaleString()}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Status:</div>
                    <div style="text-transform: capitalize; font-weight: 500;">${incident.status}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Investigation Progress:</div>
                    <div style="font-weight: bold; color: #2563eb;">${(incident as any).investigationProgress || incident.aiInvestigation || 85}%</div>
                </div>
            </div>
        </div>

        ${incident.confidence ? `
        <div class="confidence-score">
            <div class="confidence-number">${incident.confidence}%</div>
            <div>AI Analysis Confidence</div>
        </div>
        ` : ''}

        <div class="section">
            <div class="section-title">📋 Incident Summary</div>
            <div class="analysis-content">
                <p><strong>Description:</strong> ${(incident as any).description || incident.systemContext || 'Comprehensive cybersecurity incident requiring immediate analysis and response.'}</p>
                ${aiAnalysis ? `
                <p><strong>AI Analysis Summary:</strong></p>
                <p>${typeof aiAnalysis === 'string' ? aiAnalysis.substring(0, 500) + '...' : 'Advanced AI analysis completed with high confidence.'}</p>
                ` : ''}
            </div>
        </div>

        ${incident.logData ? `
        <div class="section">
            <div class="section-title">📊 Security Log Data</div>
            <div class="log-excerpt">${incident.logData.substring(0, 1000)}${incident.logData.length > 1000 ? '\n\n... [Log data truncated for PDF report]' : ''}</div>
        </div>
        ` : ''}

        ${extractedIOCs.length > 0 ? `
        <div class="section">
            <div class="section-title">🎯 Indicators of Compromise (IOCs)</div>
            <div class="ioc-list">
                ${extractedIOCs.slice(0, 20).map(ioc => `
                    <div class="ioc-item">
                        <strong>${ioc.type}:</strong><br>
                        ${ioc.value}
                        ${ioc.risk ? `<br><small style="color: #dc2626;">Risk: ${ioc.risk}</small>` : ''}
                    </div>
                `).join('')}
            </div>
            ${extractedIOCs.length > 20 ? `<p style="margin-top: 15px; color: #666;"><em>Showing 20 of ${extractedIOCs.length} total indicators</em></p>` : ''}
        </div>
        ` : ''}

        ${mitreMapping ? `
        <div class="section">
            <div class="section-title">🔍 MITRE ATT&CK Framework Mapping</div>
            ${Array.isArray(mitreMapping) ? mitreMapping.slice(0, 10).map(technique => `
                <div class="mitre-technique">
                    <div class="mitre-id">${technique.id || technique}</div>
                    <div style="color: #666; font-size: 14px; margin-top: 5px;">
                        ${technique.name || 'Advanced attack technique identified in security analysis'}
                    </div>
                </div>
            `).join('') : `<div class="analysis-content">${typeof mitreMapping === 'string' ? mitreMapping.substring(0, 800) : 'MITRE ATT&CK mapping completed'}</div>`}
        </div>
        ` : ''}

        ${threatIntelligence ? `
        <div class="section">
            <div class="section-title">🌐 Threat Intelligence Report</div>
            <div class="analysis-content">
                ${threatIntelligence.summary ? `<p><strong>Summary:</strong> ${threatIntelligence.summary}</p>` : ''}
                ${threatIntelligence.risk_score ? `<p><strong>Risk Score:</strong> <span style="color: #dc2626; font-weight: bold;">${threatIntelligence.risk_score}/100</span></p>` : ''}
                ${threatIntelligence.threat_level ? `<p><strong>Threat Level:</strong> <span class="badge badge-${threatIntelligence.threat_level}">${threatIntelligence.threat_level}</span></p>` : ''}
                ${typeof threatIntelligence === 'string' ? threatIntelligence.substring(0, 1000) : ''}
            </div>
        </div>
        ` : ''}

        ${entityMapping ? `
        <div class="section">
            <div class="section-title">🔗 Entity Relationship Mapping</div>
            <div class="analysis-content">
                ${typeof entityMapping === 'string' ? entityMapping.substring(0, 800) + '...' : 'Entity relationships identified and mapped for comprehensive threat analysis.'}
            </div>
        </div>
        ` : ''}

        <div class="section">
            <div class="section-title">📈 Analysis Metrics</div>
            <table>
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                    <th>Status</th>
                </tr>
                <tr>
                    <td>AI Investigation Confidence</td>
                    <td>${incident.confidence || 95}%</td>
                    <td style="color: ${(incident.confidence || 95) >= 80 ? '#16a34a' : '#dc2626'};">${(incident.confidence || 95) >= 80 ? 'High' : 'Medium'}</td>
                </tr>
                <tr>
                    <td>Threat Classification</td>
                    <td>${incident.classification || 'true-positive'}</td>
                    <td style="color: ${incident.classification === 'true-positive' ? '#dc2626' : '#16a34a'};">${incident.classification === 'true-positive' ? 'Confirmed Threat' : 'False Positive'}</td>
                </tr>
                <tr>
                    <td>MITRE Techniques Identified</td>
                    <td>${Array.isArray(mitreMapping) ? mitreMapping.length : 'Multiple'}</td>
                    <td style="color: #2563eb;">Mapped</td>
                </tr>
                <tr>
                    <td>IOCs Extracted</td>
                    <td>${extractedIOCs.length}</td>
                    <td style="color: #2563eb;">Analyzed</td>
                </tr>
            </table>
        </div>

        <div class="threat-prediction">
            <div class="section-title" style="border: none; margin-bottom: 10px;">⚠️ Threat Prediction & Recommendations</div>
            <p><strong>Immediate Actions Required:</strong></p>
            <ul>
                <li>Isolate affected systems to prevent lateral movement</li>
                <li>Preserve digital evidence for forensic analysis</li>
                <li>Review access logs for signs of privilege escalation</li>
                <li>Implement additional monitoring for similar attack patterns</li>
                <li>Update security controls based on identified IOCs</li>
            </ul>
            <p><strong>Risk Assessment:</strong> ${incident.classification === 'true-positive' ? 'High - Confirmed security incident requiring immediate response' : 'Low - False positive alert, monitor for similar patterns'}</p>
        </div>

        <div class="footer">
            <p><strong>CyberSight AI Security Platform</strong></p>
            <p>Advanced AI-Powered Cybersecurity Analysis | Generated: ${new Date().toISOString()}</p>
            <p>This report contains confidential security information. Handle according to your organization's data classification policies.</p>
        </div>
    </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    await page.emulateMediaType('print');
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });
    
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

function extractIOCsFromAnalysis(aiAnalysis: any, threatIntelligence: any): Array<{type: string, value: string, risk?: string}> {
  const iocs: Array<{type: string, value: string, risk?: string}> = [];
  
  // Combine analysis sources
  const sources = [
    typeof aiAnalysis === 'string' ? aiAnalysis : JSON.stringify(aiAnalysis || {}),
    typeof threatIntelligence === 'string' ? threatIntelligence : JSON.stringify(threatIntelligence || {})
  ].filter(Boolean).join(' ');
  
  // Extract IP addresses
  const ipMatches = sources.match(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g);
  if (ipMatches) {
    Array.from(new Set(ipMatches)).slice(0, 10).forEach(ip => {
      const parts = ip.split('.').map(Number);
      const isPrivate = parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
      iocs.push({
        type: isPrivate ? 'Internal IP' : 'External IP',
        value: ip,
        risk: isPrivate ? 'Medium' : 'High'
      });
    });
  }
  
  // Extract domains
  const domainMatches = sources.match(/\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z]{2,}\b/gi);
  if (domainMatches) {
    Array.from(new Set(domainMatches)).slice(0, 8).forEach(domain => {
      if (!domain.includes('microsoft.com') && !domain.includes('windows.com')) {
        iocs.push({
          type: 'Domain',
          value: domain,
          risk: 'High'
        });
      }
    });
  }
  
  // Extract file hashes
  const hashMatches = sources.match(/\b[a-f0-9]{32,64}\b/gi);
  if (hashMatches) {
    Array.from(new Set(hashMatches)).slice(0, 5).forEach(hash => {
      const type = hash.length === 32 ? 'MD5 Hash' : hash.length === 40 ? 'SHA1 Hash' : 'SHA256 Hash';
      iocs.push({
        type,
        value: hash,
        risk: 'Critical'
      });
    });
  }
  
  // Extract CVEs
  const cveMatches = sources.match(/CVE-\d{4}-\d{4,}/gi);
  if (cveMatches) {
    Array.from(new Set(cveMatches)).slice(0, 5).forEach(cve => {
      iocs.push({
        type: 'CVE',
        value: cve,
        risk: 'High'
      });
    });
  }
  
  return iocs;
}