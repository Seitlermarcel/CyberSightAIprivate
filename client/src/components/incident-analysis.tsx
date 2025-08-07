import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Shield, FileText, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Incident } from "@shared/schema";

const formSchema = z.object({
  title: z.string().min(1, "Incident title is required"),
  severity: z.string().optional(),
  systemContext: z.string().optional(),
  logData: z.string().min(1, "Log data is required"),
  additionalLogs: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function IncidentAnalysis() {
  const [analysisResult, setAnalysisResult] = useState<Incident | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
        return "bg-severity-critical";
      case "high":
        return "bg-severity-high";
      case "medium":
        return "bg-severity-medium";
      case "low":
        return "bg-severity-low";
      default:
        return "bg-severity-info";
    }
  };

  const getClassificationColor = (classification: string) => {
    return classification === "true-positive" ? "bg-severity-high" : "bg-green-500";
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
            <div className="flex items-center space-x-2 mb-6">
              <FileText className="text-cyber-blue" />
              <h3 className="text-lg font-semibold">Incident Input</h3>
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

        {/* Analysis Results Section */}
        <div className="w-1/2 p-6">
          <div className="cyber-slate rounded-xl p-6 h-full">
            {!analysisResult ? (
              <div className="flex flex-col items-center justify-center text-center h-full">
                <div className="w-24 h-24 cyber-dark rounded-full flex items-center justify-center mb-6">
                  <Shield className="text-4xl text-gray-500" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Ready for Analysis</h3>
                <p className="text-gray-400 max-w-sm">Enter incident details and logs to begin AI-powered security analysis</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Shield className="text-cyber-blue" />
                  <h3 className="text-lg font-semibold">Analysis Results</h3>
                </div>

                {/* Classification */}
                <div className="cyber-dark rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Classification</h4>
                    <Badge className={`${getClassificationColor(analysisResult.classification || "")} text-white`}>
                      {analysisResult.classification === "true-positive" ? "True Positive" : "False Positive"}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-400">
                    Confidence: {analysisResult.confidence}%
                  </p>
                </div>

                {/* Severity */}
                {analysisResult.severity && (
                  <div className="cyber-dark rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">Severity</h4>
                      <Badge className={`${getSeverityColor(analysisResult.severity)} text-white capitalize`}>
                        {analysisResult.severity}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* MITRE ATT&CK */}
                {analysisResult.mitreAttack && analysisResult.mitreAttack.length > 0 && (
                  <div className="cyber-dark rounded-lg p-4">
                    <h4 className="font-semibold mb-2">MITRE ATT&CK</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.mitreAttack.map((technique, index) => (
                        <Badge key={index} className="cyber-blue text-white">
                          {technique}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* IOCs */}
                {analysisResult.iocs && analysisResult.iocs.length > 0 && (
                  <div className="cyber-dark rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Indicators of Compromise</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.iocs.map((ioc, index) => (
                        <Badge key={index} variant="outline" className="text-gray-300 border-gray-600">
                          {ioc}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Analysis */}
                {analysisResult.aiAnalysis && (
                  <div className="cyber-dark rounded-lg p-4">
                    <h4 className="font-semibold mb-2">AI Analysis</h4>
                    <p className="text-sm text-gray-300">{analysisResult.aiAnalysis}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
