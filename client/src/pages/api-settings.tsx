import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Copy,
  CheckCircle,
  AlertCircle,
  Webhook,
  Server,
  Database,
  Cloud,
  Key,
  Zap,
  Shield,
  Settings,
  ArrowRight,
  ExternalLink,
  TestTube,
  PlayCircle,
  Info
} from "lucide-react";

const SIEM_TEMPLATES = [
  {
    id: "microsoft-sentinel",
    name: "Microsoft Sentinel",
    icon: Cloud,
    color: "text-blue-500",
    description: "Azure cloud-native SIEM and SOAR platform",
    webhook: "/api/webhook/sentinel",
    requiresLogicApp: true,
    steps: [
      "1. Create an Azure Logic App in your resource group",
      "2. Add 'HTTP Request' trigger with POST method",
      "3. Configure the HTTP action to call CyberSight webhook",
      "4. Add 'HTTP Response' action to receive analysis results",
      "5. Connect Logic App to Sentinel Automation Rules",
      "6. Test the entire flow with a sample incident"
    ]
  },
  {
    id: "splunk",
    name: "Splunk Enterprise Security",
    icon: Server,
    color: "text-green-500",
    description: "Premium security information and event management platform",
    webhook: "/api/webhook/splunk",
    requiresHttpEventCollector: true,
    steps: [
      "1. Enable HTTP Event Collector in Splunk Settings",
      "2. Create a new token for CyberSight integration",
      "3. Configure webhook to forward events to CyberSight",
      "4. Set up alert actions in Enterprise Security",
      "5. Configure index for storing analysis results",
      "6. Test the integration with sample security events"
    ]
  },
  {
    id: "elastic",
    name: "Elasticsearch/Elastic Security",
    icon: Database,
    color: "text-yellow-500",
    description: "Open source search and analytics engine",
    webhook: "/api/webhook/elastic",
    requiresIndex: true,
    steps: [
      "1. Create a webhook connector in Kibana Stack Management",
      "2. Configure the connector with CyberSight webhook URL",
      "3. Set up authentication headers with your API key",
      "4. Create detection rules that use the webhook connector",
      "5. Configure index for storing analysis results",
      "6. Test the rule with sample security events"
    ]
  },
  {
    id: "crowdstrike",
    name: "CrowdStrike Falcon",
    icon: Shield,
    color: "text-red-500",
    description: "Endpoint protection and threat intelligence platform",
    webhook: "/api/webhook/crowdstrike",
    requiresApiIntegration: true,
    steps: [
      "1. Create API client in CrowdStrike Falcon console",
      "2. Configure Event Stream Management for real-time events",
      "3. Set up a middleware service to receive CrowdStrike events",
      "4. Configure the middleware to forward to CyberSight",
      "5. Use CrowdStrike API to update incidents with analysis",
      "6. Test the integration with sample detection events"
    ]
  },
  {
    id: "generic",
    name: "Generic SIEM/SOC Tool",
    icon: Webhook,
    color: "text-gray-500",
    description: "Universal webhook integration for any SIEM platform",
    webhook: "/api/webhook/generic",
    requiresCustomConfig: true,
    steps: [
      "1. Identify your SIEM's webhook or API capabilities",
      "2. Configure your SIEM to send events to CyberSight webhook",
      "3. Set up authentication using your CyberSight API key",
      "4. Map your event fields to CyberSight's expected format",
      "5. Configure callback URL for receiving analysis results",
      "6. Test the integration with sample security events"
    ]
  }
];

