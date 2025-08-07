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
  Info
} from "lucide-react";
import { generateIncidentPDF } from "@/utils/pdf-export";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Incident } from "@shared/schema";

interface IncidentDetailProps {
  incidentId: string;
  onClose: () => void;
}

export default function IncidentDetail({ incidentId, onClose }: IncidentDetailProps) {
  const [activeTab, setActiveTab] = useState("workflow");
  const [comment, setComment] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [currentIncidentId, setCurrentIncidentId] = useState(incidentId);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: incident, isLoading } = useQuery({
    queryKey: ["/api/incidents", currentIncidentId],
  });

  // Function to navigate to similar incident
  const navigateToIncident = (newIncidentId: string) => {
    setCurrentIncidentId(newIncidentId);
    setActiveTab("workflow"); // Reset to overview tab
    toast({
      title: "Navigated to Similar Incident",
      description: `Switched to incident analysis view`,
    });
  };

  const { data: user } = useQuery({
    queryKey: ["/api/user"],
  });

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
    const analystName = user?.username || 'Security Analyst';
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
    generateIncidentPDF(incident, user);
    toast({
      title: "PDF Export",
      description: "Incident report has been prepared for printing/download.",
    });
  };

  const updateStatus = (status: string) => {
    const timestamp = format(new Date(), "MMM d, yyyy 'at' h:mm a");
    const analystName = user?.username || 'Security Analyst';
    const statusComment = `[${timestamp}] ${analystName}: Status updated to ${status.toUpperCase()}`;
    
    const updatedComments = [...(incident?.comments || []), statusComment];
    updateIncidentMutation.mutate({ 
      status,
      comments: updatedComments,
      updatedAt: new Date()
    });
  };

  const updateSeverity = (severity: string) => {
    const timestamp = format(new Date(), "MMM d, yyyy 'at' h:mm a");
    const analystName = user?.username || 'Security Analyst';
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
    const analystName = user?.username || 'Security Analyst';
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

  // Parse JSON fields
  const mitreDetails = incident.mitreDetails ? JSON.parse(incident.mitreDetails) : { tactics: [], techniques: [] };
  const iocDetails = incident.iocDetails ? JSON.parse(incident.iocDetails) : [];
  const patternAnalysis = incident.patternAnalysis ? JSON.parse(incident.patternAnalysis) : [];
  const purpleTeam = incident.purpleTeam ? JSON.parse(incident.purpleTeam) : { redTeam: [], blueTeam: [] };
  const entityMapping = incident.entityMapping ? JSON.parse(incident.entityMapping) : { entities: [], relationships: [], networkTopology: [] };
  const codeAnalysis = incident.codeAnalysis ? JSON.parse(incident.codeAnalysis) : { summary: "", language: "", findings: [], sandboxOutput: "" };
  const attackVectors = incident.attackVectors ? JSON.parse(incident.attackVectors) : [];
  const complianceImpact = incident.complianceImpact ? JSON.parse(incident.complianceImpact) : [];
  const similarIncidents = incident.similarIncidents ? JSON.parse(incident.similarIncidents) : [];

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
            <Badge className={`${getClassificationColor(incident.classification || "")} text-white`}>
              {incident.classification === "true-positive" ? "TRUE POSITIVE" : "FALSE POSITIVE"}
            </Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={exportToPDF}
              className="text-gray-400 hover:text-white hover:bg-cyber-blue"
            >
              <Printer className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
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
            <Badge className={`${getClassificationColor(incident.classification || "")} text-white ml-auto`}>
              {incident.classification === "true-positive" ? "TRUE POSITIVE" : "FALSE POSITIVE"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-400">Confidence Score</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-gray-500 hover:text-gray-300 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="space-y-2">
                          <p className="font-medium">Confidence Score:</p>
                          <div className="text-xs space-y-1">
                            <div>• 90–100%: Very High – Strong evidence</div>
                            <div>• 70–89%: High – Minor uncertainties</div>
                            <div>• 50–69%: Medium – Needs human review</div>
                            <div>• &lt;50%: Low – Manual validation required</div>
                          </div>
                          <p className="text-xs text-gray-400 pt-1">
                            AI's certainty level based on log analysis patterns and evidence strength.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-gray-500 hover:text-gray-300 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="space-y-2">
                          <p className="font-medium">AI Investigation Metrics:</p>
                          <div className="text-xs space-y-1">
                            <div>• 90–100%: Complete – All logs processed</div>
                            <div>• 70–89%: Comprehensive – Minor gaps</div>
                            <div>• 50–69%: Partial – Some unclear data</div>
                            <div>• &lt;50%: Limited – Insufficient clarity</div>
                          </div>
                          <p className="text-xs text-gray-400 pt-1">
                            Thoroughness of AI analysis across all 8 specialized agents and data sources.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
            <TabsList className="grid w-full grid-cols-10 bg-transparent">
              <TabsTrigger value="workflow" className="text-xs">Workflow</TabsTrigger>
              <TabsTrigger value="mitre" className="text-xs">MITRE</TabsTrigger>
              <TabsTrigger value="iocs" className="text-xs">IOCs</TabsTrigger>
              <TabsTrigger value="patterns" className="text-xs">Patterns</TabsTrigger>
              <TabsTrigger value="purple-team" className="text-xs">Purple Team</TabsTrigger>
              <TabsTrigger value="entities" className="text-xs">Entities</TabsTrigger>
              <TabsTrigger value="code" className="text-xs">Code</TabsTrigger>
              <TabsTrigger value="vectors" className="text-xs">Vectors</TabsTrigger>
              <TabsTrigger value="compliance" className="text-xs">Compliance</TabsTrigger>
              <TabsTrigger value="similar" className="text-xs">Similar</TabsTrigger>
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

            {/* MITRE ATT&CK Tab */}
            <TabsContent value="mitre" className="p-6 space-y-6">
              <div className="cyber-slate rounded-xl p-6">
                <div className="flex items-center space-x-2 mb-6">
                  <Shield className="text-cyber-purple" />
                  <h3 className="text-lg font-semibold">MITRE ATT&CK Tactics</h3>
                </div>

                {mitreDetails.tactics && mitreDetails.tactics.length > 0 ? (
                  <div className="space-y-4">
                    {mitreDetails.tactics.map((tactic: any, index: number) => (
                      <div key={index} className="cyber-dark rounded-lg p-4">
                        <div className="flex items-center space-x-3 mb-2">
                          <Badge className="cyber-purple text-white">{tactic.id}</Badge>
                          <h4 className="font-semibold">{tactic.name}</h4>
                        </div>
                        <p className="text-sm text-gray-300">{tactic.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">No MITRE ATT&CK tactics identified for this incident</p>
                )}
              </div>

              <div className="cyber-slate rounded-xl p-6">
                <div className="flex items-center space-x-2 mb-6">
                  <TrendingUp className="text-cyber-cyan" />
                  <h3 className="text-lg font-semibold">MITRE ATT&CK Techniques (TTPs)</h3>
                </div>

                {mitreDetails.techniques && mitreDetails.techniques.length > 0 ? (
                  <div className="space-y-4">
                    {mitreDetails.techniques.map((technique: any, index: number) => (
                      <div key={index} className="cyber-dark rounded-lg p-4">
                        <div className="flex items-center space-x-3 mb-2">
                          <Badge className="cyber-cyan text-white">{technique.id}</Badge>
                          <h4 className="font-semibold">{technique.name}</h4>
                        </div>
                        <p className="text-sm text-gray-300">{technique.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">No MITRE ATT&CK techniques identified for this incident</p>
                )}
              </div>
            </TabsContent>

            {/* IOCs Tab */}
            <TabsContent value="iocs" className="p-6 space-y-6">
              <div className="cyber-slate rounded-xl p-6">
                <div className="flex items-center space-x-2 mb-6">
                  <MapPin className="text-severity-medium" />
                  <h3 className="text-lg font-semibold">Indicators of Compromise (IOCs)</h3>
                </div>

                {iocDetails && iocDetails.length > 0 ? (
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
                  <h4 className="font-medium mb-3">Entities Identified</h4>
                  {entityMapping.entities && entityMapping.entities.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {entityMapping.entities.map((entity: any, index: number) => (
                        <div key={index} className={`cyber-dark rounded-lg p-3 border-l-4 ${
                          entity.category === 'process' ? 'border-orange-500' : 
                          entity.category === 'user' ? 'border-blue-500' :
                          entity.category === 'host' ? 'border-green-500' : 'border-red-500'
                        }`}>
                          <div className="flex items-center space-x-2 mb-1">
                            <Badge className={`text-white text-xs ${
                              entity.category === 'process' ? 'bg-orange-600' : 
                              entity.category === 'user' ? 'bg-blue-600' :
                              entity.category === 'host' ? 'bg-green-600' : 'bg-red-600'
                            }`}>
                              {entity.type}
                            </Badge>
                            <span className="text-xs text-gray-400 uppercase">{entity.category}</span>
                          </div>
                          <p className="font-mono text-sm">{entity.id}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400">No entities identified</p>
                  )}
                </div>

                <div className="mb-6">
                  <h4 className="font-medium mb-3">Entity Relationships</h4>
                  {entityMapping.relationships && entityMapping.relationships.length > 0 ? (
                    <div className="space-y-2">
                      {entityMapping.relationships.map((rel: any, index: number) => (
                        <div key={index} className="cyber-dark rounded-lg p-3 flex items-center space-x-3">
                          <span className="font-mono text-sm text-orange-400">{rel.source}</span>
                          <Badge className="cyber-slate-light text-white text-xs">{rel.action}</Badge>
                          <span className="font-mono text-sm text-red-400">{rel.target}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400">No relationships identified</p>
                  )}
                </div>

                <div>
                  <h4 className="font-medium mb-3">Network Topology</h4>
                  {entityMapping.networkTopology && entityMapping.networkTopology.length > 0 ? (
                    <div className="grid grid-cols-6 gap-3">
                      {entityMapping.networkTopology.map((node: any, index: number) => (
                        <div key={index} className="cyber-dark rounded-lg p-3 text-center relative">
                          <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-xs font-bold ${
                            node.risk === 3 ? 'bg-red-600' :
                            node.risk === 2 ? 'bg-orange-600' : 'bg-green-600'
                          }`}>
                            {node.risk}
                          </div>
                          <p className="text-xs font-mono text-gray-300">{node.entity}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400">No network topology data</p>
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
                      <div className="cyber-slate rounded p-3 font-mono text-sm text-green-400">
                        The outputs of the DLLs suggest normal behavior when run in isolation. However, observed behavior during integration with explorer.exe must be monitored.
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
                        className="cyber-dark rounded-lg p-4 hover:bg-gray-700 transition-colors cursor-pointer border border-gray-700 hover:border-cyan-500"
                        onClick={() => navigateToIncident(similar.id)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Link2 className="text-green-500 w-4 h-4" />
                            <h4 className="font-medium hover:text-cyan-400 transition-colors">{similar.title}</h4>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className="bg-green-600 text-white">{similar.match}</Badge>
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
          </Tabs>
        </div>
      </div>
    </div>
  );
}