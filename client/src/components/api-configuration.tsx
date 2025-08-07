import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Code2, Key, Copy, RefreshCw, Shield, Code, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ApiConfiguration() {
  const [apiKey, setApiKey] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  const { data: apiConfig, isLoading } = useQuery({
    queryKey: ["/api/api-config"],
  });

  const generateKeyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/api-config/generate-key");
      return response.json();
    },
    onSuccess: (data) => {
      setApiKey(data.apiKey);
      queryClient.invalidateQueries({ queryKey: ["/api/api-config"] });
      toast({
        title: "API Key Generated",
        description: "Your new API key has been created successfully.",
      });
    },
  });

  const testApiMutation = useMutation({
    mutationFn: async (testData: any) => {
      const response = await apiRequest("POST", "/api/api-config/test", testData);
      return response.json();
    },
    onSuccess: (data) => {
      setTestResult({ success: true, message: "API test successful!" });
      toast({
        title: "Test Successful",
        description: "Your API integration is working correctly.",
      });
    },
    onError: (error) => {
      setTestResult({ success: false, message: "API test failed. Check your configuration." });
      toast({
        title: "Test Failed",
        description: "Please verify your API configuration.",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Content copied to clipboard.",
    });
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="cyber-slate border-b border-cyber-slate-light p-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
            <Code2 className="text-white text-xl" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-green-400">API Configuration</h2>
            <p className="text-gray-400">Configure external log ingestion and API access</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* API Key Management */}
        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="text-green-400" />
              <span>API Key Management</span>
            </CardTitle>
            <CardDescription className="text-gray-400">
              Generate and manage API keys for external integrations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {apiKey ? (
              <div className="space-y-4">
                <Alert className="cyber-dark border-green-500">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertTitle>New API Key Generated</AlertTitle>
                  <AlertDescription className="mt-2">
                    <div className="space-y-2">
                      <p className="text-gray-300">Save this key now. It won't be shown again.</p>
                      <div className="flex items-center space-x-2">
                        <Input
                          value={apiKey}
                          readOnly
                          className="cyber-dark border-cyber-slate-light font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(apiKey)}
                          className="border-green-500 text-green-400 hover:bg-green-500/10"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 cyber-dark rounded-lg">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Active API Keys</p>
                  <p className="text-2xl font-bold">{apiConfig?.activeKeys || 0}</p>
                </div>
                <Button
                  onClick={() => generateKeyMutation.mutate()}
                  disabled={generateKeyMutation.isPending}
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  {generateKeyMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Key className="h-4 w-4 mr-2" />
                      Generate New Key
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Active Keys List */}
            {apiConfig?.keys && apiConfig.keys.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-400">Active Keys</h4>
                {apiConfig.keys.map((key: any) => (
                  <div key={key.id} className="flex items-center justify-between p-3 cyber-dark rounded-lg">
                    <div>
                      <code className="text-xs text-gray-400">...{key.lastFour}</code>
                      <p className="text-xs text-gray-500 mt-1">Created: {new Date(key.created).toLocaleDateString()}</p>
                    </div>
                    <Badge className={key.active ? "bg-green-500" : "bg-gray-600"}>
                      {key.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Documentation */}
        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Code className="text-cyber-blue" />
              <span>API Documentation</span>
            </CardTitle>
            <CardDescription className="text-gray-400">
              Integration endpoints and usage examples
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="endpoints" className="w-full">
              <TabsList className="grid w-full grid-cols-3 cyber-dark">
                <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
                <TabsTrigger value="examples">Examples</TabsTrigger>
                <TabsTrigger value="test">Test API</TabsTrigger>
              </TabsList>
              
              <TabsContent value="endpoints" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="cyber-dark rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">Log Ingestion Endpoint</h4>
                      <Badge className="bg-green-500">POST</Badge>
                    </div>
                    <code className="text-sm text-gray-400 block mb-2">{baseUrl}/api/external/logs</code>
                    <p className="text-xs text-gray-500">Submit security logs for analysis</p>
                  </div>

                  <div className="cyber-dark rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">Batch Log Upload</h4>
                      <Badge className="bg-green-500">POST</Badge>
                    </div>
                    <code className="text-sm text-gray-400 block mb-2">{baseUrl}/api/external/logs/batch</code>
                    <p className="text-xs text-gray-500">Submit multiple logs in a single request</p>
                  </div>

                  <div className="cyber-dark rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">Get Analysis Results</h4>
                      <Badge className="bg-blue-500">GET</Badge>
                    </div>
                    <code className="text-sm text-gray-400 block mb-2">{baseUrl}/api/external/analysis/:id</code>
                    <p className="text-xs text-gray-500">Retrieve analysis results for submitted logs</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="examples" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="cyber-dark rounded-lg p-4">
                    <h4 className="font-semibold mb-3">CURL Example - Submit Log</h4>
                    <pre className="text-xs text-gray-400 overflow-x-auto">
{`curl -X POST ${baseUrl}/api/external/logs \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Suspicious Login Attempt",
    "severity": "high",
    "logData": "Failed login attempts from IP 192.168.1.100",
    "source": "SSH Server"
  }'`}
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(`curl -X POST ${baseUrl}/api/external/logs -H "Authorization: Bearer YOUR_API_KEY" -H "Content-Type: application/json" -d '{"title": "Suspicious Login Attempt", "severity": "high", "logData": "Failed login attempts from IP 192.168.1.100", "source": "SSH Server"}'`)}
                      className="mt-2 border-gray-600 text-gray-400 hover:bg-gray-700"
                    >
                      <Copy className="h-3 w-3 mr-2" />
                      Copy
                    </Button>
                  </div>

                  <div className="cyber-dark rounded-lg p-4">
                    <h4 className="font-semibold mb-3">Python Example</h4>
                    <pre className="text-xs text-gray-400 overflow-x-auto">
{`import requests

url = "${baseUrl}/api/external/logs"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
data = {
    "title": "Potential Data Exfiltration",
    "severity": "critical",
    "logData": "Large data transfer detected to unknown IP",
    "source": "Firewall"
}

response = requests.post(url, json=data, headers=headers)
print(response.json())`}
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(`import requests\n\nurl = "${baseUrl}/api/external/logs"\nheaders = {"Authorization": "Bearer YOUR_API_KEY", "Content-Type": "application/json"}\ndata = {"title": "Potential Data Exfiltration", "severity": "critical", "logData": "Large data transfer detected to unknown IP", "source": "Firewall"}\n\nresponse = requests.post(url, json=data, headers=headers)\nprint(response.json())`)}
                      className="mt-2 border-gray-600 text-gray-400 hover:bg-gray-700"
                    >
                      <Copy className="h-3 w-3 mr-2" />
                      Copy
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="test" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <Alert className="cyber-dark border-cyber-slate-light">
                    <Shield className="h-4 w-4" />
                    <AlertTitle>Test Your API Integration</AlertTitle>
                    <AlertDescription>
                      Send a test request to verify your API configuration is working correctly.
                    </AlertDescription>
                  </Alert>

                  <div className="cyber-dark rounded-lg p-4 space-y-4">
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">API Key</label>
                      <Input
                        placeholder="Enter your API key"
                        className="cyber-dark border-cyber-slate-light"
                        onChange={(e) => setApiKey(e.target.value)}
                      />
                    </div>

                    <Button
                      onClick={() => testApiMutation.mutate({ apiKey, testData: "Test log entry" })}
                      disabled={!apiKey || testApiMutation.isPending}
                      className="w-full bg-cyber-blue hover:bg-blue-600"
                    >
                      {testApiMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        "Send Test Request"
                      )}
                    </Button>

                    {testResult && (
                      <Alert className={`cyber-dark ${testResult.success ? 'border-green-500' : 'border-red-500'}`}>
                        {testResult.success ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <AlertDescription>{testResult.message}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Integration Status */}
        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="text-cyber-purple" />
              <span>Integration Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="cyber-dark rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-2">Total Requests</p>
                <p className="text-2xl font-bold">{apiConfig?.stats?.totalRequests || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
              </div>
              <div className="cyber-dark rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-2">Success Rate</p>
                <p className="text-2xl font-bold text-green-400">{apiConfig?.stats?.successRate || 100}%</p>
                <p className="text-xs text-gray-500 mt-1">API reliability</p>
              </div>
              <div className="cyber-dark rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-2">Avg Response Time</p>
                <p className="text-2xl font-bold">{apiConfig?.stats?.avgResponseTime || 45}ms</p>
                <p className="text-xs text-gray-500 mt-1">Processing speed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}