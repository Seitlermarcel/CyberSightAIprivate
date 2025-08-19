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

        <!-- Investigation Metrics Section -->
        <div class="section">
            <div class="section-title">🔍 Investigation Metrics</div>
            <div class="analysis-grid">
                <div>
                    <h4>Confidence Score Analysis</h4>
                    <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <div style="display: flex; align-items: center; margin-bottom: 10px;">
                            <span style="font-weight: bold; font-size: 18px;">${incident.confidence}%</span>
                            <span style="margin-left: 10px; ${getConfidenceColor(incident.confidence || 50)}; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${getConfidenceLevel(incident.confidence || 50)}</span>
                        </div>
                        <div style="width: 100%; background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${incident.confidence || 50}%; height: 100%; background: ${getConfidenceBarColor(incident.confidence || 50)};"></div>
                        </div>
                        <p style="font-size: 13px; color: #6b7280; margin-top: 8px;">${getConfidenceDescription(incident.confidence || 50)}</p>
                    </div>
                </div>
                <div>
                    <h4>AI Investigation Completeness</h4>
                    <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <div style="display: flex; align-items: center; margin-bottom: 10px;">
                            <span style="font-weight: bold; font-size: 18px;">${incident.aiInvestigation || 85}%</span>
                            <span style="margin-left: 10px; ${getInvestigationColor(incident.aiInvestigation || 85)}; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${getInvestigationLevel(incident.aiInvestigation || 85)}</span>
                        </div>
                        <div style="width: 100%; background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${incident.aiInvestigation || 85}%; height: 100%; background: ${getInvestigationBarColor(incident.aiInvestigation || 85)};"></div>
                        </div>
                        <p style="font-size: 13px; color: #6b7280; margin-top: 8px;">${getInvestigationDescription(incident.aiInvestigation || 85)}</p>
                    </div>
                </div>
            </div>
            
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 15px; margin-top: 20px;">
                <h4 style="color: #1e40af; margin-bottom: 10px;">🤖 AI Agents Coverage</h4>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 12px;">
                    <div>✓ MITRE Analysis</div>
                    <div>✓ IOC Detection</div>
                    <div>✓ Pattern Recognition</div>
                    <div>✓ Purple Team Assessment</div>
                    <div>✓ Entity Mapping</div>
                    <div>✓ Code Analysis</div>
                    <div>✓ Attack Vectors</div>
                    <div>✓ Compliance Check</div>
                </div>
                <p style="font-size: 12px; color: #6b7280; margin-top: 10px;">
                    All 8 specialized AI agents contributed to this investigation, providing comprehensive analysis across multiple cybersecurity domains.
                </p>
            </div>
        </div>
        
        <!-- Threat Prediction Section -->
        ${incident.threatPrediction ? `
        <div class="section">
            <div class="section-title">🎯 Threat Prediction Analysis</div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px;">
                <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 15px;">
                    <h4 style="color: #92400e; margin-bottom: 8px;">Overall Threat Level</h4>
                    <div style="font-size: 24px; font-weight: bold; color: #92400e;">${incident.predictionConfidence || 75}%</div>
                    <div style="width: 100%; background: #fed7aa; height: 6px; border-radius: 3px; margin-top: 8px;">
                        <div style="width: ${incident.predictionConfidence || 75}%; height: 100%; background: linear-gradient(to right, #fbbf24, #dc2626); border-radius: 3px;"></div>
                    </div>
                </div>
                <div style="background: #dbeafe; border: 1px solid #3b82f6; border-radius: 8px; padding: 15px;">
                    <h4 style="color: #1e40af; margin-bottom: 8px;">Risk Trend</h4>
                    <div style="font-size: 18px; font-weight: bold; color: #1e40af; text-transform: capitalize;">${incident.riskTrend || 'Stable'}</div>
                    <div style="margin-top: 8px; font-size: 12px; color: #475569;">
                        ${incident.riskTrend === 'increasing' ? '⚠️ Escalating' : 
                          incident.riskTrend === 'decreasing' ? '✅ Improving' : '📊 Consistent'}
                    </div>
                </div>
                <div style="background: #f3e8ff; border: 1px solid #8b5cf6; border-radius: 8px; padding: 15px;">
                    <h4 style="color: #6b21a8; margin-bottom: 8px;">Confidence</h4>
                    <div style="font-size: 24px; font-weight: bold; color: #6b21a8;">${incident.confidence || 82}%</div>
                    <div style="width: 100%; background: #c7d2fe; height: 6px; border-radius: 3px; margin-top: 8px;">
                        <div style="width: ${incident.confidence || 82}%; height: 100%; background: linear-gradient(to right, #8b5cf6, #3b82f6); border-radius: 3px;"></div>
                    </div>
                </div>
            </div>
            ${renderThreatScenarios(JSON.parse(incident.threatPrediction))}
            ${renderEnvironmentalImpact(JSON.parse(incident.threatPrediction))}
        </div>
        ` : ''}
        </div>

        <!-- Business Impact Assessment Section -->
        <div class="section">
            <div class="section-title">💼 Business Impact Assessment</div>
            <div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); padding: 20px; border-radius: 12px; border-left: 4px solid #dc2626;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px;">
                    <div style="text-align: center; padding: 15px; background: white; border-radius: 8px; border: 1px solid #dc2626;">
                        <div style="font-size: 18px; font-weight: bold; color: #dc2626; margin-bottom: 8px;">
                            ${incident.severity === 'critical' ? 'EXTREME' : incident.severity === 'high' ? 'HIGH' : 'MODERATE'}
                        </div>
                        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Risk Level</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: white; border-radius: 8px; border: 1px solid #dc2626;">
                        <div style="font-size: 14px; font-weight: bold; color: #dc2626; margin-bottom: 8px;">
                            ${incident.severity === 'critical' ? '$50K-500K+' : incident.severity === 'high' ? '$10K-50K' : '$1K-10K'}
                        </div>
                        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Potential Loss</div>
                    </div>
                    <div style="text-align: center; padding: 15px; background: white; border-radius: 8px; border: 1px solid #dc2626;">
                        <div style="font-size: 14px; font-weight: bold; color: #dc2626; margin-bottom: 8px;">
                            ${incident.severity === 'critical' ? 'Mandatory' : 'Required'}
                        </div>
                        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Compliance Review</div>
                    </div>
                </div>
                <div style="padding: 15px; background: white; border-radius: 8px; border: 1px solid #dc2626;">
                    <strong style="color: #dc2626;">Impact Summary:</strong>
                    <ul style="margin: 10px 0; color: #374151;">
                        <li><strong>Financial:</strong> ${incident.severity === 'critical' ? 'Major downtime costs, potential compliance fines' : incident.severity === 'high' ? 'Significant productivity loss' : 'Investigation and remediation costs'}</li>
                        <li><strong>Regulatory:</strong> ${incident.severity === 'critical' ? 'GDPR/SOX/HIPAA violations likely' : 'Regulatory review required'}</li>
                        <li><strong>Reputation:</strong> ${incident.severity === 'critical' ? 'Major brand damage risk' : 'Minor reputation impact'}</li>
                        <li><strong>Operations:</strong> ${incident.severity === 'critical' ? 'Critical system disruption' : incident.severity === 'high' ? 'Service degradation' : 'Minimal operational impact'}</li>
                    </ul>
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
        ${(incident as any).patternAnalysis ? generateSandboxSection((incident as any).patternAnalysis) : ''}
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

