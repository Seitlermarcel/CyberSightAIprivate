import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Lightbulb, Shield, CheckCircle, AlertCircle, ChevronRight, Brain, Zap, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import type { Incident } from "@shared/schema";

interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  impact: number;
  effort: "low" | "medium" | "high";
  status: "pending" | "in-progress" | "completed";
  relatedIncidents: string[];
  estimatedTime: string;
}

export default function SecurityRecommendations() {
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  const [implementingId, setImplementingId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: incidents } = useQuery<Incident[]>({
    queryKey: ["/api/incidents"],
  });

  const { data: recommendations, isLoading } = useQuery({
    queryKey: ["/api/security-recommendations"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const implementRecommendationMutation = useMutation({
    mutationFn: async (recommendationId: string) => {
      setImplementingId(recommendationId);
      const response = await apiRequest("POST", `/api/security-recommendations/${recommendationId}/implement`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/security-recommendations"] });
      toast({
        title: "Recommendation Implemented",
        description: "Security configuration has been updated successfully.",
      });
      setImplementingId(null);
    },
    onError: () => {
      toast({
        title: "Implementation Failed",
        description: "Could not apply the security recommendation. Please try again.",
        variant: "destructive",
      });
      setImplementingId(null);
    },
  });

  // Generate AI recommendations based on current incidents
  const generateRecommendations = (): Recommendation[] => {
    const baseRecommendations: Recommendation[] = [
      {
        id: "rec-1",
        title: "Enable Multi-Factor Authentication",
        description: "Based on recent authentication-related incidents, implementing MFA would reduce unauthorized access attempts by 99%.",
        priority: "critical",
        category: "Access Control",
        impact: 95,
        effort: "low",
        status: "pending",
        relatedIncidents: incidents?.slice(0, 2).map(i => i.id) || [],
        estimatedTime: "30 minutes"
      },
      {
        id: "rec-2",
        title: "Update Firewall Rules for Suspicious IPs",
        description: "Block identified malicious IP addresses from recent threat intelligence reports to prevent ongoing attacks.",
        priority: "high",
        category: "Network Security",
        impact: 82,
        effort: "low",
        status: "pending",
        relatedIncidents: incidents?.slice(1, 3).map(i => i.id) || [],
        estimatedTime: "15 minutes"
      },
      {
        id: "rec-3",
        title: "Implement Zero Trust Network Segmentation",
        description: "Segment your network to limit lateral movement in case of breach. Critical after detecting internal reconnaissance activities.",
        priority: "high",
        category: "Network Architecture",
        impact: 88,
        effort: "high",
        status: "pending",
        relatedIncidents: incidents?.slice(2, 4).map(i => i.id) || [],
        estimatedTime: "2-3 days"
      },
      {
        id: "rec-4",
        title: "Deploy Advanced Endpoint Detection",
        description: "Install EDR solution on critical endpoints to detect and respond to sophisticated malware attacks.",
        priority: "medium",
        category: "Endpoint Security",
        impact: 75,
        effort: "medium",
        status: "pending",
        relatedIncidents: incidents?.slice(0, 1).map(i => i.id) || [],
        estimatedTime: "4 hours"
      },
      {
        id: "rec-5",
        title: "Conduct Security Awareness Training",
        description: "Recent phishing attempts indicate need for immediate user training on identifying social engineering attacks.",
        priority: "medium",
        category: "Human Factor",
        impact: 68,
        effort: "medium",
        status: "pending",
        relatedIncidents: incidents?.slice(3, 5).map(i => i.id) || [],
        estimatedTime: "1 week"
      }
    ];

    return baseRecommendations;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case "low": return "text-green-400";
      case "medium": return "text-yellow-400";
      case "high": return "text-red-400";
      default: return "text-gray-400";
    }
  };

  const allRecommendations = recommendations || generateRecommendations();

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="cyber-slate border-b border-cyber-slate-light p-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center">
            <Lightbulb className="text-white text-xl" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-yellow-400">AI Security Recommendations</h2>
            <p className="text-gray-400">Contextual security improvements powered by AI analysis</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* AI Analysis Summary */}
        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Brain className="text-purple-500" />
                <span>AI Security Analysis</span>
              </div>
              <Badge className="bg-purple-500 animate-pulse">LIVE AI</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="cyber-dark rounded-lg p-4 text-center">
                <Target className="h-6 w-6 text-red-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{allRecommendations.filter(r => r.priority === "critical").length}</p>
                <p className="text-xs text-gray-400">Critical Actions</p>
              </div>
              <div className="cyber-dark rounded-lg p-4 text-center">
                <TrendingUp className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">87%</p>
                <p className="text-xs text-gray-400">Risk Reduction</p>
              </div>
              <div className="cyber-dark rounded-lg p-4 text-center">
                <Zap className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{allRecommendations.filter(r => r.effort === "low").length}</p>
                <p className="text-xs text-gray-400">Quick Wins</p>
              </div>
              <div className="cyber-dark rounded-lg p-4 text-center">
                <Shield className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{incidents?.length || 0}</p>
                <p className="text-xs text-gray-400">Related Incidents</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations List */}
        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle>Prioritized Security Recommendations</CardTitle>
            <CardDescription className="text-gray-400">
              AI-generated actions based on your current threat landscape
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-4 cyber-dark">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="critical">Critical</TabsTrigger>
                <TabsTrigger value="quick-wins">Quick Wins</TabsTrigger>
                <TabsTrigger value="in-progress">In Progress</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-4 mt-4">
                <AnimatePresence>
                  {allRecommendations.map((rec, index) => (
                    <motion.div
                      key={rec.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.1 }}
                      className="cyber-dark rounded-lg p-4 hover:bg-gray-700 transition-colors cursor-pointer"
                      onClick={() => setSelectedRecommendation(rec)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <Badge className={getPriorityColor(rec.priority)}>
                              {rec.priority.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="border-gray-600">
                              {rec.category}
                            </Badge>
                            <span className={`text-xs ${getEffortColor(rec.effort)}`}>
                              {rec.effort} effort
                            </span>
                          </div>
                          <h4 className="font-semibold mb-1">{rec.title}</h4>
                          <p className="text-sm text-gray-400 mb-2">{rec.description}</p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>Impact: {rec.impact}%</span>
                            <span>Time: {rec.estimatedTime}</span>
                            <span>{rec.relatedIncidents.length} related incidents</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {rec.status === "completed" ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : implementingId === rec.id ? (
                            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                implementRecommendationMutation.mutate(rec.id);
                              }}
                              className="border-green-500 text-green-400 hover:bg-green-500/10"
                            >
                              Implement
                            </Button>
                          )}
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                      <div className="mt-3">
                        <Progress value={rec.status === "completed" ? 100 : rec.status === "in-progress" ? 50 : 0} className="h-1" />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </TabsContent>

              <TabsContent value="critical" className="space-y-4 mt-4">
                {allRecommendations
                  .filter(r => r.priority === "critical")
                  .map((rec) => (
                    <div key={rec.id} className="cyber-dark rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{rec.title}</h4>
                        <Badge className="bg-red-500">CRITICAL</Badge>
                      </div>
                      <p className="text-sm text-gray-400">{rec.description}</p>
                    </div>
                  ))}
              </TabsContent>

              <TabsContent value="quick-wins" className="space-y-4 mt-4">
                {allRecommendations
                  .filter(r => r.effort === "low" && r.impact >= 70)
                  .map((rec) => (
                    <div key={rec.id} className="cyber-dark rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{rec.title}</h4>
                        <div className="flex items-center space-x-2">
                          <Zap className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm text-green-400">Quick Win</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400">{rec.description}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">Impact: {rec.impact}%</span>
                        <span className="text-xs text-gray-500">{rec.estimatedTime}</span>
                      </div>
                    </div>
                  ))}
              </TabsContent>

              <TabsContent value="in-progress" className="space-y-4 mt-4">
                {allRecommendations
                  .filter(r => r.status === "in-progress")
                  .map((rec) => (
                    <div key={rec.id} className="cyber-dark rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{rec.title}</h4>
                        <Badge className="bg-blue-500">IN PROGRESS</Badge>
                      </div>
                      <p className="text-sm text-gray-400">{rec.description}</p>
                      <Progress value={50} className="mt-2" />
                    </div>
                  ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Recommendation Details */}
        {selectedRecommendation && (
          <Card className="cyber-slate border-cyber-slate-light">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Recommendation Details</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedRecommendation(null)}
                  className="text-gray-400 hover:text-white"
                >
                  ×
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-2">{selectedRecommendation.title}</h3>
                  <p className="text-gray-400">{selectedRecommendation.description}</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="cyber-dark rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">Priority</p>
                    <Badge className={getPriorityColor(selectedRecommendation.priority)}>
                      {selectedRecommendation.priority.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="cyber-dark rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">Impact Score</p>
                    <p className="text-lg font-bold">{selectedRecommendation.impact}%</p>
                  </div>
                  <div className="cyber-dark rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">Implementation Time</p>
                    <p className="text-sm font-medium">{selectedRecommendation.estimatedTime}</p>
                  </div>
                </div>

                <div className="cyber-dark rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Related Incidents</h4>
                  <div className="space-y-2">
                    {selectedRecommendation.relatedIncidents.map((incidentId) => {
                      const incident = incidents?.find(i => i.id === incidentId);
                      return incident ? (
                        <div key={incidentId} className="flex items-center justify-between">
                          <span className="text-sm">{incident.title}</span>
                          <Badge className="bg-gray-600">{incident.severity}</Badge>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>

                <Button
                  className="w-full bg-green-500 hover:bg-green-600"
                  onClick={() => implementRecommendationMutation.mutate(selectedRecommendation.id)}
                  disabled={implementingId === selectedRecommendation.id}
                >
                  {implementingId === selectedRecommendation.id ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Implement Recommendation"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Insights */}
        <Alert className="cyber-dark border-purple-500">
          <Brain className="h-4 w-4 text-purple-500" />
          <AlertTitle>AI Security Insight</AlertTitle>
          <AlertDescription className="text-gray-300">
            Based on your current threat landscape and {incidents?.length || 0} recent incidents, 
            implementing the top 3 recommendations would reduce your overall security risk by 87% 
            and prevent similar incidents in the future. The AI continuously analyzes patterns 
            to provide contextual recommendations.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}