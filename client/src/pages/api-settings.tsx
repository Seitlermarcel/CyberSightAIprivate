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
  Edit,
  Trash2,
  Settings,
  Shield,
  Activity,
  AlertCircle,
  CheckCircle,
  Copy,
  Eye,
  EyeOff,
  TestTube,
  Webhook,
  Server,
  Database,
  Cloud,
  Key,
} from "lucide-react";

export default function ApiSettings() {
  const { toast } = useToast();
  const [selectedConfig, setSelectedConfig] = useState<any>(null);
  const [showApiKey, setShowApiKey] = useState<{ [key: string]: boolean }>({});
  const [isTestingConfig, setIsTestingConfig] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Fetch API configurations
  const { data: apiConfigs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/api-configurations"],
  });

  // Fetch user data for webhook endpoints
  const { data: user } = useQuery<{ id: string }>({
    queryKey: ["/api/user"],
  });

  // Create API configuration
  const createConfigMutation = useMutation({
    mutationFn: async (config: any) => {
      return await apiRequest("POST", "/api/api-configurations", config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-configurations"] });
      toast({
        title: "Configuration Created",
        description: "API configuration has been successfully created.",
      });
      setShowAddDialog(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create API configuration.",
        variant: "destructive",
      });
    },
  });

  // Update API configuration
  const updateConfigMutation = useMutation({
    mutationFn: async ({ id, ...config }: any) => {
      return await apiRequest("PATCH", `/api/api-configurations/${id}`, config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-configurations"] });
      toast({
        title: "Configuration Updated",
        description: "API configuration has been successfully updated.",
      });
      setSelectedConfig(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update API configuration.",
        variant: "destructive",
      });
    },
  });

  // Delete API configuration
  const deleteConfigMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/api-configurations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-configurations"] });
      toast({
        title: "Configuration Deleted",
        description: "API configuration has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete API configuration.",
        variant: "destructive",
      });
    },
  });

  // Test API configuration
  const testConfigMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/api-configurations/${id}/test`);
    },
    onSuccess: (data) => {
      toast({
        title: "Test Successful",
        description: "API configuration is working correctly.",
      });
    },
    onError: (error) => {
      toast({
        title: "Test Failed",
        description: "Unable to connect to the API endpoint.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsTestingConfig(null);
    },
  });

  const handleTest = (id: string) => {
    setIsTestingConfig(id);
    testConfigMutation.mutate(id);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "API key copied to clipboard.",
    });
  };

  const getEndpointIcon = (type: string) => {
    switch (type) {
      case "webhook": return <Webhook className="w-4 h-4" />;
      case "syslog": return <Server className="w-4 h-4" />;
      case "splunk": return <Database className="w-4 h-4" />;
      case "elastic": return <Database className="w-4 h-4" />;
      case "azure-sentinel": return <Cloud className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  const ConfigForm = ({ config, onSubmit, onCancel }: any) => {
    const [formData, setFormData] = useState(config || {
      name: "",
      endpointType: "webhook",
      endpointUrl: "",
      apiKey: "",
      apiSecret: "",
      authType: "api-key",
      queryInterval: 60,
      isActive: true,
      headers: {},
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(formData);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Configuration Name</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Production SIEM"
            required
          />
        </div>

        <div>
          <Label>Endpoint Type</Label>
          <Select
            value={formData.endpointType}
            onValueChange={(value) => setFormData({ ...formData, endpointType: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="webhook">Webhook</SelectItem>
              <SelectItem value="syslog">Syslog</SelectItem>
              <SelectItem value="splunk">Splunk</SelectItem>
              <SelectItem value="elastic">Elasticsearch</SelectItem>
              <SelectItem value="azure-sentinel">Azure Sentinel</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Endpoint URL</Label>
          <Input
            value={formData.endpointUrl}
            onChange={(e) => setFormData({ ...formData, endpointUrl: e.target.value })}
            placeholder="https://api.example.com/logs"
            required
          />
        </div>

        <div>
          <Label>Authentication Type</Label>
          <Select
            value={formData.authType}
            onValueChange={(value) => setFormData({ ...formData, authType: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="api-key">API Key</SelectItem>
              <SelectItem value="oauth">OAuth 2.0</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formData.authType !== "none" && (
          <>
            <div>
              <Label>API Key / Username</Label>
              <Input
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="Enter API key or username"
              />
            </div>

            {formData.authType === "oauth" && (
              <div>
                <Label>OAuth Client Secret</Label>
                <Input
                  type="password"
                  value={formData.apiSecret}
                  onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                  placeholder="Enter OAuth client secret"
                />
              </div>
            )}
          </>
        )}

        <div>
          <Label>Query Interval (seconds)</Label>
          <Input
            type="number"
            value={formData.queryInterval}
            onChange={(e) => setFormData({ ...formData, queryInterval: parseInt(e.target.value) })}
            min="10"
            max="3600"
          />
          <p className="text-xs text-gray-500 mt-1">How often to check for new logs (10-3600 seconds)</p>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
          />
          <Label>Active</Label>
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">
            {config?.id ? "Update" : "Create"} Configuration
          </Button>
        </div>
      </form>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Configurations</h1>
          <p className="text-gray-500">Configure log streaming endpoints and integrations</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="cyber-blue hover:bg-blue-600">
              <Plus className="w-4 h-4 mr-2" />
              Add Configuration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add API Configuration</DialogTitle>
              <DialogDescription>
                Configure a new log streaming endpoint
              </DialogDescription>
            </DialogHeader>
            <ConfigForm
              onSubmit={(data: any) => createConfigMutation.mutate(data)}
              onCancel={() => setShowAddDialog(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Your Webhook Endpoints */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Webhook className="text-cyber-blue" />
              <span>Generic Webhook</span>
            </CardTitle>
            <CardDescription>
              Send logs with API key authentication
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
              <div className="p-2 cyber-dark rounded text-xs">
                <p className="text-gray-400 mb-1">Required headers:</p>
                <code className="text-cyber-blue">apiKey: cybersight_{user?.id || 'USER_ID'}_TOKEN</code>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="text-green-500" />
              <span>Personal Endpoint</span>
            </CardTitle>
            <CardDescription>
              Your unique user-specific webhook URL
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
              <div className="p-2 cyber-dark rounded text-xs">
                <p className="text-gray-400 mb-1">Replace TOKEN with your unique token</p>
                <p className="text-green-400">No API key required in headers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Configurations List */}
      <div className="grid gap-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-cyber-blue border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Loading configurations...</p>
          </div>
        ) : apiConfigs && apiConfigs.length > 0 ? (
          apiConfigs.map((config: any) => (
            <Card key={config.id} className="cyber-slate border-cyber-slate-light">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getEndpointIcon(config.endpointType)}
                    <div>
                      <CardTitle className="text-lg">{config.name}</CardTitle>
                      <CardDescription className="flex items-center space-x-2">
                        <span className="capitalize">{config.endpointType}</span>
                        <span>•</span>
                        <span>{config.endpointUrl}</span>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={config.isActive ? "default" : "secondary"}>
                      {config.isActive ? (
                        <><CheckCircle className="w-3 h-3 mr-1" /> Active</>
                      ) : (
                        <><AlertCircle className="w-3 h-3 mr-1" /> Inactive</>
                      )}
                    </Badge>
                    {config.lastSync && (
                      <Badge variant="outline" className="text-xs">
                        Last sync: {new Date(config.lastSync).toLocaleString()}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <Activity className="w-4 h-4" />
                    <span>Query every {config.queryInterval}s</span>
                    {config.authType !== "none" && (
                      <>
                        <span>•</span>
                        <Key className="w-4 h-4" />
                        <span className="capitalize">{config.authType} Auth</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTest(config.id)}
                      disabled={isTestingConfig === config.id}
                    >
                      <TestTube className="w-4 h-4 mr-1" />
                      {isTestingConfig === config.id ? "Testing..." : "Test"}
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedConfig(config)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Edit API Configuration</DialogTitle>
                          <DialogDescription>
                            Update the configuration settings
                          </DialogDescription>
                        </DialogHeader>
                        <ConfigForm
                          config={selectedConfig}
                          onSubmit={(data: any) => updateConfigMutation.mutate({ ...data, id: config.id })}
                          onCancel={() => setSelectedConfig(null)}
                        />
                      </DialogContent>
                    </Dialog>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this configuration?")) {
                          deleteConfigMutation.mutate(config.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="cyber-slate border-cyber-slate-light">
            <CardContent className="text-center py-12">
              <Shield className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No API Configurations</h3>
              <p className="text-gray-400 mb-4">
                Configure log streaming endpoints to automatically analyze security events
              </p>
              <Button onClick={() => setShowAddDialog(true)} className="cyber-blue hover:bg-blue-600">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Configuration
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}