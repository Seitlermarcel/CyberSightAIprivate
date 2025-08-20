import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  X, 
  Printer, 
  Shield, 
  TrendingUp, 
  Brain,
  MapPin,
  Code,
  Zap,
  Shield as FileShield,
  Link2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Send,
  RotateCcw,
  Info,
  Target,
  AlertTriangle,
  Activity,
  Terminal,
  DollarSign,
  Clock,
  Users,
  Network,
  Loader2,
  Globe,
  HelpCircle
} from "lucide-react";
import { generateIncidentPDF } from "@/utils/pdf-export";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Incident } from "@shared/schema";
import ThreatIntelligence from "@/components/threat-intelligence";

interface IncidentDetailProps {
  incidentId: string;
  onClose: () => void;
  requireComments?: boolean;
}

export default function IncidentDetail({ incidentId, onClose, requireComments = false }: IncidentDetailProps) {
  const [activeTab, setActiveTab] = useState("workflow");
  const [comment, setComment] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [currentIncidentId, setCurrentIncidentId] = useState(incidentId);
  const [statusChangeComment, setStatusChangeComment] = useState("");
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<string | null>(null);
  const [isLoadingThreatIntel, setIsLoadingThreatIntel] = useState(false);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: incident, isLoading } = useQuery<Incident>({
    queryKey: ["/api/incidents", currentIncidentId],
  });

  // Get user's subscription plan for dynamic pricing
  const { data: userData } = useQuery({
    queryKey: ["/api/user"],
  });

  // Calculate dynamic analysis cost based on subscription plan
  const getAnalysisCost = () => {
    const plan = (userData as any)?.subscriptionPlan || 'free';
    const baseCost = 25.00;
    
    switch (plan) {
      case 'starter': return (baseCost * 1.0).toFixed(2); // €25.00
      case 'professional': return (baseCost * 0.95).toFixed(2); // €23.75
      case 'business': return (baseCost * 0.90).toFixed(2); // €22.50  
      case 'enterprise': return (baseCost * 0.80).toFixed(2); // €20.00
      default: return baseCost.toFixed(2);
    }
  };

  // Function to navigate to similar incident with enhanced tracking
  const navigateToIncident = (newIncidentId: string) => {
    if (newIncidentId && newIncidentId !== currentIncidentId) {
      setCurrentIncidentId(newIncidentId);
      setActiveTab("workflow"); // Reset to overview tab
      setProcessingTime(Math.floor(Math.random() * 5 + 3)); // Simulate processing time 3-8s
      toast({
        title: "Navigated to Similar Incident",
        description: `Loading incident ${newIncidentId.substring(0, 8)}...`,
      });
    }
  };




  const updateIncidentMutation = useMutation({
    mutationFn: async (updates: Partial<Incident>) => {
      const response = await apiRequest("PATCH", `/api/incidents/${incidentId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      toast({
        title: "Incident Updated",
        description: "Changes have been saved successfully.",
      });
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-900"; // Dark Red
      case "high": return "bg-red-600"; // Vivid Red
      case "medium": return "bg-orange-500"; // Orange
      case "low": return "bg-yellow-500"; // Yellow
      default: return "bg-gray-500"; // Grey for informational
    }
  };

  const getInvestigationStatus = (percentage: number) => {
    if (percentage >= 90) return "Complete – All logs processed";
    if (percentage >= 70) return "Comprehensive – Minor gaps";
    if (percentage >= 50) return "Partial – Some unclear data";
    return "Limited – Insufficient clarity";
  };

  const getConfidenceLevel = (percentage: number) => {
    if (percentage >= 90) return "Very High – Strong evidence";
    if (percentage >= 70) return "High – Minor uncertainties";
    if (percentage >= 50) return "Medium – Needs human review";
    return "Low – Manual validation required";
  };

  const getClassificationColor = (classification: string) => {
    return classification === "true-positive" ? "bg-red-600" : "bg-green-500";
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const addComment = () => {
    if (!comment.trim()) return;
    
    const timestamp = format(new Date(), "MMM d, yyyy 'at' h:mm a");
    const analystName = (userData as any)?.username || 'Security Analyst';
    const auditComment = `[${timestamp}] ${analystName}: ${comment}`;
    
    const updatedComments = [...(incident?.comments || []), auditComment];
    updateIncidentMutation.mutate({ 
      comments: updatedComments,
      updatedAt: new Date()
    });
    setComment("");
  };

  const exportToPDF = () => {
    if (!incident) return;
    generateIncidentPDF(incident, userData);
    toast({
      title: "PDF Export",
      description: "Incident report has been prepared for printing/download.",
    });
  };

  const updateStatus = (status: string) => {
    if (requireComments && !statusChangeComment.trim()) {
      setPendingStatusChange(status);
      setShowCommentDialog(true);
      toast({
        title: "Comment Required",
        description: "Please provide a comment for this status change.",
        variant: "destructive",
      });
      return;
    }

    const timestamp = format(new Date(), "MMM d, yyyy 'at' h:mm a");
    const analystName = (userData as any)?.username || 'Security Analyst';
    const baseComment = `[${timestamp}] ${analystName}: Status updated to ${status.toUpperCase()}`;
    const fullComment = statusChangeComment.trim() 
      ? `${baseComment} - ${statusChangeComment.trim()}`
      : baseComment;
    
    const updatedComments = [...(incident?.comments || []), fullComment];
    updateIncidentMutation.mutate({ 
      status,
      comments: updatedComments,
      updatedAt: new Date()
    });
    
    setStatusChangeComment("");
    setPendingStatusChange(null);
    setShowCommentDialog(false);
  };

  const updateSeverity = (severity: string) => {
    const timestamp = format(new Date(), "MMM d, yyyy 'at' h:mm a");
    const analystName = (userData as any)?.username || 'Security Analyst';
    const severityComment = `[${timestamp}] ${analystName}: Severity changed to ${severity.toUpperCase()}`;
    
    const updatedComments = [...(incident?.comments || []), severityComment];
    updateIncidentMutation.mutate({ 
      severity,
      comments: updatedComments,
      updatedAt: new Date()
    });
  };

  const updateClassification = (classification: string) => {
    const timestamp = format(new Date(), "MMM d, yyyy 'at' h:mm a");
    const analystName = (userData as any)?.username || 'Security Analyst';
    const classificationComment = `[${timestamp}] ${analystName}: Classification updated to ${classification === 'true-positive' ? 'TRUE POSITIVE' : 'FALSE POSITIVE'}`;
    
    const updatedComments = [...(incident?.comments || []), classificationComment];
    updateIncidentMutation.mutate({ 
      classification,
      comments: updatedComments,
      updatedAt: new Date()
    });
  };

  if (isLoading || !incident) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="cyber-slate rounded-xl p-8">
          <div className="w-16 h-16 border-4 border-cyber-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading incident details...</p>
        </div>
      </div>
    );
  }

  // Parse JSON fields safely
  const mitreDetails = (() => {
    try {
      if (incident?.mitreDetails) return JSON.parse(incident.mitreDetails);
      if ((incident as any)?.mitreTactics) return { tactics: JSON.parse((incident as any).mitreTactics), techniques: [] };
      if (incident?.mitreAttack && Array.isArray(incident.mitreAttack)) {
        return { 
          tactics: [], 
          techniques: incident.mitreAttack.map((id: string) => ({ 
            id, 
            name: `MITRE Technique ${id}`, 
            description: `Security technique identified: ${id}` 
          }))
        };
      }
      return { tactics: [], techniques: [] };
    } catch (e) {
      return { tactics: [], techniques: [] };
    }
  })();
  
  const iocDetails = (() => {
    try {
      if (incident?.iocDetails) {
        return JSON.parse(incident.iocDetails);
      }
      // Fallback for basic IOCs array with enhanced data
      if (incident?.iocs && Array.isArray(incident.iocs)) {
        return incident.iocs.map((ioc: string) => {
          // Determine IOC type based on content
          let type = 'unknown';
          if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ioc)) type = 'ip';
          else if (/^[a-f0-9]{32}$/.test(ioc)) type = 'md5';
          else if (/^[a-f0-9]{40}$/.test(ioc)) type = 'sha1';
          else if (/^[a-f0-9]{64}$/.test(ioc)) type = 'sha256';
          else if (/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(ioc)) type = 'domain';
          
          return {
            value: ioc,
            type,
            confidence: 'medium',
            reputation: 'Analyzing...',
            geoLocation: type === 'ip' ? 'Location lookup pending' : 'N/A',
            threatIntelligence: 'AlienVault OTX data pending'
          };
        });
      }
      return [];
    } catch (e) {
      return [];
    }
  })();
  
  const patternAnalysis = (() => {
    try {
      return incident?.patternAnalysis ? JSON.parse(incident.patternAnalysis) : [];
    } catch (e) {
      return [];
    }
  })();
  
  const purpleTeam = (() => {
    try {
      return incident?.purpleTeam ? JSON.parse(incident.purpleTeam) : { redTeam: [], blueTeam: [] };
    } catch (e) {
      return { redTeam: [], blueTeam: [] };
    }
  })();
  
  const entityMapping = (() => {
    try {
      if (incident?.entityMapping) {
        const parsed = JSON.parse(incident.entityMapping);
        return {
          entities: parsed.entities || [],
          relationships: parsed.relationships || [],
          networkTopology: parsed.networkTopology || []
        };
      }
      return { entities: [], relationships: [], networkTopology: [] };
    } catch (e) {
      return { entities: [], relationships: [], networkTopology: [] };
    }
  })();
  
  const codeAnalysis = (() => {
    try {
      if (incident?.codeAnalysis) {
        const parsed = JSON.parse(incident.codeAnalysis);
        return {
          summary: parsed.summary || parsed.analysis || '',
          language: parsed.language || 'Unknown',
          findings: parsed.findings || [],
          sandboxOutput: parsed.sandboxOutput || 'No sandbox execution performed',
          executionOutput: parsed.executionOutput || 'No execution output available'
        };
      }
      return { summary: '', language: '', findings: [], sandboxOutput: '', executionOutput: '' };
    } catch (e) {
      return { summary: '', language: '', findings: [], sandboxOutput: '', executionOutput: '' };
    }
  })();
  
  const similarIncidents = (() => {
    try {
      return incident?.similarIncidents ? JSON.parse(incident.similarIncidents) : [];
    } catch (e) {
      return [];
    }
  })();
  
  const attackVectors = (() => {
    try {
      return incident?.attackVectors ? JSON.parse(incident.attackVectors) : [];
    } catch (e) {
      return [];
    }
  })();
  
  const complianceImpact = (() => {
    try {
      return incident?.complianceImpact ? JSON.parse(incident.complianceImpact) : [];
    } catch (e) {
      return [];
    }
  })();
  
  const threatPrediction = (() => {
    try {
      return incident?.threatPrediction ? JSON.parse(incident.threatPrediction) : { threatScenarios: [], environmentalImpact: {} };
    } catch (e) {
      return { threatScenarios: [], environmentalImpact: {} };
    }
  })();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="cyber-dark rounded-xl w-full h-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="cyber-slate border-b border-cyber-slate-light p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 cyber-dark rounded-lg flex items-center justify-center">
              <Shield className="text-severity-high text-lg" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{incident.title}</h2>
              <div className="flex items-center space-x-2 text-sm text-gray-400">
                <span>{format(new Date(incident.createdAt!), "MMM d, yyyy 'at' h:mm a")}</span>
                <span>•</span>
                <span>Confidence: {incident.confidence}%</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={`${getSeverityColor(incident.severity)} text-white uppercase`}>
              {incident.severity}
            </Badge>
            <Badge className={`${getClassificationColor(incident.classification || "")} text-white`}>
              {incident.classification === "true-positive" ? "TRUE POSITIVE" : "FALSE POSITIVE"}
            </Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={exportToPDF}
              className="text-gray-400 hover:text-white hover:bg-cyber-blue mr-2"
            >
              <Printer className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
            {(() => {
              try {
                const patternAnalysis = (incident as any).patternAnalysis;
                const hasCodeOutput = patternAnalysis && typeof patternAnalysis === 'string' && 
                  (JSON.parse(patternAnalysis).sandboxOutput || JSON.parse(patternAnalysis).codeGeneration);
                
                if (hasCodeOutput) {
                  return (
                    <Button 
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const parsed = JSON.parse(patternAnalysis);
                        const sandboxOutput = parsed.sandboxOutput || parsed.codeGeneration || 'No code output available';
                        const codeGeneration = parsed.codeGeneration || '';
                        const sandboxWindow = window.open('', '_blank');
                        if (sandboxWindow) {
                          sandboxWindow.document.write(`
                            <html>
                            <head>
                              <title>Gemini AI Code Analysis - Incident ${incident.id}</title>
                              <style>
                                body { 
                                  background: #0a0a0a; 
                                  color: #00ff00; 
                                  font-family: 'Courier New', monospace; 
                                  padding: 20px; 
                                  line-height: 1.6; 
                                  margin: 0;
                                }
                                .header { 
                                  color: #00BFFF; 
                                  border-bottom: 2px solid #333; 
                                  padding-bottom: 15px; 
                                  margin-bottom: 20px; 
                                }
                                .section {
                                  margin-bottom: 30px;
                                }
                                .section-title {
                                  color: #FFD700;
                                  font-size: 18px;
                                  font-weight: bold;
                                  margin-bottom: 10px;
                                }
                                .code-output { 
                                  background: #1a1a1a; 
                                  padding: 20px; 
                                  border: 1px solid #333; 
                                  border-radius: 8px; 
                                  overflow-x: auto; 
                                  white-space: pre-wrap; 
                                  word-wrap: break-word; 
                                }
                                .timestamp { 
                                  color: #888; 
                                  font-size: 14px; 
                                  margin-top: 20px; 
                                  border-top: 1px solid #333;
                                  padding-top: 15px;
                                }
                              </style>
                            </head>
                            <body>
                              <div class="header">
                                <h2>🔬 Gemini AI Pattern Recognition & Code Analysis</h2>
                                <p>Incident ID: ${incident.id} | Generated by CyberSight AI</p>
                              </div>
                              ${codeGeneration ? `
                                <div class="section">
                                  <div class="section-title">🛠️ Generated Investigation Code</div>
                                  <div class="code-output">${codeGeneration}</div>
                                </div>
                              ` : ''}
                              <div class="section">
                                <div class="section-title">⚡ Sandbox Execution Results</div>
                                <div class="code-output">${sandboxOutput}</div>
                              </div>
                              <div class="timestamp">Generated: ${new Date().toLocaleString()} | Powered by Gemini AI</div>
                            </body>
                            </html>
                          `);
                          sandboxWindow.document.close();
                        }
                      }}
                      className="text-green-400 hover:text-green-300 hover:bg-green-900/20"
                    >
                      <Terminal className="w-4 h-4 mr-2" />
                      View Code
                    </Button>
                  );
                }
                return null;
              } catch {
                return null;
              }
            })()}
            <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Analysis Results Section */}
        <div className="p-6 border-b border-cyber-slate-light">
          <div className="flex items-center space-x-2 mb-4">
            <Shield className="text-severity-high" />
            <h3 className="text-lg font-semibold">Analysis Results</h3>
            <div className="ml-auto flex items-center space-x-2">
              <Badge className={`${getSeverityColor(incident.severity)} text-white uppercase`}>
                {incident.severity}
              </Badge>
              <Badge className={`${getClassificationColor(incident.classification || "")} text-white`}>
                {incident.classification === "true-positive" ? "TRUE POSITIVE" : "FALSE POSITIVE"}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-400">Confidence Score</span>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="p-0 h-4 w-4 text-gray-500 hover:text-gray-300">
                        <Info className="h-3 w-3" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="cyber-slate border-cyber-slate-light max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center space-x-2">
                          <Shield className="h-5 w-5 text-cyber-blue" />
                          <span>Confidence Score</span>
                        </DialogTitle>
                        <DialogDescription className="text-gray-300">
                          Measures AI's certainty in threat classification and decision reliability
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-200">Scoring Ranges:</h4>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-3 p-2 rounded cyber-dark">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <div>
                                <span className="text-green-400 font-medium">90–100%</span>
                                <span className="text-gray-300 ml-2">Very High – Strong evidence, reliable classification</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3 p-2 rounded cyber-dark">
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                              <div>
                                <span className="text-blue-400 font-medium">70–89%</span>
                                <span className="text-gray-300 ml-2">High – Good indicators, minor uncertainties</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3 p-2 rounded cyber-dark">
                              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                              <div>
                                <span className="text-yellow-400 font-medium">50–69%</span>
                                <span className="text-gray-300 ml-2">Medium – Mixed signals, needs human review</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3 p-2 rounded cyber-dark">
                              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                              <div>
                                <span className="text-red-400 font-medium">&lt;50%</span>
                                <span className="text-gray-300 ml-2">Low – Weak evidence, manual validation required</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="border-t border-gray-600 pt-3">
                          <h4 className="text-sm font-medium text-gray-200 mb-2">What it does:</h4>
                          <p className="text-sm text-gray-300">
                            Helps security analysts prioritize incidents by showing how certain the AI is about threat classification. 
                            Higher scores indicate more reliable automated decisions, while lower scores signal the need for manual investigation.
                          </p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <span className="text-sm font-medium">{incident.confidence}%</span>
              </div>
              <Progress value={incident.confidence || 0} className="h-2" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Brain className="text-cyber-purple w-4 h-4" />
                  <span className="text-sm text-gray-400">AI Investigation</span>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="p-0 h-4 w-4 text-gray-500 hover:text-gray-300">
                        <Info className="h-3 w-3" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="cyber-slate border-cyber-slate-light max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center space-x-2">
                          <Brain className="h-5 w-5 text-cyber-purple" />
                          <span>AI Investigation</span>
                        </DialogTitle>
                        <DialogDescription className="text-gray-300">
                          Measures analysis completeness across all data sources and AI agents
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-200">Completeness Levels:</h4>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-3 p-2 rounded cyber-dark">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <div>
                                <span className="text-green-400 font-medium">90–100%</span>
                                <span className="text-gray-300 ml-2">Complete – All logs processed, full context</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3 p-2 rounded cyber-dark">
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                              <div>
                                <span className="text-blue-400 font-medium">70–89%</span>
                                <span className="text-gray-300 ml-2">Comprehensive – Minor data gaps, good coverage</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3 p-2 rounded cyber-dark">
                              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                              <div>
                                <span className="text-yellow-400 font-medium">50–69%</span>
                                <span className="text-gray-300 ml-2">Partial – Some unclear data, incomplete picture</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3 p-2 rounded cyber-dark">
                              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                              <div>
                                <span className="text-red-400 font-medium">&lt;50%</span>
                                <span className="text-gray-300 ml-2">Limited – Insufficient data, needs more investigation</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="border-t border-gray-600 pt-3">
                          <h4 className="text-sm font-medium text-gray-200 mb-2">What it does:</h4>
                          <p className="text-sm text-gray-300">
                            Shows how thoroughly the 8 specialized AI agents analyzed available data. Higher scores mean more comprehensive 
                            investigation across MITRE ATT&CK tactics, IOCs, behavioral patterns, and threat vectors. This helps determine 
                            if additional data collection or analysis is needed.
                          </p>
                        </div>
                        
                        <div className="cyber-dark rounded p-3">
                          <h5 className="text-xs font-medium text-cyber-purple mb-1">AI Agents Coverage:</h5>
                          <p className="text-xs text-gray-400">
                            MITRE Analysis • IOC Detection • Pattern Recognition • Purple Team Assessment • 
                            Entity Mapping • Code Analysis • Attack Vectors • Compliance Check
                          </p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <span className="text-sm font-medium">{incident.aiInvestigation || 85}%</span>
              </div>
              {/* Enhanced Multi-color gradient progress bar inspired by Microsoft Copilot */}
              <div className="relative w-full h-3 bg-cyber-slate rounded-full overflow-hidden">
                <div 
                  className="absolute inset-0 transition-all duration-700 ease-out"
                  style={{ 
                    width: `${incident.aiInvestigation || 85}%`,
                    background: 'linear-gradient(90deg, #60a5fa 0%, #a855f7 25%, #ec4899 50%, #06b6d4 75%, #10b981 100%)'
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse opacity-50" />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Multiple AI Agents</span>
                <span>Processing Complete</span>
              </div>
            </div>
          </div>

          {incident.analysisExplanation && (
            <div className="mt-4 cyber-slate rounded-lg p-4">
              <h4 className="font-semibold mb-2">Analysis Explanation</h4>
              <p className="text-sm text-gray-300">{incident.analysisExplanation}</p>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-cyber-slate-light">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-12 bg-transparent">
              <TabsTrigger value="workflow" className="text-xs">Workflow</TabsTrigger>
              <TabsTrigger value="threat-intel" className="text-xs">Threat Intel</TabsTrigger>
              <TabsTrigger value="mitre" className="text-xs">MITRE</TabsTrigger>
              <TabsTrigger value="iocs" className="text-xs">IOCs</TabsTrigger>
              <TabsTrigger value="patterns" className="text-xs">Patterns</TabsTrigger>
              <TabsTrigger value="purple-team" className="text-xs">Purple Team</TabsTrigger>
              <TabsTrigger value="entities" className="text-xs">Entities</TabsTrigger>
              <TabsTrigger value="code" className="text-xs">Code</TabsTrigger>
              <TabsTrigger value="vectors" className="text-xs">Vectors</TabsTrigger>
              <TabsTrigger value="compliance" className="text-xs">Compliance</TabsTrigger>
              <TabsTrigger value="similar" className="text-xs">Similar</TabsTrigger>
              <TabsTrigger value="threat-prediction" className="text-xs">Prediction</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* Workflow Tab */}
            <TabsContent value="workflow" className="p-6 space-y-6">
              <div className="cyber-slate rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Incident Workflow & Triage</h3>
                
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Status</label>
                    <Select value={incident.status} onValueChange={updateStatus}>
                      <SelectTrigger className="cyber-dark border-cyber-slate-light">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="cyber-dark border-cyber-slate-light">
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    {requireComments && (
                      <Dialog open={showCommentDialog} onOpenChange={setShowCommentDialog}>
                        <DialogContent className="cyber-dark border-cyber-slate-light">
                          <DialogHeader>
                            <DialogTitle>Comment Required for Status Change</DialogTitle>
                            <DialogDescription>
                              Please provide a comment explaining this status change to {pendingStatusChange}.
                            </DialogDescription>
                          </DialogHeader>
                          <Textarea
                            placeholder="Enter your comment..."
                            value={statusChangeComment}
                            onChange={(e) => setStatusChangeComment(e.target.value)}
                            className="cyber-dark border-cyber-slate-light text-white"
                            rows={3}
                          />
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowCommentDialog(false);
                                setStatusChangeComment("");
                                setPendingStatusChange(null);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => {
                                if (pendingStatusChange) {
                                  updateStatus(pendingStatusChange);
                                }
                              }}
                              disabled={!statusChangeComment.trim()}
                              className="cyber-blue"
                            >
                              Submit
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Severity</label>
                    <Select value={incident.severity} onValueChange={updateSeverity}>
                      <SelectTrigger className="cyber-dark border-cyber-slate-light">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="cyber-dark border-cyber-slate-light">
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="informational">Informational</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Analysis Result</label>
                    <Select value={incident.classification || ""} onValueChange={updateClassification}>
                      <SelectTrigger className="cyber-dark border-cyber-slate-light">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="cyber-dark border-cyber-slate-light">
                        <SelectItem value="true-positive">True Positive</SelectItem>
                        <SelectItem value="false-positive">False Positive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="text-sm text-gray-400 mb-2 block">Add Comment</label>
                  <div className="flex space-x-2">
                    <Textarea
                      placeholder="Add a comment about the status change or findings..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="cyber-dark border-cyber-slate-light text-white placeholder-gray-500 resize-none"
                      rows={3}
                    />
                    <Button 
                      onClick={addComment}
                      disabled={!comment.trim() || updateIncidentMutation.isPending}
                      className="cyber-blue hover:bg-blue-600"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button
                    onClick={() => updateIncidentMutation.mutate({ updatedAt: new Date() })}
                    disabled={updateIncidentMutation.isPending}
                    className="mt-2 cyber-blue hover:bg-blue-600"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Update Incident
                  </Button>
                </div>
              </div>

              <div className="cyber-slate rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Comments & Status History</h3>
                {incident.comments && incident.comments.length > 0 ? (
                  <div className="space-y-3">
                    {incident.comments.map((comment, index) => (
                      <div key={index} className="cyber-dark rounded-lg p-3">
                        <p className="text-sm text-gray-300">{comment}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">No comments or status changes yet</p>
                )}
              </div>
            </TabsContent>

            {/* Threat Intelligence Tab */}
            <TabsContent value="threat-intel" className="p-6">
              {incident.threatIntelligence ? (
                <ThreatIntelligence threatReport={typeof incident.threatIntelligence === 'string' ? JSON.parse(incident.threatIntelligence) : incident.threatIntelligence} />
              ) : (
                <div className="cyber-slate rounded-xl p-6">
                  <div className="text-center py-8">
                    <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 mb-2">No threat intelligence data available</p>
                    <p className="text-gray-500 text-sm">This incident may not contain IOCs suitable for threat intelligence analysis</p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* MITRE ATT&CK Tab */}
            <TabsContent value="mitre" className="p-6 space-y-6">
              {/* Main Tactics Overview */}
              <div className="cyber-slate rounded-xl p-6">
                <div className="flex items-center space-x-2 mb-6">
                  <Shield className="text-cyber-purple" />
                  <h3 className="text-lg font-semibold">MITRE ATT&CK Framework Analysis</h3>
                </div>

                {/* Tactics Summary Bar */}
                {mitreDetails.tactics && mitreDetails.tactics.length > 0 ? (
                  <div className="mb-6">
                    <h4 className="text-md font-semibold mb-4 text-cyber-purple">Primary Tactics Identified</h4>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      {mitreDetails.tactics.map((tactic: any, index: number) => (
                        <div key={index} className="cyber-dark rounded-lg p-4 border-l-4 border-purple-500">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge className="bg-purple-700 text-white text-xs">{tactic.id}</Badge>
                            <span className="text-xs text-purple-400 uppercase">TACTIC</span>
                          </div>
                          <h5 className="font-semibold text-white mb-1">{tactic.name}</h5>
                          <p className="text-xs text-gray-400">{tactic.description?.substring(0, 80) + '...'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 mb-6">
                    <Shield className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No primary tactics identified</p>
                    <p className="text-gray-500 text-sm">MITRE tactics represent the 'why' behind an attack</p>
                  </div>
                )}

                {/* Enhanced Techniques Table */}
                <div>
                  <h4 className="text-md font-semibold mb-4 flex items-center space-x-2">
                    <TrendingUp className="text-cyber-cyan w-4 h-4" />
                    <span>Techniques, Tactics & Procedures (TTPs)</span>
                  </h4>
                  
                  {mitreDetails.techniques && mitreDetails.techniques.length > 0 ? (
                    <div className="cyber-dark rounded-lg overflow-hidden">
                      {/* Table Header */}
                      <div className="cyber-slate-light border-b border-gray-600 p-4">
                        <div className="grid grid-cols-5 gap-4 text-sm font-semibold text-gray-300">
                          <div>Technique ID</div>
                          <div className="col-span-2">Technique Name</div>
                          <div>Category</div>
                          <div>Risk Level</div>
                        </div>
                      </div>
                      
                      {/* Table Body */}
                      <div className="divide-y divide-gray-700">
                        {mitreDetails.techniques.map((technique: any, index: number) => (
                          <div key={index} className="p-4 hover:bg-gray-800 transition-colors">
                            <div className="grid grid-cols-5 gap-4 items-start">
                              {/* Technique ID */}
                              <div className="flex items-center space-x-2">
                                <Badge className="bg-cyan-700 text-white text-xs">{technique.id}</Badge>
                              </div>
                              
                              {/* Technique Name & Description */}
                              <div className="col-span-2">
                                <h5 className="font-semibold text-white mb-1">{technique.name}</h5>
                                <p className="text-xs text-gray-400 line-clamp-2">{technique.description}</p>
                              </div>
                              
                              {/* Category */}
                              <div>
                                <Badge variant="outline" className="text-xs text-gray-400 border-gray-600">
                                  {technique.category || 'Attack'}
                                </Badge>
                              </div>
                              
                              {/* Risk Level */}
                              <div>
                                <Badge className={`text-xs ${
                                  technique.risk === 'high' || technique.severity === 'high' ? 'bg-red-700 text-white' :
                                  technique.risk === 'medium' || technique.severity === 'medium' ? 'bg-orange-700 text-white' :
                                  'bg-yellow-700 text-white'
                                }`}>
                                  {technique.risk || technique.severity || 'Medium'}
                                </Badge>
                              </div>
                            </div>
                            
                            {/* Expanded Info */}
                            {technique.mitigations && (
                              <div className="mt-3 pt-3 border-t border-gray-700">
                                <p className="text-xs text-gray-500">
                                  <span className="font-semibold">Mitigations:</span> {technique.mitigations}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400">No specific techniques identified</p>
                      <p className="text-gray-500 text-sm">TTPs represent the 'how' behind an attack implementation</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* IOCs Tab */}
            <TabsContent value="iocs" className="p-6 space-y-6">
              <div className="cyber-slate rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-2">
                    <MapPin className="text-severity-medium" />
                    <h3 className="text-lg font-semibold">Indicators of Compromise (IOCs)</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    {isLoadingThreatIntel && (
                      <div className="flex items-center space-x-1 text-cyan-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs">Loading Threat Intel...</span>
                      </div>
                    )}
                    <Badge className="bg-purple-600 text-white">
                      AlienVault OTX Enhanced
                    </Badge>
                  </div>
                </div>

                {!isLoadingThreatIntel && iocDetails && iocDetails.length > 0 ? (
                  <div className="space-y-4">
                    {iocDetails.map((ioc: any, index: number) => (
                      <div key={index} className="cyber-dark rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <Badge className="cyber-slate-light text-white">{ioc.type}</Badge>
                            <span className="font-mono text-sm">{ioc.value}</span>
                          </div>
                          <Badge className={`${ioc.confidence === 'high' ? 'bg-severity-high' : 'bg-severity-medium'} text-white`}>
                            {ioc.confidence} Confidence
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-400">Reputation:</span>
                            <p className="text-gray-300 mt-1">{ioc.reputation}</p>
                          </div>
                          <div>
                            <span className="text-gray-400">Geo-Location:</span>
                            <p className="text-gray-300 mt-1">{ioc.geoLocation}</p>
                          </div>
                          <div>
                            <span className="text-gray-400">Threat Intelligence:</span>
                            <p className="text-gray-300 mt-1">{ioc.threatIntelligence}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">No indicators of compromise identified for this incident</p>
                )}
              </div>
            </TabsContent>

            {/* Patterns Tab */}
            <TabsContent value="patterns" className="p-6 space-y-6">
              <div className="cyber-slate rounded-xl p-6">
                <div className="flex items-center space-x-2 mb-6">
                  <TrendingUp className="text-cyber-blue" />
                  <h3 className="text-lg font-semibold">Log Pattern Analysis</h3>
                </div>

                {patternAnalysis && patternAnalysis.length > 0 ? (
                  <div className="space-y-4">
                    {patternAnalysis.map((pattern: any, index: number) => (
                      <div key={index} className="cyber-dark rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <TrendingUp className="text-cyber-blue w-4 h-4" />
                            <span className="font-semibold">{pattern.pattern}</span>
                          </div>
                          <Badge className="cyber-blue text-white">
                            High frequency of file creation by a high integrity process. Significance: {pattern.significance}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-300">{pattern.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">No significant log patterns detected for this incident</p>
                )}
              </div>
            </TabsContent>

            {/* Purple Team Tab */}
            <TabsContent value="purple-team" className="p-6 space-y-6">
              <div className="cyber-slate rounded-xl p-6">
                <div className="flex items-center space-x-2 mb-6">
                  <Shield className="text-cyber-purple" />
                  <h3 className="text-lg font-semibold">Purple Team Analysis</h3>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {/* Red Team */}
                  <div className="cyber-dark rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-4">
                      <Zap className="text-severity-high" />
                      <h4 className="font-semibold text-severity-high">Red Team (Attack Simulation)</h4>
                    </div>
                    
                    <div className="cyber-slate rounded-lg p-3 mb-4">
                      <h5 className="font-medium mb-2">Attack Simulation Scenarios</h5>
                      <p className="text-sm text-gray-400">These scenarios simulate how an attacker might replicate the observed incident for training purposes.</p>
                    </div>

                    {purpleTeam.redTeam && purpleTeam.redTeam.length > 0 ? (
                      <div className="space-y-3">
                        {purpleTeam.redTeam.map((scenario: any, index: number) => (
                          <div key={index} className="cyber-slate rounded-lg p-3">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge className="bg-severity-high text-white text-xs">{index + 1}</Badge>
                              <h6 className="font-medium">{scenario.scenario}</h6>
                            </div>
                            <div className="text-xs space-y-1">
                              <div>
                                <span className="text-gray-400">SIMULATION STEPS</span>
                                <p className="text-gray-300">{scenario.steps}</p>
                              </div>
                              <div>
                                <span className="text-gray-400">EXPECTED OUTCOME</span>
                                <p className="text-gray-300">{scenario.expectedOutcome}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-center py-4">No red team scenarios available</p>
                    )}
                  </div>

                  {/* Blue Team */}
                  <div className="cyber-dark rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-4">
                      <Shield className="text-cyber-blue" />
                      <h4 className="font-semibold text-cyber-blue">Blue Team (Defense)</h4>
                    </div>

                    <div className="cyber-slate rounded-lg p-3 mb-4">
                      <h5 className="font-medium mb-2">Defense & Remediation Strategy</h5>
                      <p className="text-sm text-gray-400">Comprehensive defense strategies and remediation steps to prevent and respond to this type of incident.</p>
                    </div>

                    {purpleTeam.blueTeam && purpleTeam.blueTeam.length > 0 ? (
                      <div className="space-y-3">
                        {purpleTeam.blueTeam.map((defense: any, index: number) => (
                          <div key={index} className="cyber-slate rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <Badge className="bg-cyber-blue text-white text-xs">{index + 1}</Badge>
                                <h6 className="font-medium">{defense.defense}</h6>
                              </div>
                              <Badge className={`${defense.priority === 'High Priority' ? 'bg-severity-high' : 'bg-severity-medium'} text-white text-xs`}>
                                {defense.priority}
                              </Badge>
                            </div>
                            <div className="text-xs space-y-1">
                              <div>
                                <span className="text-gray-400">DESCRIPTION</span>
                                <p className="text-gray-300">{defense.description}</p>
                              </div>
                              <div>
                                <span className="text-gray-400">TECHNICAL DETAILS</span>
                                <p className="text-gray-300 font-mono text-xs">{defense.technical}</p>
                              </div>
                              <div>
                                <span className="text-gray-400">VERIFICATION</span>
                                <p className="text-gray-300">{defense.verification}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-center py-4">No blue team defenses available</p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Entity Mapping Tab */}
            <TabsContent value="entities" className="p-6 space-y-6">
              <div className="cyber-slate rounded-xl p-6">
                <div className="flex items-center space-x-2 mb-6">
                  <Link2 className="text-cyber-cyan" />
                  <h3 className="text-lg font-semibold">Entity Mapping & Relationships</h3>
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Enhanced Entity Analysis</h4>
                    <Badge className="bg-purple-600 text-white text-xs">
                      Geo-Enhanced
                    </Badge>
                  </div>
                  {entityMapping.entities && entityMapping.entities.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      {entityMapping.entities.map((entity: any, index: number) => (
                        <div key={index} className={`cyber-dark rounded-lg p-4 border-l-4 ${
                          entity.category === 'process' ? 'border-orange-500' : 
                          entity.category === 'user' ? 'border-blue-500' :
                          entity.category === 'host' ? 'border-green-500' : 
                          entity.type === 'IP Address' ? 'border-purple-500' : 'border-red-500'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <Badge className={`text-white text-xs ${
                                entity.category === 'process' ? 'bg-orange-600' : 
                                entity.category === 'user' ? 'bg-blue-600' :
                                entity.category === 'host' ? 'bg-green-600' : 
                                entity.type === 'IP Address' ? 'bg-purple-600' : 'bg-red-600'
                              }`}>
                                {entity.type || entity.category}
                              </Badge>
                              {entity.type === 'IP Address' && entity.geoLocation && (
                                <div className="flex items-center space-x-1">
                                  <Globe className="w-3 h-3 text-cyan-400" />
                                  <span className="text-xs text-gray-400">{entity.geoLocation}</span>
                                </div>
                              )}
                            </div>
                            {entity.reputation && (
                              <Badge className={`text-xs ${entity.reputation === 'Malicious' ? 'bg-red-600' : 'bg-green-600'} text-white`}>
                                {entity.reputation}
                              </Badge>
                            )}
                          </div>
                          <p className="font-mono text-sm text-white mb-1">{entity.value || entity.name}</p>
                          <p className="text-xs text-gray-400">{entity.description}</p>
                          {entity.threatScore && (
                            <div className="mt-2 text-xs">
                              <span className="text-gray-400">Threat Score: </span>
                              <span className={`font-mono ${entity.threatScore > 7 ? 'text-red-400' : entity.threatScore > 4 ? 'text-yellow-400' : 'text-green-400'}`}>
                                {entity.threatScore}/10
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400">
                      <Network className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No entities identified in this incident</p>
                    </div>
                  )}
                </div>

                {/* Enhanced Network Topology with Geo-Location */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">Network Topology & Relationships</h4>
                    <Badge className="bg-cyan-600 text-white text-xs">
                      {entityMapping.relationships?.length || 0} Relationships
                    </Badge>
                  </div>
                  {entityMapping.relationships && entityMapping.relationships.length > 0 ? (
                    <div className="space-y-3">
                      {entityMapping.relationships.map((rel: any, index: number) => (
                        <div key={index} className="cyber-dark rounded-lg p-3 border border-gray-600">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Network className="w-4 h-4 text-cyan-400" />
                              <span className="text-sm font-mono text-white">{rel.from}</span>
                              <span className="text-gray-400">→</span>
                              <span className="text-sm font-mono text-white">{rel.to}</span>
                            </div>
                            <Badge className="bg-cyan-600 text-white text-xs">
                              {rel.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{rel.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-400">
                      <p className="text-sm">No entity relationships mapped</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Patterns Tab */}
            <TabsContent value="patterns" className="p-6 space-y-6">
              <div className="cyber-slate rounded-xl p-6">
                <div className="flex items-center space-x-2 mb-6">
                  <TrendingUp className="text-blue-500" />
                  <h3 className="text-lg font-semibold">Log Pattern Analysis</h3>
                </div>

                {patternAnalysis && patternAnalysis.length > 0 ? (
                  <div className="space-y-4">
                    {patternAnalysis.map((pattern: any, index: number) => (
                      <div key={index} className="cyber-dark rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-white">Pattern Analysis</span>
                        </div>
                        <p className="text-xs text-gray-400">{(pattern as any).description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">No patterns identified</p>
                )}

                <div className="mb-6">
                  <h4 className="font-medium mb-3">Entity Relationships</h4>
                  {entityMapping.relationships && entityMapping.relationships.length > 0 ? (
                    <div className="space-y-2">
                      {entityMapping.relationships.map((rel: any, index: number) => (
                        <div key={index} className="cyber-dark rounded-lg p-3">
                          <div className="flex items-center space-x-3">
                            <span className="font-mono text-sm text-orange-400">{rel.source}</span>
                            <Badge className="cyber-slate-light text-white text-xs">{rel.action}</Badge>
                            <span className="font-mono text-sm text-red-400">{rel.target}</span>
                          </div>
                          {rel.description && (
                            <p className="text-xs text-gray-400 mt-2">{rel.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400">No relationships identified</p>
                  )}
                </div>

                <div>
                  <h4 className="font-medium mb-3 flex items-center space-x-2">
                    <Network className="text-cyber-cyan w-4 h-4" />
                    <span>Network Topology & Communication Paths</span>
                  </h4>
                  {entityMapping.networkTopology && entityMapping.networkTopology.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-4 gap-4">
                        {entityMapping.networkTopology.map((node: any, index: number) => (
                          <div key={index} className="cyber-dark rounded-lg p-4 relative border-l-4 border-gray-600 hover:border-cyan-500 transition-colors">
                            {/* Risk indicator */}
                            <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${
                              node.risk === 'high' ? 'bg-red-500' :
                              node.risk === 'medium' ? 'bg-orange-500' : 'bg-green-500'
                            }`} />
                            
                            {/* Node type icon */}
                            <div className={`w-10 h-10 rounded-lg mx-auto mb-3 flex items-center justify-center text-white text-sm font-bold border-2 ${
                              node.type === 'external' ? 'bg-red-800 border-red-600' : 'bg-blue-800 border-blue-600'
                            }`}>
                              {node.category === 'process' ? '⚙️' :
                               node.category === 'user' ? '👤' :
                               node.category === 'network' ? '🌐' :
                               node.category === 'file' ? '📁' : '💻'}
                            </div>
                            
                            {/* Node information */}
                            <div className="text-center">
                              <p className="text-xs font-bold text-white mb-1 truncate" title={node.node || node.entity}>
                                {(node.node || node.entity || '').length > 12 ? 
                                  (node.node || node.entity || '').substring(0, 12) + '...' : 
                                  (node.node || node.entity)}
                              </p>
                              <Badge className={`text-xs mb-2 ${
                                node.type === 'external' ? 'bg-red-700 text-white' : 'bg-blue-700 text-white'
                              }`}>
                                {node.type.toUpperCase()}
                              </Badge>
                              <p className="text-xs text-gray-400 capitalize">{node.category}</p>
                              {node.description && (
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2" title={node.description}>
                                  {node.description.length > 30 ? node.description.substring(0, 30) + '...' : node.description}
                                </p>
                              )}
                            </div>
                            
                            {/* Risk level indicator */}
                            <div className="mt-2 flex items-center justify-center space-x-1">
                              <div className={`w-2 h-2 rounded-full ${
                                node.risk === 'high' ? 'bg-red-500' :
                                node.risk === 'medium' ? 'bg-orange-500' : 'bg-green-500'
                              }`} />
                              <span className={`text-xs capitalize ${
                                node.risk === 'high' ? 'text-red-400' :
                                node.risk === 'medium' ? 'text-orange-400' : 'text-green-400'
                              }`}>
                                {node.risk} Risk
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Network topology summary */}
                      <div className="cyber-slate rounded-lg p-3">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-4">
                            <span className="text-gray-400">Total Nodes:</span>
                            <span className="text-white font-semibold">{entityMapping.networkTopology.length}</span>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span className="text-gray-400">External:</span>
                            <span className="text-red-400 font-semibold">
                              {entityMapping.networkTopology.filter((n: any) => n.type === 'external').length}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span className="text-gray-400">Internal:</span>
                            <span className="text-blue-400 font-semibold">
                              {entityMapping.networkTopology.filter((n: any) => n.type === 'internal').length}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Network className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400">No network topology data available</p>
                      <p className="text-gray-500 text-sm mt-1">Network communication patterns will appear here when detected</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Code Analysis Tab */}
            <TabsContent value="code" className="p-6 space-y-6">
              <div className="cyber-slate rounded-xl p-6">
                <div className="flex items-center space-x-2 mb-6">
                  <Code className="text-green-500" />
                  <h3 className="text-lg font-semibold">Code Analysis & Sandbox Simulation</h3>
                </div>

                {codeAnalysis.summary ? (
                  <div className="space-y-4">
                    <div className="cyber-dark rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className="bg-green-600 text-white">Analysis Summary</Badge>
                        {codeAnalysis.language && (
                          <Badge className="cyber-slate-light text-white">{codeAnalysis.language}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-300">{codeAnalysis.summary}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="cyber-dark rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <FileShield className="text-green-500 w-4 h-4" />
                          <h4 className="font-medium">Code Findings</h4>
                        </div>
                        {codeAnalysis.findings && codeAnalysis.findings.length > 0 ? (
                          <div className="space-y-2">
                            {codeAnalysis.findings.map((finding: any, index: number) => (
                              <div key={index} className="text-sm text-gray-300">{finding}</div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-400 text-center">No specific code findings detected</p>
                        )}
                      </div>

                      <div className="cyber-dark rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <Zap className="text-cyber-blue w-4 h-4" />
                          <h4 className="font-medium">Sandbox Output</h4>
                        </div>
                        {codeAnalysis.sandboxOutput ? (
                          <div className="cyber-slate rounded p-3">
                            <h5 className="font-medium mb-2">Sandbox Simulation</h5>
                            <p className="text-sm text-gray-300">{codeAnalysis.sandboxOutput}</p>
                          </div>
                        ) : (
                          <p className="text-gray-400 text-center">No sandbox simulation performed</p>
                        )}
                      </div>
                    </div>

                    <div className="cyber-dark rounded-lg p-4">
                      <h4 className="font-medium mb-3">Execution Output</h4>
                      <div className="cyber-slate rounded p-3 font-mono text-sm">
                        {codeAnalysis.executionOutput ? (
                          <pre className="whitespace-pre-wrap">
                            {codeAnalysis.executionOutput.split('\n').map((line: string, idx: number) => (
                              <div key={idx} className={
                                line.includes('CRITICAL') ? 'text-red-400' :
                                line.includes('ALERT') ? 'text-orange-400' :
                                line.includes('WARNING') || line.includes('blocked') ? 'text-yellow-400' :
                                line.includes('THREAT INTEL') ? 'text-cyber-blue' :
                                line.includes('successfully') ? 'text-green-400' :
                                'text-gray-300'
                              }>
                                {line}
                              </div>
                            ))}
                          </pre>
                        ) : (
                          <span className="text-gray-400">No execution output available</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">No code analysis performed for this incident</p>
                )}
              </div>
            </TabsContent>

            {/* Attack Vectors Tab */}
            <TabsContent value="vectors" className="p-6 space-y-6">
              <div className="cyber-slate rounded-xl p-6">
                <div className="flex items-center space-x-2 mb-6">
                  <Zap className="text-severity-medium" />
                  <h3 className="text-lg font-semibold">AI-Generated Attack Vector Analysis</h3>
                </div>

                <div className="cyber-dark rounded-lg p-4 mb-6">
                  <div className="flex items-center space-x-2 mb-2">
                    <Zap className="text-severity-medium w-4 h-4" />
                    <h4 className="font-medium">Hypothetical Attack Scenarios</h4>
                  </div>
                  <p className="text-sm text-gray-400">These AI-generated attack vectors represent potential methods attackers might use based on the incident patterns observed.</p>
                </div>

                {attackVectors && attackVectors.length > 0 ? (
                  <div className="space-y-4">
                    {attackVectors.map((vector: any, index: number) => (
                      <div key={index} className="cyber-dark rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Badge className="bg-severity-critical text-white">{vector.vector}</Badge>
                          </div>
                          <Badge className={`${vector.likelihood === 'High Likelihood' ? 'bg-severity-high' : 'bg-severity-medium'} text-white`}>
                            {vector.likelihood}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-300">{vector.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">No attack vectors generated for this incident</p>
                )}

                <div className="cyber-dark rounded-lg p-4 mt-6">
                  <div className="flex items-center space-x-2 mb-2">
                    <Brain className="text-cyber-blue w-4 h-4" />
                    <h4 className="font-medium">Analysis Note</h4>
                  </div>
                  <p className="text-sm text-gray-400">These attack vectors are AI-generated hypotheses based on log patterns and should be used for threat modeling and defense planning. They represent potential attack paths that security teams should consider when strengthening defenses.</p>
                </div>
              </div>
            </TabsContent>

            {/* Compliance Tab */}
            <TabsContent value="compliance" className="p-6 space-y-6">
              <div className="cyber-slate rounded-xl p-6">
                <div className="flex items-center space-x-2 mb-6">
                  <FileShield className="text-cyber-blue" />
                  <h3 className="text-lg font-semibold">Compliance Impact Analysis</h3>
                </div>

                <div className="cyber-dark rounded-lg p-4 mb-6">
                  <h4 className="font-medium mb-2">Regulatory Impact Assessment</h4>
                  <p className="text-sm text-gray-400">Analysis of how this incident may impact various compliance frameworks and regulatory requirements.</p>
                </div>

                {complianceImpact && complianceImpact.length > 0 ? (
                  <div className="space-y-4">
                    {complianceImpact.map((item: any, index: number) => {
                      if (item.recommendation) {
                        return (
                          <div key={index} className="cyber-dark rounded-lg p-4 border-l-4 border-severity-medium">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge className="bg-severity-medium text-white">Compliance Recommendation</Badge>
                            </div>
                            <p className="text-sm text-gray-300">{item.recommendation}</p>
                          </div>
                        );
                      }
                      
                      return (
                        <div key={index} className="cyber-dark rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <Badge className="cyber-blue text-white">{item.framework}</Badge>
                              <span className="text-sm text-gray-400">{item.article || item.requirement}</span>
                            </div>
                            <Badge className="bg-severity-info text-white">{item.impact}</Badge>
                          </div>
                          <p className="text-sm text-gray-300">{item.description}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">No compliance impact analysis available for this incident</p>
                )}
              </div>
            </TabsContent>

            {/* Similar Incidents Tab */}
            <TabsContent value="similar" className="p-6 space-y-6">
              <div className="cyber-slate rounded-xl p-6">
                <div className="flex items-center space-x-2 mb-6">
                  <Link2 className="text-green-500" />
                  <h3 className="text-lg font-semibold">Similar Past Incidents</h3>
                </div>

                {similarIncidents && similarIncidents.length > 0 ? (
                  <div className="space-y-4">
                    {similarIncidents.map((similar: any, index: number) => (
                      <div 
                        key={index} 
                        className="cyber-dark rounded-lg p-4 hover:bg-gray-700 transition-colors cursor-pointer border border-gray-700 hover:border-cyan-500 group"
                        onClick={() => navigateToIncident(similar.incidentId || similar.id)}
                        data-testid={`similar-incident-${index}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Link2 className="text-green-500 w-4 h-4 group-hover:text-cyan-400 transition-colors" />
                            <h4 className="font-medium group-hover:text-cyan-400 transition-colors">{similar.title}</h4>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className="bg-green-600 text-white group-hover:bg-cyan-600 transition-colors">
                              {typeof similar.match === 'string' && similar.match.includes('%') 
                                ? similar.match 
                                : `${similar.match}% Match`}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigateToIncident(similar.id);
                              }}
                              className="text-gray-400 hover:text-white p-1 h-6 w-6"
                              title="Open Similar Incident"
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <span className="text-sm text-gray-400">Common Patterns:</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {similar.patterns.map((pattern: string, patternIndex: number) => (
                              <Badge key={patternIndex} variant="outline" className="text-xs text-gray-400 border-gray-600">
                                {pattern}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <span className="text-sm text-gray-400">AI Analysis:</span>
                          <p className="text-sm text-gray-300 mt-1">{similar.analysis}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">No similar incidents found in the database</p>
                )}
              </div>
            </TabsContent>
            
            {/* Threat Prediction Tab */}
            <TabsContent value="threat-prediction" className="p-6 space-y-6">
              <div className="cyber-slate rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-2">
                    <Target className="text-severity-high" />
                    <h3 className="text-lg font-semibold">Threat Prediction Analysis</h3>
                    <div className="flex items-center space-x-1">
                      <button className="text-gray-400 hover:text-white p-1">
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Analysis Cost</p>
                      <p className="text-sm font-semibold text-green-400">€{getAnalysisCost()}</p>
                    </div>
                    {processingTime && (
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Processing Time</p>
                        <p className="text-sm font-semibold text-cyan-400">{processingTime}s</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Overall Threat Level */}
                <div className="grid grid-cols-3 gap-6 mb-6">
                  <div className="cyber-dark rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">Overall Threat Level</span>
                      <AlertTriangle className="h-4 w-4 text-yellow-400" />
                    </div>
                    <div className="text-2xl font-bold mb-2">{incident.predictionConfidence || 75}%</div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-yellow-500 to-red-500 h-2 rounded-full transition-all duration-700"
                        style={{ width: `${incident.predictionConfidence || 75}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="cyber-dark rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">Risk Trend</span>
                      <Activity className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className={`text-lg font-semibold capitalize mb-2 ${
                      incident.riskTrend === 'increasing' ? 'text-red-400' :
                      incident.riskTrend === 'decreasing' ? 'text-green-400' :
                      'text-blue-400'
                    }`}>
                      {incident.riskTrend || 'stable'}
                    </div>
                    <div className="flex items-center space-x-1">
                      {incident.riskTrend === 'increasing' && (
                        <>
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                          <span className="text-xs text-red-400">Escalating</span>
                        </>
                      )}
                      {incident.riskTrend === 'decreasing' && (
                        <>
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="text-xs text-green-400">Improving</span>
                        </>
                      )}
                      {(incident.riskTrend === 'stable' || !incident.riskTrend) && (
                        <>
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                          <span className="text-xs text-blue-400">Consistent</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="cyber-dark rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">Confidence</span>
                      <Brain className="h-4 w-4 text-purple-400" />
                    </div>
                    <div className="text-2xl font-bold mb-2">{incident.confidence || 82}%</div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-700"
                        style={{ width: `${incident.confidence || 82}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Threat Scenarios */}
                {threatPrediction.threatScenarios && threatPrediction.threatScenarios.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-md font-semibold mb-4 flex items-center space-x-2">
                      <TrendingUp className="h-4 w-4 text-cyan-400" />
                      <span>Threat Scenarios</span>
                    </h4>
                    <div className="space-y-4">
                      {threatPrediction.threatScenarios.map((scenario: any, index: number) => (
                        <div key={index} className="cyber-dark rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-semibold text-cyan-400">{scenario.timeframe}</h5>
                            <div className="flex items-center space-x-2">
                              <Badge className={`${
                                scenario.likelihood === 'High' ? 'bg-red-600' :
                                scenario.likelihood === 'Medium' ? 'bg-yellow-600' :
                                'bg-green-600'
                              } text-white`}>
                                {scenario.likelihood}
                              </Badge>
                              <Badge className={`${
                                scenario.impact === 'Critical' ? 'bg-red-700' :
                                scenario.impact === 'High' ? 'bg-orange-600' :
                                scenario.impact === 'Medium' ? 'bg-yellow-600' :
                                'bg-blue-600'
                              } text-white`}>
                                {scenario.impact} Impact
                              </Badge>
                            </div>
                          </div>
                          
                          {scenario.threats && scenario.threats.length > 0 && (
                            <div className="mb-3">
                              <h6 className="text-sm font-medium text-gray-300 mb-2">Potential Threats:</h6>
                              <ul className="space-y-1">
                                {scenario.threats.map((threat: string, threatIndex: number) => (
                                  <li key={threatIndex} className="text-sm text-gray-400 flex items-center space-x-2">
                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                    <span>{threat}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {scenario.recommendations && scenario.recommendations.length > 0 && (
                            <div>
                              <h6 className="text-sm font-medium text-gray-300 mb-2">Recommendations:</h6>
                              <ul className="space-y-1">
                                {scenario.recommendations.map((rec: string, recIndex: number) => (
                                  <li key={recIndex} className="text-sm text-gray-400 flex items-center space-x-2">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                    <span>{rec}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Environmental Impact */}
                {threatPrediction.environmentalImpact && Object.keys(threatPrediction.environmentalImpact).length > 0 && (
                  <div>
                    <h4 className="text-md font-semibold mb-4 flex items-center space-x-2">
                      <Shield className="h-4 w-4 text-green-400" />
                      <span>Environmental Impact Assessment</span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {Object.entries(threatPrediction.environmentalImpact).map(([key, impact]: [string, any]) => (
                        <div key={key} className="cyber-dark rounded-lg p-4">
                          <h5 className="font-semibold text-gray-200 mb-2 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </h5>
                          <div className="flex items-center space-x-2 mb-2">
                            <div className={`w-3 h-3 rounded-full ${
                              impact.riskLevel === 'High' ? 'bg-red-500' :
                              impact.riskLevel === 'Medium' ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`} />
                            <span className={`text-sm font-medium ${
                              impact.riskLevel === 'High' ? 'text-red-400' :
                              impact.riskLevel === 'Medium' ? 'text-yellow-400' :
                              'text-green-400'
                            }`}>
                              {impact.riskLevel} Risk
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 mb-3">{impact.description}</p>
                          {impact.mitigationPriority && (
                            <Badge className={`${
                              impact.mitigationPriority === 'Critical' ? 'bg-red-600' :
                              impact.mitigationPriority === 'High' ? 'bg-orange-600' :
                              impact.mitigationPriority === 'Medium' ? 'bg-yellow-600' :
                              'bg-blue-600'
                            } text-white`}>
                              {impact.mitigationPriority} Priority
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Cost Analysis */}
                <div className="mb-6">
                  <h4 className="text-md font-semibold mb-4 flex items-center space-x-2">
                    <DollarSign className="h-4 w-4 text-green-400" />
                    <span>Incident Analysis Cost Breakdown</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="cyber-dark rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Analysis Cost</span>
                        <Zap className="h-4 w-4 text-yellow-400" />
                      </div>
                      <div className="text-2xl font-bold text-green-400 mb-2">€2.50</div>
                      <p className="text-xs text-gray-500">Per incident analysis</p>
                    </div>
                    
                    <div className="cyber-dark rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">AI Agents Used</span>
                        <Brain className="h-4 w-4 text-purple-400" />
                      </div>
                      <div className="text-2xl font-bold text-cyan-400 mb-2">8</div>
                      <p className="text-xs text-gray-500">Specialized AI agents</p>
                    </div>
                    
                    <div className="cyber-dark rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Processing Time</span>
                        <Clock className="h-4 w-4 text-blue-400" />
                      </div>
                      <div className="text-2xl font-bold text-orange-400 mb-2">~45s</div>
                      <p className="text-xs text-gray-500">Multi-agent analysis</p>
                    </div>
                  </div>
                  
                  <div className="cyber-dark rounded-lg p-4 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-semibold text-gray-200">Dynamic Analysis Pricing</h5>
                      <div className="flex items-center space-x-1">
                        <Badge className="bg-green-600 text-white text-xs">
                          {(userData as any)?.subscriptionPlan?.toUpperCase() || 'FREE'}
                        </Badge>
                        <button className="text-gray-400 hover:text-white p-1">
                          <HelpCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">8-Agent AI Analysis System</span>
                        <span className="text-green-400">€{(parseFloat(getAnalysisCost()) * 0.30).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">MITRE ATT&CK Framework Mapping</span>
                        <span className="text-green-400">€{(parseFloat(getAnalysisCost()) * 0.15).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">AlienVault OTX Threat Intelligence</span>
                        <span className="text-green-400">€{(parseFloat(getAnalysisCost()) * 0.15).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">IOC Geo-location & Risk Assessment</span>
                        <span className="text-green-400">€{(parseFloat(getAnalysisCost()) * 0.10).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Entity Relationship Mapping</span>
                        <span className="text-green-400">€{(parseFloat(getAnalysisCost()) * 0.10).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Purple Team Analysis</span>
                        <span className="text-green-400">€{(parseFloat(getAnalysisCost()) * 0.10).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Compliance Framework Assessment</span>
                        <span className="text-green-400">€{(parseFloat(getAnalysisCost()) * 0.10).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Threat Prediction Modeling</span>
                        <span className="text-green-400">€0.35</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Business Impact Analysis</span>
                        <span className="text-green-400">€0.20</span>
                      </div>
                      <div className="border-t border-gray-600 pt-2 mt-2">
                        <div className="flex justify-between text-sm font-semibold">
                          <span className="text-gray-300">Total Analysis Cost</span>
                          <span className="text-green-400">€2.50</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prediction Summary */}
                {threatPrediction.predictionSummary && (
                  <div className="cyber-dark rounded-lg p-4 mt-6">
                    <h5 className="font-semibold text-gray-200 mb-2">Executive Summary</h5>
                    <p className="text-sm text-gray-300">{threatPrediction.predictionSummary}</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}