import type { Incident } from "@shared/schema";
import { format } from "date-fns";

export function generateIncidentPDF(incident: Incident, user: any) {
  // Create a comprehensive HTML document for PDF generation
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Incident Report - ${incident.title}</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 40px;
                color: #333;
                line-height: 1.6;
            }
            .header {
                border-bottom: 3px solid #2563eb;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 28px;
                font-weight: bold;
                color: #2563eb;
                margin-bottom: 10px;
            }
            .incident-title {
                font-size: 24px;
                font-weight: bold;
                margin: 20px 0;
                color: #1f2937;
            }
            .metadata {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 30px;
                background: #f8fafc;
                padding: 20px;
                border-radius: 8px;
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
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: bold;
                color: white;
                margin-right: 8px;
            }
            .badge-critical { background-color: #dc2626; }
            .badge-high { background-color: #ea580c; }
            .badge-medium { background-color: #d97706; }
            .badge-low { background-color: #65a30d; }
            .badge-info { background-color: #0891b2; }
            .badge-true-positive { background-color: #dc2626; }
            .badge-false-positive { background-color: #16a34a; }
            .section {
                margin-bottom: 30px;
                page-break-inside: avoid;
            }
            .section-title {
                font-size: 18px;
                font-weight: bold;
                color: #1f2937;
                border-bottom: 2px solid #e5e7eb;
                padding-bottom: 10px;
                margin-bottom: 15px;
            }
            .analysis-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 20px;
            }
            .progress-bar {
                width: 100%;
                height: 10px;
                background-color: #e5e7eb;
                border-radius: 5px;
                overflow: hidden;
                margin: 5px 0;
            }
            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #60a5fa 0%, #a855f7 25%, #ec4899 50%, #06b6d4 75%, #10b981 100%);
            }
            .table {
                width: 100%;
                border-collapse: collapse;
                margin: 15px 0;
            }
            .table th, .table td {
                border: 1px solid #d1d5db;
                padding: 12px;
                text-align: left;
            }
            .table th {
                background-color: #f3f4f6;
                font-weight: bold;
            }
            .code-block {
                background: #f8fafc;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                padding: 15px;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                white-space: pre-wrap;
                margin: 10px 0;
            }
            .mitre-technique {
                background: #dbeafe;
                border: 1px solid #93c5fd;
                border-radius: 6px;
                padding: 10px;
                margin: 8px 0;
            }
            .footer {
                margin-top: 50px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                font-size: 12px;
                color: #6b7280;
            }
            @media print {
                body { margin: 20px; font-size: 12px; }
                .section { page-break-inside: avoid; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">🛡️ CyberSight AI</div>
            <div>Security Incident Analysis Report</div>
            <div>Generated on ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</div>
            <div>Analyst: ${user?.username || 'Security Analyst'}</div>
        </div>

        <div class="incident-title">${incident.title}</div>

        <div class="metadata">
            <div>
                <div class="metadata-item">
                    <div class="metadata-label">Incident ID</div>
                    <div>${incident.id}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Status</div>
                    <div>${incident.status?.toUpperCase()}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Severity</div>
                    <div><span class="badge badge-${incident.severity}">${incident.severity?.toUpperCase()}</span></div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Classification</div>
                    <div><span class="badge badge-${incident.classification === 'true-positive' ? 'true-positive' : 'false-positive'}">${incident.classification === 'true-positive' ? 'TRUE POSITIVE' : 'FALSE POSITIVE'}</span></div>
                </div>
            </div>
            <div>
                <div class="metadata-item">
                    <div class="metadata-label">Created</div>
                    <div>${incident.createdAt ? format(new Date(incident.createdAt), "MMM d, yyyy 'at' h:mm a") : 'N/A'}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Last Updated</div>
                    <div>${incident.updatedAt ? format(new Date(incident.updatedAt), "MMM d, yyyy 'at' h:mm a") : 'N/A'}</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">Confidence Score</div>
                    <div>${incident.confidence}%</div>
                </div>
                <div class="metadata-item">
                    <div class="metadata-label">AI Investigation</div>
                    <div>
                        <div>${incident.aiInvestigation || 85}%</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${incident.aiInvestigation || 85}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        ${incident.systemContext ? `
        <div class="section">
            <div class="section-title">System Context</div>
            <div>${incident.systemContext}</div>
        </div>
        ` : ''}

        ${incident.analysisExplanation ? `
        <div class="section">
            <div class="section-title">Analysis Explanation</div>
            <div>${incident.analysisExplanation}</div>
        </div>
        ` : ''}

        ${incident.logData ? `
        <div class="section">
            <div class="section-title">Log Data</div>
            <div class="code-block">${incident.logData}</div>
        </div>
        ` : ''}

        ${incident.additionalLogs ? `
        <div class="section">
            <div class="section-title">Additional Logs</div>
            <div class="code-block">${incident.additionalLogs}</div>
        </div>
        ` : ''}

        ${incident.mitreDetails ? generateMitreSection(incident.mitreDetails) : ''}
        ${incident.iocDetails ? generateIOCSection(incident.iocDetails) : ''}
        ${incident.patternAnalysis ? generatePatternSection(incident.patternAnalysis) : ''}
        ${incident.purpleTeam ? generatePurpleTeamSection(incident.purpleTeam) : ''}
        ${incident.entityMapping ? generateEntitySection(incident.entityMapping) : ''}
        ${incident.codeAnalysis ? generateCodeSection(incident.codeAnalysis) : ''}
        ${incident.attackVectors ? generateAttackVectorSection(incident.attackVectors) : ''}
        ${incident.complianceImpact ? generateComplianceSection(incident.complianceImpact) : ''}
        ${incident.similarIncidents ? generateSimilarIncidentsSection(incident.similarIncidents) : ''}

        ${incident.comments && incident.comments.length > 0 ? `
        <div class="section">
            <div class="section-title">Comments & Status History</div>
            ${incident.comments.map(comment => `<div style="margin-bottom: 10px; padding: 10px; background: #f8fafc; border-radius: 6px;">${comment}</div>`).join('')}
        </div>
        ` : ''}

        <div class="footer">
            <div>This report was generated by CyberSight AI Security Analysis Platform</div>
            <div>Report ID: ${incident.id} | Generated: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")} UTC</div>
            <div>© 2025 CyberSight AI - All rights reserved</div>
        </div>
    </body>
    </html>
  `;

  // Open the HTML content in a new window for printing
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load, then trigger print dialog
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  }
}

function generateMitreSection(mitreDetailsJson: string): string {
  try {
    const mitreDetails = JSON.parse(mitreDetailsJson);
    let html = `
      <div class="section">
        <div class="section-title">MITRE ATT&CK Framework</div>
    `;

    if (mitreDetails.tactics && mitreDetails.tactics.length > 0) {
      html += `
        <h4>Tactics</h4>
        ${mitreDetails.tactics.map((tactic: any) => `
          <div class="mitre-technique">
            <strong>${tactic.id}: ${tactic.name}</strong>
            <div>${tactic.description}</div>
          </div>
        `).join('')}
      `;
    }

    if (mitreDetails.techniques && mitreDetails.techniques.length > 0) {
      html += `
        <h4>Techniques</h4>
        ${mitreDetails.techniques.map((technique: any) => `
          <div class="mitre-technique">
            <strong>${technique.id}: ${technique.name}</strong>
            <div>${technique.description}</div>
          </div>
        `).join('')}
      `;
    }

    html += `</div>`;
    return html;
  } catch {
    return '';
  }
}

function generateIOCSection(iocDetailsJson: string): string {
  try {
    const iocDetails = JSON.parse(iocDetailsJson);
    if (!Array.isArray(iocDetails) || iocDetails.length === 0) return '';

    return `
      <div class="section">
        <div class="section-title">Indicators of Compromise (IOCs)</div>
        <table class="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Value</th>
              <th>Reputation</th>
              <th>Confidence</th>
              <th>Threat Intelligence</th>
            </tr>
          </thead>
          <tbody>
            ${iocDetails.map((ioc: any) => `
              <tr>
                <td>${ioc.type}</td>
                <td>${ioc.value}</td>
                <td>${ioc.reputation}</td>
                <td>${ioc.confidence}</td>
                <td>${ioc.threatIntelligence}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch {
    return '';
  }
}

function generatePatternSection(patternAnalysisJson: string): string {
  try {
    const patterns = JSON.parse(patternAnalysisJson);
    if (!Array.isArray(patterns) || patterns.length === 0) return '';

    return `
      <div class="section">
        <div class="section-title">Log Pattern Analysis</div>
        ${patterns.map((pattern: any) => `
          <div style="margin-bottom: 15px; padding: 15px; background: #f8fafc; border-radius: 6px;">
            <strong>${pattern.pattern}</strong> (Significance: ${pattern.significance})
            <div style="margin-top: 5px;">${pattern.description}</div>
          </div>
        `).join('')}
      </div>
    `;
  } catch {
    return '';
  }
}

function generatePurpleTeamSection(purpleTeamJson: string): string {
  try {
    const purpleTeam = JSON.parse(purpleTeamJson);
    let html = `
      <div class="section">
        <div class="section-title">Purple Team Analysis</div>
    `;

    if (purpleTeam.redTeam && purpleTeam.redTeam.length > 0) {
      html += `
        <h4>Red Team (Attack Simulation)</h4>
        ${purpleTeam.redTeam.map((scenario: any) => `
          <div style="margin-bottom: 15px; padding: 15px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;">
            <strong>${scenario.scenario}</strong>
            <div><strong>Steps:</strong> ${scenario.steps}</div>
            <div><strong>Expected Outcome:</strong> ${scenario.expectedOutcome}</div>
          </div>
        `).join('')}
      `;
    }

    if (purpleTeam.blueTeam && purpleTeam.blueTeam.length > 0) {
      html += `
        <h4>Blue Team (Defense)</h4>
        ${purpleTeam.blueTeam.map((defense: any) => `
          <div style="margin-bottom: 15px; padding: 15px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px;">
            <strong>${defense.defense}</strong> (${defense.priority})
            <div><strong>Description:</strong> ${defense.description}</div>
            <div><strong>Technical:</strong> ${defense.technical}</div>
            <div><strong>Verification:</strong> ${defense.verification}</div>
          </div>
        `).join('')}
      `;
    }

    html += `</div>`;
    return html;
  } catch {
    return '';
  }
}

function generateEntitySection(entityMappingJson: string): string {
  try {
    const entityMapping = JSON.parse(entityMappingJson);
    let html = `
      <div class="section">
        <div class="section-title">Entity Mapping & Relationships</div>
    `;

    if (entityMapping.entities && entityMapping.entities.length > 0) {
      html += `
        <h4>Entities</h4>
        <table class="table">
          <thead>
            <tr><th>Entity ID</th><th>Type</th><th>Category</th></tr>
          </thead>
          <tbody>
            ${entityMapping.entities.map((entity: any) => `
              <tr>
                <td>${entity.id}</td>
                <td>${entity.type}</td>
                <td>${entity.category}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if (entityMapping.relationships && entityMapping.relationships.length > 0) {
      html += `
        <h4>Relationships</h4>
        ${entityMapping.relationships.map((rel: any) => `
          <div style="margin-bottom: 10px; padding: 10px; background: #f8fafc; border-radius: 6px;">
            <strong>${rel.source}</strong> → <em>${rel.action}</em> → <strong>${rel.target}</strong>
          </div>
        `).join('')}
      `;
    }

    html += `</div>`;
    return html;
  } catch {
    return '';
  }
}

function generateCodeSection(codeAnalysisJson: string): string {
  try {
    const codeAnalysis = JSON.parse(codeAnalysisJson);
    if (!codeAnalysis.summary) return '';

    return `
      <div class="section">
        <div class="section-title">Code Analysis & Sandbox Simulation</div>
        <div><strong>Language:</strong> ${codeAnalysis.language}</div>
        <div><strong>Summary:</strong> ${codeAnalysis.summary}</div>
        ${codeAnalysis.sandboxOutput ? `
          <h4>Sandbox Output</h4>
          <div class="code-block">${codeAnalysis.sandboxOutput}</div>
        ` : ''}
      </div>
    `;
  } catch {
    return '';
  }
}

function generateAttackVectorSection(attackVectorsJson: string): string {
  try {
    const attackVectors = JSON.parse(attackVectorsJson);
    if (!Array.isArray(attackVectors) || attackVectors.length === 0) return '';

    return `
      <div class="section">
        <div class="section-title">AI-Generated Attack Vector Analysis</div>
        ${attackVectors.map((vector: any) => `
          <div style="margin-bottom: 15px; padding: 15px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;">
            <strong>${vector.vector}</strong> (${vector.likelihood})
            <div style="margin-top: 5px;">${vector.description}</div>
          </div>
        `).join('')}
      </div>
    `;
  } catch {
    return '';
  }
}

function generateComplianceSection(complianceImpactJson: string): string {
  try {
    const complianceImpact = JSON.parse(complianceImpactJson);
    if (!Array.isArray(complianceImpact) || complianceImpact.length === 0) return '';

    return `
      <div class="section">
        <div class="section-title">Compliance Impact Analysis</div>
        ${complianceImpact.map((item: any) => {
          if (item.recommendation) {
            return `
              <div style="margin-bottom: 15px; padding: 15px; background: #fffbeb; border: 1px solid #fed7aa; border-radius: 6px;">
                <strong>Recommendation:</strong> ${item.recommendation}
              </div>
            `;
          }
          return `
            <div style="margin-bottom: 15px; padding: 15px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px;">
              <strong>${item.framework}</strong> - ${item.article || item.requirement}
              <div><strong>Impact:</strong> ${item.impact}</div>
              <div>${item.description}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch {
    return '';
  }
}

function generateSimilarIncidentsSection(similarIncidentsJson: string): string {
  try {
    const similarIncidents = JSON.parse(similarIncidentsJson);
    if (!Array.isArray(similarIncidents) || similarIncidents.length === 0) return '';

    return `
      <div class="section">
        <div class="section-title">Similar Past Incidents</div>
        ${similarIncidents.map((similar: any) => `
          <div style="margin-bottom: 15px; padding: 15px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px;">
            <strong>${similar.title}</strong> (${similar.match})
            <div><strong>Common Patterns:</strong> ${similar.patterns.join(', ')}</div>
            <div><strong>Analysis:</strong> ${similar.analysis}</div>
          </div>
        `).join('')}
      </div>
    `;
  } catch {
    return '';
  }
}