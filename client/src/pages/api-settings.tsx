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
    steps: [
      "1. Go to your Sentinel workspace",
      "2. Navigate to Automation > Automation rules",
      "3. Create a new rule with HTTP webhook action",
      "4. Use the webhook URL provided below",
      "5. Include your API key in the request body"
    ],
    samplePayload: {
      "WorkspaceId": "your-workspace-id",
      "AlertType": "SecurityAlert",
      "alertContext": "Suspicious activity detected",
      "entities": ["entity1", "entity2"],
      "apiKey": "cybersight_USER_ID_TOKEN"
    }
  },
  {
    id: "splunk",
    name: "Splunk",
    icon: Database,
    color: "text-green-500",
    description: "Enterprise security information and event management",
    webhook: "/api/webhook/splunk",
    steps: [
      "1. In Splunk Web, go to Settings > Alert actions",
      "2. Create a new webhook alert action",
      "3. Set the URL to the webhook endpoint below",
      "4. Configure the payload to include your API key",
      "5. Save and test the alert action"
    ],
    samplePayload: {
      "search_name": "Security Alert",
      "result": { "field1": "value1", "field2": "value2" },
      "apiKey": "cybersight_USER_ID_TOKEN"
    }
  },
  {
    id: "elastic",
    name: "Elasticsearch/Elastic Security",
    icon: Database,
    color: "text-yellow-500",
    description: "Open source search and analytics engine",
    webhook: "/api/webhook/elastic",
    steps: [
      "1. Open Kibana and go to Stack Management",
      "2. Navigate to Rules and Connectors > Connectors",
      "3. Create a new Webhook connector",
      "4. Set the URL to the webhook endpoint below",
      "5. Configure headers to include your API key"
    ],
    samplePayload: {
      "alert": { "id": "alert-id", "name": "Security Alert" },
      "rule": { "name": "Detection Rule", "id": "rule-id" },
      "apiKey": "cybersight_USER_ID_TOKEN"
    }
  },
  {
    id: "crowdstrike",
    name: "CrowdStrike Falcon",
    icon: Shield,
    color: "text-red-500",
    description: "Endpoint protection and threat intelligence platform",
    webhook: "/api/webhook/crowdstrike",
    steps: [
      "1. Log into CrowdStrike Falcon console",
      "2. Go to Configuration > API Clients & Keys",
      "3. Create a new API client with appropriate scopes",
      "4. Configure a webhook URL in Event streams",
      "5. Use the webhook endpoint provided below"
    ],
    samplePayload: {
      "event": { "type": "SecurityEvent", "data": "event-data" },
      "metadata": { "customer": "customer-id", "timestamp": "2025-01-20T10:00:00Z" },
      "apiKey": "cybersight_USER_ID_TOKEN"
    }
  },
  {
    id: "generic",
    name: "Generic SIEM/SOC Tool",
    icon: Server,
    color: "text-purple-500",
    description: "Works with any SIEM tool that supports HTTP webhooks",
    webhook: "/api/webhook/ingest",
    steps: [
      "1. Find the webhook/HTTP notification settings in your SIEM",
      "2. Add a new webhook endpoint",
      "3. Use the generic webhook URL below",
      "4. Include your API key in the request body",
      "5. Test the connection to verify it's working"
    ],
    samplePayload: {
      "logs": ["security log 1", "security log 2"],
      "metadata": { "source": "SIEM-Tool", "severity": "high" },
      "callbackUrl": "https://your-siem.com/api/callback",
      "apiKey": "cybersight_USER_ID_TOKEN"
    }
  }
];

