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
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="cyber-slate border-b border-cyber-slate-light p-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 cyber-blue rounded-xl flex items-center justify-center">
            <Search className="text-white text-xl" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-cyber-blue">CyberSight AI Security Incident Analysis</h2>
            <p className="text-gray-400">AI-powered threat detection and MITRE ATT&CK mapping</p>
          </div>
        </div>
      </div>

      <div className="flex h-full">
        {/* Input Form Section */}
        <div className="w-1/2 p-6 border-r border-cyber-slate-light">
          <div className="cyber-slate rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <FileText className="text-cyber-blue" />
                <h3 className="text-lg font-semibold">Incident Input</h3>
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
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300">Incident Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Brief description of the incident"
                            className="cyber-dark border-cyber-slate-light text-white placeholder-gray-500 focus:ring-cyber-blue focus:border-transparent"
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
                        <FormLabel className="text-gray-300">SIEM Severity (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="cyber-dark border-cyber-slate-light text-white focus:ring-cyber-blue focus:border-transparent">
                              <SelectValue placeholder="Select severity" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="cyber-dark border-cyber-slate-light">
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
                      <FormLabel className="text-gray-300">System/Service Context (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the functions of affected systems, services, hosts, or devices (e.g., Domain controller, banking authentication for 500 users...)"
                          className="cyber-dark border-cyber-slate-light text-white placeholder-gray-500 focus:ring-cyber-blue focus:border-transparent resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-gray-500 mt-1">
                        <FileText className="inline w-3 h-3 mr-1" />
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
                      <FormLabel className="text-gray-300">Log Data</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Paste your primary security logs here for analysis..."
                          className="cyber-dark border-cyber-slate-light text-white placeholder-gray-500 focus:ring-cyber-blue focus:border-transparent resize-none font-mono text-sm"
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
                      <FormLabel className="text-gray-300">Additional Logs (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Logs for multi-stage incidents or from other sources..."
                          className="cyber-dark border-cyber-slate-light text-white placeholder-gray-500 focus:ring-cyber-blue focus:border-transparent resize-none font-mono text-sm"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <Button
                    type="submit"
                    disabled={analyzeIncidentMutation.isPending}
                    className="flex-1 cyber-blue hover:bg-blue-600 text-white font-medium"
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
                    variant="secondary"
                    onClick={clearForm}
                    className="cyber-slate-light hover:bg-gray-600 text-white font-medium"
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
        <div className="w-1/2 p-6 flex flex-col">
          {/* Latest Analysis Result */}
          {analysisResult && (
            <div className="cyber-slate rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Shield className="text-cyber-blue" />
                  <h3 className="text-lg font-semibold">Latest Analysis</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIncident(analysisResult.id)}
                  className="text-cyber-blue hover:text-white hover:bg-cyber-blue"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </Button>
              </div>

              <div className="space-y-4">
                {/* Enhanced AI Investigation Progress */}
                <div className="cyber-dark rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Brain className="text-cyber-purple" />
                      <h4 className="font-semibold">AI Investigation</h4>
                    </div>
                    <span className="text-sm font-medium text-white">{analysisResult.aiInvestigation || 85}%</span>
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
          )}

          {/* Recent Incidents */}
          <div className="cyber-slate rounded-xl p-6 flex-1">
            <div className="flex items-center space-x-2 mb-4">
              <Calendar className="text-green-500" />
              <h3 className="text-lg font-semibold">Recent Analysis Results</h3>
            </div>

            {recentIncidents && recentIncidents.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recentIncidents
                  .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                  .slice(0, 5)
                  .map((incident: Incident) => (
                  <div key={incident.id} className="cyber-dark rounded-lg p-4 hover:bg-gray-700 transition-colors">
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
                <div className="w-16 h-16 cyber-dark rounded-full flex items-center justify-center mb-4">
                  <Shield className="text-2xl text-gray-500" />
                </div>
                <h4 className="font-semibold mb-2">No Recent Analysis</h4>
                <p className="text-gray-400 text-sm">Start by analyzing your first incident</p>
              </div>
            )}
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
