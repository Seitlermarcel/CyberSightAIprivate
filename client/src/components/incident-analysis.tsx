import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Shield, FileText, Loader2, RotateCcw, Eye, Calendar, Brain, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import IncidentDetail from "@/components/incident-detail";
import { format } from "date-fns";
import type { Incident } from "@shared/schema";

const formSchema = z.object({
  title: z.string().min(1, "Incident title is required"),
  severity: z.string().optional(),
  systemContext: z.string().optional(),
  logData: z.string().min(1, "Log data is required"),
  additionalLogs: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface IncidentAnalysisProps {
  compactView?: boolean;
  requireComments?: boolean;
}

export default function IncidentAnalysis({ compactView = false, requireComments = false }: IncidentAnalysisProps) {
  const [analysisResult, setAnalysisResult] = useState<Incident | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useQuery<{ id: string; username: string }>({
    queryKey: ["/api/user"],
  });

  const { data: settings } = useQuery({
    queryKey: ["/api/settings", user?.id || "default-user"],
    enabled: !!user?.id,
  });

  const { data: recentIncidents } = useQuery<Incident[]>({
    queryKey: ["/api/incidents"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      severity: "",
      systemContext: "",
      logData: "",
      additionalLogs: "",
    },
  });

  const analyzeIncidentMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("POST", "/api/incidents", {
        ...data,
        status: "open",
      });
      return response.json();
    },
    onSuccess: (incident: Incident) => {
      setAnalysisResult(incident);
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Analysis Complete",
        description: "Incident has been analyzed and saved.",
      });
    },
    onError: () => {
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze incident. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    analyzeIncidentMutation.mutate(data);
  };

  const clearForm = () => {
    form.reset();
    setAnalysisResult(null);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-900"; // Dark Red
      case "high":
        return "bg-red-600"; // Vivid Red
      case "medium":
        return "bg-orange-500"; // Orange
      case "low":
        return "bg-yellow-500"; // Yellow
      default:
        return "bg-gray-500"; // Grey for informational
    }
  };

  const getClassificationColor = (classification: string) => {
    return classification === "true-positive" ? "bg-red-600" : "bg-green-500";
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

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl blur-xl"></div>
        <div className="relative p-4 lg:p-6 bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-700/50">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
              <Search className="text-blue-400 w-5 h-5 lg:w-6 lg:h-6" />
            </div>
            <div>
              <h2 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">🛡️ CyberSight AI Security Command Center</h2>
              <p className="text-gray-300 text-sm lg:text-base">Advanced AI-powered threat hunting with real-time MITRE ATT&CK framework mapping and automated response workflows</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form Section */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl blur-xl"></div>
          <div className="relative bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 lg:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl border border-green-500/30">
                  <FileText className="text-green-400 w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">🔍 Security Event Analysis</h3>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-cyan-400">
                  {(user as any)?.remainingIncidents || 0} analyses left
                </div>
                <div className="text-xs text-gray-400 capitalize">
                  {(user as any)?.currentPackage || 'starter'} plan
                </div>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Incident Title and Severity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 font-medium">Incident Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Brief description of the incident"
                            className="bg-slate-900/50 border-slate-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 rounded-lg"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="severity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 font-medium">SIEM Severity (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 rounded-lg">
                              <SelectValue placeholder="Select severity" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-slate-800 border-slate-600">
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="informational">Informational</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* System/Service Context */}
                <FormField
                  control={form.control}
                  name="systemContext"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300 font-medium">System/Service Context (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the functions of affected systems, services, hosts, or devices (e.g., Domain controller, banking authentication for 500 users...)"
                          className="bg-slate-900/50 border-slate-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none rounded-lg"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-gray-500 mt-1 flex items-center">
                        <FileText className="w-3 h-3 mr-1" />
                        Help the AI understand the business impact by describing what these systems do
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Log Data */}
                <FormField
                  control={form.control}
                  name="logData"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300 font-medium">Log Data</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Paste your primary security logs here for analysis..."
                          className="bg-slate-900/50 border-slate-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none font-mono text-sm rounded-lg"
                          rows={6}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Additional Logs */}
                <FormField
                  control={form.control}
                  name="additionalLogs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300 font-medium">Additional Logs (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Logs for multi-stage incidents or from other sources..."
                          className="bg-slate-900/50 border-slate-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none font-mono text-sm rounded-lg"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    type="submit"
                    disabled={analyzeIncidentMutation.isPending}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-lg transition-all duration-300"
                  >
                    {analyzeIncidentMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Analyze Incident
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearForm}
                    className="border-slate-600 text-gray-300 hover:bg-slate-700 hover:text-white font-medium rounded-lg transition-all duration-300"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>

        {/* Analysis Results & Recent Incidents Section */}
        <div className="space-y-6">
          {/* Latest Analysis Result */}
          {analysisResult && (
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl blur-xl"></div>
              <div className="relative bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 lg:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30">
                      <Shield className="text-purple-400 w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">🛡️ Latest Analysis Result</h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedIncident(analysisResult.id)}
                    className="border-purple-500/30 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 rounded-lg transition-all duration-300"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                </div>

                <div className="space-y-4">
                  {/* Enhanced AI Investigation Progress */}
                  <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Brain className="text-purple-400 w-4 h-4" />
                        <h4 className="font-semibold text-white">AI Investigation</h4>
                      </div>
                      <span className="text-sm font-medium text-purple-400">{analysisResult.aiInvestigation || 85}%</span>
                  </div>
                  
                  {/* Multi-color gradient progress bar inspired by Microsoft Copilot */}
                  <div className="relative w-full h-3 bg-cyber-slate rounded-full overflow-hidden">
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-500 via-pink-500 to-cyan-400 animate-pulse transition-all duration-500"
                      style={{ 
                        width: `${analysisResult.aiInvestigation || 85}%`,
                        background: 'linear-gradient(90deg, #60a5fa 0%, #a855f7 25%, #ec4899 50%, #06b6d4 75%, #10b981 100%)'
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Analyzing</span>
                    <span>Multiple AI Agents</span>
                    <span>Complete</span>
                  </div>
                </div>

                {/* Quick Results Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="cyber-dark rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Classification</span>
                      <Badge className={`${getClassificationColor(analysisResult.classification || "")} text-white text-xs`}>
                        {analysisResult.classification === "true-positive" ? "TRUE+" : "FALSE+"}
                      </Badge>
                    </div>
                  </div>
                  <div className="cyber-dark rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Confidence</span>
                      <span className="text-sm font-medium text-white">{analysisResult.confidence}%</span>
                    </div>
                  </div>
                </div>

                {/* MITRE & IOCs Summary */}
                <div className="cyber-dark rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Techniques</span>
                    <span className="text-xs text-gray-500">{analysisResult.mitreAttack?.length || 0} identified</span>
                  </div>
                  {analysisResult.mitreAttack && analysisResult.mitreAttack.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {analysisResult.mitreAttack.slice(0, 3).map((technique: any, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs text-gray-400 border-gray-600">
                          {typeof technique === 'object' && technique !== null ? (technique.id || technique.name || 'Unknown') : String(technique)}
                        </Badge>
                      ))}
                      {analysisResult.mitreAttack.length > 3 && (
                        <Badge variant="outline" className="text-xs text-gray-400 border-gray-600">
                          +{analysisResult.mitreAttack.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
              </div>
            </div>
          )}

          {/* Recent Incidents */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 rounded-2xl blur-xl"></div>
            <div className="relative bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 lg:p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-orange-500/20 to-yellow-500/20 rounded-xl border border-orange-500/30">
                  <Calendar className="text-orange-400 w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">📊 Recent Analysis Results</h3>
              </div>

              {recentIncidents && recentIncidents.length > 0 ? (
                <div className="space-y-3">
                {recentIncidents
                  .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                  .slice(0, 5)
                  .map((incident: Incident) => (
                  <div key={incident.id} className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/30 hover:border-orange-500/40 hover:bg-slate-800/50 transition-all duration-300">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm text-white truncate flex-1 mr-2">
                        {incident.title}
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedIncident(incident.id)}
                        className="text-gray-400 hover:text-white p-1 h-6 w-6"
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge className={`${getSeverityColor(incident.severity)} text-white text-xs`}>
                          {incident.severity}
                        </Badge>
                        <Badge className={`${getClassificationColor(incident.classification || "")} text-white text-xs`}>
                          {incident.classification === "true-positive" ? "TRUE+" : "FALSE+"}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-400">
                        {incident.createdAt ? format(new Date(incident.createdAt), "MMM d, HH:mm") : ""}
                      </span>
                    </div>

                    {/* AI Investigation Mini-Progress */}
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">AI Investigation</span>
                        <span className="text-xs text-gray-400">{incident.aiInvestigation || 85}%</span>
                      </div>
                      <div className="w-full h-1 bg-cyber-slate rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-400 via-purple-500 to-cyan-400"
                          style={{ 
                            width: `${incident.aiInvestigation || 85}%`,
                            background: 'linear-gradient(90deg, #60a5fa 0%, #a855f7 50%, #06b6d4 100%)'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500/20 to-yellow-500/20 rounded-full flex items-center justify-center mb-4 border border-orange-500/30">
                    <Shield className="text-xl text-orange-400" />
                  </div>
                  <h4 className="font-semibold mb-2 text-white">No Recent Analysis</h4>
                  <p className="text-gray-400 text-sm">Start by analyzing your first incident</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <IncidentDetail
          incidentId={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          requireComments={requireComments}
        />
      )}
    </div>
  );
}