export default function ApiSettings() {
  const { toast } = useToast();
  const [showIntegrationGuide, setShowIntegrationGuide] = useState(false);
  const [selectedSiem, setSelectedSiem] = useState<any>(null);
  const [isTestingWebhook, setIsTestingWebhook] = useState<string | null>(null);

  // Get user information
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // Get existing API configurations
  const { data: apiConfigs } = useQuery({
    queryKey: ["/api/api-configurations"],
  });

  const testWebhookMutation = useMutation({
    mutationFn: async (webhook: string) => {
      const userId = (user as any)?.id || 'USER_ID';
      return await apiRequest("POST", webhook.replace("/api", "") + "/test", {
        apiKey: `cybersight_${userId}_TOKEN`,
        testData: { message: "CyberSight AI integration test" }
      });
    },
    onSuccess: () => {
      toast({
        title: "Test Successful",
        description: "Webhook endpoint is working correctly.",
      });
    },
    onError: (error) => {
      toast({
        title: "Test Failed",
        description: "Unable to reach the webhook endpoint.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsTestingWebhook(null);
    },
  });

  const handleTestWebhook = (webhook: string) => {
    setIsTestingWebhook(webhook);
    testWebhookMutation.mutate(webhook);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 lg:p-6 xl:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl blur-xl"></div>
          <div className="relative p-4 lg:p-6 bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-700/50">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                  <Webhook className="text-blue-400 w-5 h-5 lg:w-6 lg:h-6" />
                </div>
                <div>
                  <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">SIEM Integration Hub</h1>
                  <p className="text-gray-300 text-sm lg:text-base mt-1">
                    Connect your security tools to CyberSight AI for automated incident analysis and real-time threat response
                  </p>
                </div>
              </div>
              <Dialog open={showIntegrationGuide} onOpenChange={setShowIntegrationGuide}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium px-6 py-2 rounded-lg transition-all duration-300">
                    <Settings className="w-4 h-4 mr-2" />
                    Quick Setup Guide
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-slate-800/95 backdrop-blur-sm border border-slate-700/50">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">SIEM Integration Guide</DialogTitle>
                    <DialogDescription className="text-gray-300">
                      Choose your SIEM platform and follow the step-by-step integration guide
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    {SIEM_TEMPLATES.map((siem) => {
                      const Icon = siem.icon;
                      return (
                        <Card 
                          key={siem.id}
                          className={`cursor-pointer transition-all hover:border-blue-500/40 ${
                            selectedSiem?.id === siem.id ? 'border-blue-500/60 bg-blue-500/10' : 'bg-slate-900/50 border-slate-700/50'
                          }`}
                          onClick={() => setSelectedSiem(siem)}
                        >
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center space-x-3">
                              <Icon className={`w-5 h-5 ${siem.color}`} />
                              <span className="text-lg text-white">{siem.name}</span>
                            </CardTitle>
                            <CardDescription className="text-gray-300">{siem.description}</CardDescription>
                          </CardHeader>
                        </Card>
                      );
                    })}
                  </div>

                  {selectedSiem && (
                    <Card className="mt-6 bg-slate-900/50 border-blue-500/40">
                      <CardHeader>
                        <CardTitle className="text-white">Integration Steps for {selectedSiem.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {selectedSiem.steps.map((step: string, index: number) => (
                            <div key={index} className="flex items-start space-x-3">
                              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                                {index + 1}
                              </div>
                              <p className="text-gray-300">{step}</p>
                            </div>
                          ))}
                        </div>
                        
                        <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">Webhook URL</h4>
                          <div className="flex items-center space-x-2">
                            <code className="flex-1 p-2 bg-slate-700/50 rounded text-green-400 text-sm">
                              {window.location.origin}{selectedSiem.webhook}
                            </code>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(window.location.origin + selectedSiem.webhook);
                                toast({ title: "Copied!", description: "Webhook URL copied to clipboard" });
                              }}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Current API Configurations */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl blur-xl"></div>
          <div className="relative bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 lg:p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl border border-green-500/30">
                <Database className="text-green-400 w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">Active API Configurations</h2>
                <p className="text-gray-300 text-sm">Manage your log streaming endpoints and webhook integrations</p>
              </div>
            </div>

            {apiConfigs && apiConfigs.length > 0 ? (
              <div className="space-y-4">
                {apiConfigs.map((config: any) => (
                  <div
                    key={config.id}
                    className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/30 hover:border-green-500/40 hover:bg-slate-800/50 transition-all duration-300"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full bg-green-400"></div>
                        <div>
                          <h3 className="font-semibold text-white">{config.name}</h3>
                          <p className="text-sm text-gray-400">{config.endpointType} • {config.endpointUrl}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={config.isActive ? "bg-green-600 text-white" : "bg-gray-600 text-white"}>
                          {config.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isTestingWebhook === config.endpointUrl}
                          onClick={() => handleTestWebhook(config.endpointUrl)}
                          className="border-slate-600 text-gray-300 hover:bg-slate-700"
                        >
                          {isTestingWebhook === config.endpointUrl ? (
                            <div className="animate-spin">
                              <TestTube className="w-4 h-4" />
                            </div>
                          ) : (
                            <TestTube className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Database className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No API configurations found</p>
                <p className="text-gray-500 text-sm">Create your first integration below</p>
              </div>
            )}
          </div>
        </div>

        {/* SIEM Platform Cards */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl blur-xl"></div>
          <div className="relative bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 lg:p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30">
                <Shield className="text-purple-400 w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Supported SIEM Platforms</h2>
                <p className="text-gray-300 text-sm">Quick setup guides for popular security platforms</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SIEM_TEMPLATES.map((siem) => {
                const Icon = siem.icon;
                return (
                  <div
                    key={siem.id}
                    className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/30 hover:border-purple-500/40 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedSiem(siem);
                      setShowIntegrationGuide(true);
                    }}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <Icon className={`w-6 h-6 ${siem.color}`} />
                      <h3 className="font-semibold text-white">{siem.name}</h3>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">{siem.description}</p>
                    <Button size="sm" variant="outline" className="w-full border-slate-600 text-gray-300 hover:bg-slate-700">
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Setup Guide
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Integration Status */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 rounded-2xl blur-xl"></div>
          <div className="relative bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 lg:p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-gradient-to-br from-orange-500/20 to-yellow-500/20 rounded-xl border border-orange-500/30">
                <Info className="text-orange-400 w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">Integration Status</h2>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-sm text-gray-300">Webhooks Ready</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-sm text-gray-300">AI Analysis Active</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-sm text-gray-300">Callbacks Enabled</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}