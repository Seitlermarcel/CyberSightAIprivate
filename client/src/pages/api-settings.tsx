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
    ],
    callbackSteps: [
      "1. In your Logic App, add an HTTP trigger for callbacks",
      "2. Set the callback URL in your webhook request to CyberSight",
      "3. Process the analysis results in your Logic App",
      "4. Update the incident in Sentinel with AI analysis results",
      "5. Optionally create work items or send notifications"
    ],
    samplePayload: {
      "WorkspaceId": "your-workspace-id",
      "AlertType": "SecurityAlert",
      "alertContext": "Suspicious activity detected",
      "entities": ["entity1", "entity2"],
      "callbackUrl": "https://your-logic-app.azurewebsites.net/api/callback",
      "apiKey": "cybersight_USER_ID_TOKEN"
    },
    logicAppSchema: {
      "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
      "contentVersion": "1.0.0.0",
      "triggers": {
        "manual": {
          "type": "Request",
          "kind": "Http",
          "inputs": {
            "method": "POST",
            "schema": {
              "properties": {
                "incidentId": { "type": "string" },
                "classification": { "type": "string" },
                "confidence": { "type": "integer" },
                "mitreAttack": { "type": "array" },
                "summary": { "type": "string" }
              }
            }
          }
        }
      },
      "actions": {
        "Update_incident": {
          "type": "ApiConnection",
          "inputs": {
            "host": {
              "connection": {
                "name": "@parameters('$connections')['azuresentinel']['connectionId']"
              }
            },
            "method": "put",
            "path": "/Incidents/@{encodeURIComponent(triggerBody()?['incidentId'])}",
            "body": {
              "properties": {
                "description": "@{triggerBody()?['summary']}",
                "labels": [
                  {
                    "labelName": "@{triggerBody()?['classification']}",
                    "labelType": "User"
                  }
                ]
              }
            }
          }
        }
      }
    }
  },
  {
    id: "splunk",
    name: "Splunk",
    icon: Database,
    color: "text-green-500",
    description: "Enterprise security information and event management",
    webhook: "/api/webhook/splunk",
    requiresCustomScript: true,
    steps: [
      "1. Install 'REST API Modular Input' app from Splunkbase",
      "2. Create a webhook alert action in Settings > Alert actions",
      "3. Configure the webhook URL and authentication",
      "4. Set up a scripted input to receive callbacks",
      "5. Create a custom search to process analysis results",
      "6. Test the bidirectional flow"
    ],
    callbackSteps: [
      "1. Create an HTTP Event Collector (HEC) token",
      "2. Use HEC endpoint as your callback URL",
      "3. Configure index for analysis results",
      "4. Create searches to correlate original alerts with AI results",
      "5. Set up dashboards to visualize analysis outcomes"
    ],
    samplePayload: {
      "search_name": "Security Alert",
      "result": { "field1": "value1", "field2": "value2" },
      "callbackUrl": "https://your-splunk.com:8088/services/collector/event",
      "callbackToken": "your-hec-token",
      "apiKey": "cybersight_USER_ID_TOKEN"
    },
    hecConfig: {
      "url": "https://your-splunk.com:8088/services/collector/event",
      "headers": {
        "Authorization": "Splunk your-hec-token",
        "Content-Type": "application/json"
      },
      "body": {
        "time": "@timestamp",
        "source": "cybersight-ai",
        "sourcetype": "cybersight:analysis",
        "index": "security",
        "event": "@analysis_results"
      }
    }
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
    ],
    callbackSteps: [
      "1. Create an index template for analysis results",
      "2. Set up index lifecycle management policies",
      "3. Use Elasticsearch ingest API as callback URL",
      "4. Configure field mappings for analysis data",
      "5. Create visualizations for analysis results in Kibana"
    ],
    samplePayload: {
      "alert": { "id": "alert-id", "name": "Security Alert" },
      "rule": { "name": "Detection Rule", "id": "rule-id" },
      "callbackUrl": "https://your-elastic.com:9200/cybersight-analysis/_doc",
      "callbackAuth": "ApiKey your-api-key",
      "apiKey": "cybersight_USER_ID_TOKEN"
    },
    indexTemplate: {
      "index_patterns": ["cybersight-analysis-*"],
      "mappings": {
        "properties": {
          "@timestamp": { "type": "date" },
          "incidentId": { "type": "keyword" },
          "classification": { "type": "keyword" },
          "confidence": { "type": "integer" },
          "mitreAttack": { "type": "keyword" },
          "iocs": { "type": "keyword" },
          "summary": { "type": "text" }
        }
      }
    }
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
    ],
    callbackSteps: [
      "1. Use CrowdStrike Incidents API as callback mechanism",
      "2. Configure API client with 'incidents:write' scope",
      "3. Map CyberSight analysis to CrowdStrike incident fields",
      "4. Update incident status and add analysis as comments",
      "5. Optionally trigger custom IOC management"
    ],
    samplePayload: {
      "event": { "type": "SecurityEvent", "data": "event-data" },
      "metadata": { "customer": "customer-id", "timestamp": "2025-01-20T10:00:00Z" },
      "callbackConfig": {
        "type": "crowdstrike-api",
        "clientId": "your-client-id",
        "baseUrl": "https://api.crowdstrike.com"
      },
      "apiKey": "cybersight_USER_ID_TOKEN"
    },
    apiIntegration: {
      "endpoint": "https://api.crowdstrike.com/incidents/entities/incidents/v1",
      "method": "PATCH",
      "headers": {
        "Authorization": "Bearer YOUR_ACCESS_TOKEN",
        "Content-Type": "application/json"
      },
      "body": {
        "resources": [{
          "incident_id": "@incident_id",
          "status": "@analysis_status",
          "description": "@analysis_summary"
        }]
      }
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
      "2. Add a new webhook endpoint using the URL below",
      "3. Configure authentication with your API key",
      "4. Set up a callback endpoint to receive results",
      "5. Test both outgoing and incoming flows",
      "6. Monitor the integration logs"
    ],
    callbackSteps: [
      "1. Create an HTTP endpoint in your SIEM to receive callbacks",
      "2. Configure authentication for the callback endpoint",
      "3. Process the analysis results in your SIEM",
      "4. Update incident records with AI analysis data",
      "5. Set up alerting based on analysis confidence scores"
    ],
    samplePayload: {
      "logs": ["security log 1", "security log 2"],
      "metadata": { "source": "SIEM-Tool", "severity": "high" },
      "callbackUrl": "https://your-siem.com/api/callback",
      "callbackAuth": "Bearer your-callback-token",
      "apiKey": "cybersight_USER_ID_TOKEN"
    },
    callbackFormat: {
      "incidentId": "uuid-string",
      "originalId": "your-siem-incident-id",
      "classification": "true-positive|false-positive",
      "confidence": "0-100",
      "severity": "critical|high|medium|low|informational",
      "mitreAttack": ["T1055", "T1059"],
      "iocs": ["malicious-ip", "suspicious-domain"],
      "summary": "Detailed AI analysis results",
      "timestamp": "ISO-8601 datetime",
      "source": "CyberSight AI Analysis"
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
                        value={`cybersight_${(user as any)?.id || 'USER_ID'}_TOKEN`}
                        readOnly
                        className="font-mono text-sm cyber-slate"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(`cybersight_${(user as any)?.id || 'USER_ID'}_TOKEN`)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Replace USER_ID with your actual user ID: {(user as any)?.id}
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
                <code className="text-cyber-blue">{"{ \"apiKey\": \"cybersight_" + ((user as any)?.id || 'USER_ID') + "_TOKEN\" }"}</code>
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
                  value={`${window.location.origin}/api/webhook/ingest/${(user as any)?.id || 'USER_ID'}/TOKEN`}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(`${window.location.origin}/api/webhook/ingest/${(user as any)?.id || 'USER_ID'}/TOKEN`)}
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