export default function ApiSettings() {
  const { toast } = useToast();
  const [selectedSiem, setSelectedSiem] = useState<any>(null);
  const [showIntegrationGuide, setShowIntegrationGuide] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState<string | null>(null);

  // Fetch user data for API keys
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "The text has been copied successfully.",
    });
  };

  const testWebhookMutation = useMutation({
    mutationFn: async (webhook: string) => {
      return await apiRequest("POST", webhook.replace("/api", "") + "/test", {
        apiKey: `cybersight_${user?.id}_TOKEN`,
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold cyber-gradient">SIEM Integration Hub</h1>
          <p className="text-gray-400 mt-2">
            Connect your security tools to CyberSight AI for automated incident analysis
          </p>
        </div>
        <Dialog open={showIntegrationGuide} onOpenChange={setShowIntegrationGuide}>
          <DialogTrigger asChild>
            <Button className="cyber-blue hover:bg-blue-600">
              <Zap className="w-4 h-4 mr-2" />
              Quick Setup Guide
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl cyber-gradient">SIEM Integration Guide</DialogTitle>
              <DialogDescription>
                Choose your SIEM platform and follow the step-by-step integration guide
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {SIEM_TEMPLATES.map((siem) => {
                const Icon = siem.icon;
                return (
                  <Card 
                    key={siem.id}
                    className={`cursor-pointer transition-all hover:border-cyber-blue ${
                      selectedSiem?.id === siem.id ? 'border-cyber-blue bg-cyber-blue/10' : 'cyber-slate border-cyber-slate-light'
                    }`}
                    onClick={() => setSelectedSiem(siem)}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center space-x-3">
                        <Icon className={`w-5 h-5 ${siem.color}`} />
                        <span className="text-lg">{siem.name}</span>
                      </CardTitle>
                      <CardDescription>{siem.description}</CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>

            {selectedSiem && (
              <Card className="mt-6 cyber-slate border-cyber-blue">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-3 text-cyber-blue">
                    <selectedSiem.icon className="w-5 h-5" />
                    <span>{selectedSiem.name} Integration</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Integration Steps */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <Settings className="w-5 h-5 mr-2 text-cyber-blue" />
                      Setup Instructions
                    </h3>
                    <div className="space-y-2">
                      {selectedSiem.steps.map((step: string, index: number) => (
                        <div key={index} className="flex items-start space-x-3">
                          <div className="w-6 h-6 rounded-full bg-cyber-blue text-xs flex items-center justify-center text-white font-medium">
                            {index + 1}
                          </div>
                          <p className="text-gray-300 flex-1">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Webhook URL */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <Webhook className="w-5 h-5 mr-2 text-cyber-blue" />
                      Webhook Endpoint
                    </h3>
                    <div className="flex items-center space-x-2">
                      <Input
                        value={`${window.location.origin}${selectedSiem.webhook}`}
                        readOnly
                        className="font-mono text-sm cyber-slate"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(`${window.location.origin}${selectedSiem.webhook}`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestWebhook(selectedSiem.webhook)}
                        disabled={isTestingWebhook === selectedSiem.webhook}
                      >
                        <TestTube className="w-4 h-4 mr-1" />
                        {isTestingWebhook === selectedSiem.webhook ? "Testing..." : "Test"}
                      </Button>
                    </div>
                  </div>

                  {/* API Key */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <Key className="w-5 h-5 mr-2 text-cyber-blue" />
                      API Key (Include in Request Body)
                    </h3>
                    <div className="flex items-center space-x-2">
                      <Input
                        value={`cybersight_${user?.id || 'USER_ID'}_TOKEN`}
                        readOnly
                        className="font-mono text-sm cyber-slate"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(`cybersight_${user?.id || 'USER_ID'}_TOKEN`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Replace USER_ID with your actual user ID: {user?.id}
                    </p>
                  </div>

                  {/* Sample Payload */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <Database className="w-5 h-5 mr-2 text-cyber-blue" />
                      Sample Request Payload
                    </h3>
                    <div className="relative">
                      <pre className="cyber-dark p-4 rounded-lg text-sm overflow-x-auto">
                        <code className="text-green-400">
                          {JSON.stringify(selectedSiem.samplePayload, null, 2)}
                        </code>
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(JSON.stringify(selectedSiem.samplePayload, null, 2))}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="bg-cyber-blue/10 p-4 rounded-lg">
                    <h4 className="font-semibold text-cyber-blue mb-2 flex items-center">
                      <Zap className="w-4 h-4 mr-2" />
                      What Happens Next?
                    </h4>
                    <ul className="space-y-1 text-sm text-gray-300">
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Logs automatically analyzed by 12 AI agents</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Incidents classified and confidence scored</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>MITRE ATT&CK mapping and IOC enrichment</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Results sent back to your SIEM (if callback URL provided)</span>
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generic Webhook */}
        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Webhook className="text-cyber-blue" />
              <span>Universal Webhook</span>
            </CardTitle>
            <CardDescription>
              Works with any SIEM that supports HTTP webhooks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Input
                  value={`${window.location.origin}/api/webhook/ingest`}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(`${window.location.origin}/api/webhook/ingest`)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-3 cyber-dark rounded-lg text-xs">
                <p className="text-gray-400 mb-1">Include in request body:</p>
                <code className="text-cyber-blue">{"{ \"apiKey\": \"cybersight_" + (user?.id || 'USER_ID') + "_TOKEN\" }"}</code>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Endpoint */}
        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="text-green-500" />
              <span>Personal Endpoint</span>
            </CardTitle>
            <CardDescription>
              Your unique webhook URL (no API key required)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Input
                  value={`${window.location.origin}/api/webhook/ingest/${user?.id || 'USER_ID'}/TOKEN`}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(`${window.location.origin}/api/webhook/ingest/${user?.id || 'USER_ID'}/TOKEN`)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-3 cyber-dark rounded-lg text-xs">
                <p className="text-gray-400 mb-1">Replace TOKEN with your secure token</p>
                <p className="text-green-400">✓ No API key needed in request body</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bidirectional Flow */}
        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ArrowRight className="text-purple-500" />
              <span>Bidirectional Flow</span>
            </CardTitle>
            <CardDescription>
              Get AI analysis results back in your SIEM
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Your SIEM</span>
                <ArrowRight className="w-4 h-4 text-cyber-blue" />
                <span className="text-sm text-cyber-blue">CyberSight AI</span>
                <ArrowRight className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-400">Results Back</span>
              </div>
              <div className="p-3 cyber-dark rounded-lg text-xs">
                <p className="text-gray-400 mb-1">Include in request:</p>
                <code className="text-purple-400">{"\"callbackUrl\": \"https://your-siem.com/api/callback\""}</code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Popular SIEM Integrations */}
      <Card className="cyber-slate border-cyber-slate-light">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-xl">
            <Shield className="text-cyber-blue" />
            <span>Popular SIEM Integrations</span>
          </CardTitle>
          <CardDescription>
            Quick setup guides for the most popular security platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SIEM_TEMPLATES.slice(0, -1).map((siem) => {
              const Icon = siem.icon;
              return (
                <div
                  key={siem.id}
                  className="p-4 rounded-lg cyber-dark border border-cyber-slate-light hover:border-cyber-blue transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedSiem(siem);
                    setShowIntegrationGuide(true);
                  }}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <Icon className={`w-6 h-6 ${siem.color}`} />
                    <h3 className="font-semibold">{siem.name}</h3>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">{siem.description}</p>
                  <Button size="sm" variant="outline" className="w-full">
                    <PlayCircle className="w-4 h-4 mr-2" />
                    Setup Guide
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Integration Status */}
      <Card className="cyber-slate border-cyber-slate-light">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Info className="text-yellow-500" />
            <span>Integration Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm">Webhooks Ready</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm">AI Analysis Active</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm">Callbacks Enabled</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}