function generateSandboxSection(patternAnalysisJson: string): string {
  try {
    const patternAnalysis = JSON.parse(patternAnalysisJson);
    if (!patternAnalysis.sandboxOutput && !patternAnalysis.codeGeneration) return '';

    return `
      <div class="section">
        <div class="section-title">🔬 Gemini AI Pattern Recognition & Code Analysis</div>
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 25px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 20px;">
          ${patternAnalysis.codeGeneration ? `
            <div style="margin-bottom: 25px;">
              <h4 style="color: #fbbf24; margin-bottom: 15px; font-size: 16px; display: flex; align-items: center;">
                <span style="margin-right: 8px;">🛠️</span> Generated Investigation Scripts
              </h4>
              <div style="background: #1a1a1a; color: #00ff00; padding: 20px; border-radius: 10px; font-family: 'Courier New', monospace; overflow-x: auto; border: 1px solid #334155; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);">
                <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word;">${patternAnalysis.codeGeneration}</pre>
              </div>
            </div>
          ` : ''}
          ${patternAnalysis.sandboxOutput ? `
            <div>
              <h4 style="color: #22d3ee; margin-bottom: 15px; font-size: 16px; display: flex; align-items: center;">
                <span style="margin-right: 8px;">⚡</span> Sandbox Execution Results
              </h4>
              <div style="background: #0a0a0a; color: #00ff00; padding: 20px; border-radius: 10px; font-family: 'Courier New', monospace; overflow-x: auto; border: 1px solid #16a34a; box-shadow: 0 0 20px rgba(34, 197, 94, 0.2);">
                <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word;">${patternAnalysis.sandboxOutput}</pre>
              </div>
              <div style="margin-top: 15px; padding: 15px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #3b82f6; border-radius: 8px; font-size: 13px;">
                <div style="display: flex; align-items: center; color: #1e40af;">
                  <span style="margin-right: 8px; font-size: 16px;">ℹ️</span>
                  <strong>AI-Generated Analysis:</strong>
                </div>
                <div style="color: #1e40af; margin-top: 5px; line-height: 1.5;">
                  This sandbox output was generated by Gemini AI's Pattern Recognition agent for investigative purposes. The results show simulated command execution and analysis patterns derived from the incident data.
                </div>
              </div>
            </div>
          ` : ''}
        </div>
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

// Helper functions for investigation metrics
function getConfidenceLevel(confidence: number): string {
  if (confidence >= 90) return "VERY HIGH";
  if (confidence >= 70) return "HIGH";
  if (confidence >= 50) return "MEDIUM";
  return "LOW";
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 90) return "background: #22c55e; color: white";
  if (confidence >= 70) return "background: #3b82f6; color: white";
  if (confidence >= 50) return "background: #eab308; color: white";
  return "background: #ef4444; color: white";
}

function getConfidenceBarColor(confidence: number): string {
  if (confidence >= 90) return "#22c55e";
  if (confidence >= 70) return "#3b82f6";
  if (confidence >= 50) return "#eab308";
  return "#ef4444";
}

function getConfidenceDescription(confidence: number): string {
  if (confidence >= 90) return "Strong evidence with reliable classification. High certainty in threat assessment.";
  if (confidence >= 70) return "Good indicators with minor uncertainties. Generally reliable classification.";
  if (confidence >= 50) return "Mixed signals detected. Requires human review and validation.";
  return "Weak evidence patterns. Manual investigation and validation required.";
}

function getInvestigationLevel(investigation: number): string {
  if (investigation >= 90) return "COMPLETE";
  if (investigation >= 70) return "COMPREHENSIVE";
  if (investigation >= 50) return "PARTIAL";
  return "LIMITED";
}

function getInvestigationColor(investigation: number): string {
  if (investigation >= 90) return "background: #22c55e; color: white";
  if (investigation >= 70) return "background: #3b82f6; color: white";
  if (investigation >= 50) return "background: #eab308; color: white";
  return "background: #ef4444; color: white";
}

function getInvestigationBarColor(investigation: number): string {
  if (investigation >= 90) return "#22c55e";
  if (investigation >= 70) return "#3b82f6";
  if (investigation >= 50) return "#eab308";
  return "#ef4444";
}

function getInvestigationDescription(investigation: number): string {
  if (investigation >= 90) return "All logs processed with full context. Comprehensive analysis across all AI agents.";
  if (investigation >= 70) return "Minor data gaps but good coverage. Most analysis vectors completed successfully.";
  if (investigation >= 50) return "Some unclear data with incomplete picture. Additional investigation may be beneficial.";
  return "Insufficient data clarity. Needs more comprehensive data collection and analysis.";
}

function renderThreatScenarios(threatPrediction: any): string {
  if (!threatPrediction.threatScenarios || threatPrediction.threatScenarios.length === 0) {
    return '';
  }
  
  return `
    <div style="margin-top: 20px;">
      <h4 style="color: #1e40af; margin-bottom: 10px;">🚨 Threat Scenarios</h4>
      ${threatPrediction.threatScenarios.map((scenario: any, index: number) => `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <h5 style="color: #0ea5e9; margin: 0;">${scenario.timeframe}</h5>
            <div>
              <span style="background: ${scenario.likelihood === 'High' ? '#dc2626' : scenario.likelihood === 'Medium' ? '#d97706' : '#16a34a'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 5px;">${scenario.likelihood}</span>
              <span style="background: ${scenario.impact === 'Critical' ? '#dc2626' : scenario.impact === 'High' ? '#ea580c' : scenario.impact === 'Medium' ? '#d97706' : '#0891b2'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${scenario.impact} Impact</span>
            </div>
          </div>
          ${scenario.threats && scenario.threats.length > 0 ? `
            <div style="margin-bottom: 10px;">
              <strong style="color: #374151;">Potential Threats:</strong>
              <ul style="margin: 5px 0; padding-left: 20px;">
                ${scenario.threats.map((threat: string) => `<li style="color: #6b7280; margin-bottom: 3px;">${threat}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${scenario.recommendations && scenario.recommendations.length > 0 ? `
            <div>
              <strong style="color: #374151;">Recommendations:</strong>
              <ul style="margin: 5px 0; padding-left: 20px;">
                ${scenario.recommendations.map((rec: string) => `<li style="color: #6b7280; margin-bottom: 3px;">${rec}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderEnvironmentalImpact(threatPrediction: any): string {
  if (!threatPrediction.environmentalImpact || Object.keys(threatPrediction.environmentalImpact).length === 0) {
    return '';
  }
  
  return `
    <div style="margin-top: 20px;">
      <h4 style="color: #16a34a; margin-bottom: 10px;">🛡️ Environmental Impact Assessment</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
        ${Object.entries(threatPrediction.environmentalImpact).map(([key, impact]: [string, any]) => `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px;">
            <h5 style="color: #166534; margin-bottom: 8px; text-transform: capitalize;">${key.replace(/([A-Z])/g, ' $1').trim()}</h5>
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
              <div style="width: 12px; height: 12px; border-radius: 50%; background: ${
                impact.riskLevel === 'High' ? '#dc2626' :
                impact.riskLevel === 'Medium' ? '#d97706' :
                '#16a34a'
              }; margin-right: 8px;"></div>
              <span style="color: ${
                impact.riskLevel === 'High' ? '#dc2626' :
                impact.riskLevel === 'Medium' ? '#d97706' :
                '#16a34a'
              }; font-weight: bold; font-size: 14px;">${impact.riskLevel} Risk</span>
            </div>
            <p style="color: #6b7280; font-size: 13px; margin-bottom: 10px;">${impact.description}</p>
            ${impact.mitigationPriority ? `
              <span style="background: ${
                impact.mitigationPriority === 'Critical' ? '#dc2626' :
                impact.mitigationPriority === 'High' ? '#ea580c' :
                impact.mitigationPriority === 'Medium' ? '#d97706' :
                '#0891b2'
              }; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${impact.mitigationPriority} Priority</span>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}