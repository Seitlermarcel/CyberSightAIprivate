import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon, Save, Brain, Monitor, Shield, Info, Palette, Clock, Bell, Shield as SecurityShield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Settings, InsertSettings } from "@shared/schema";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["/api/user"],
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/settings", user?.id],
    enabled: !!user?.id,
  });

  const [formData, setFormData] = useState<Partial<InsertSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<InsertSettings>) => {
      const response = await apiRequest("PATCH", `/api/settings/${user?.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setHasChanges(false);
      toast({
        title: "Settings Saved",
        description: "Your preferences have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSettingChange = (key: keyof InsertSettings, value: any) => {
    setFormData(prev => {
      const newData = { ...prev };
      newData[key] = value;
      return newData;
    });
    setHasChanges(true);
  };

  const saveSettings = () => {
    // Get current values for validation
    const emailNotifications = getCurrentValue("emailNotifications") || false;
    const emailAddress = getCurrentValue("emailAddress") || "";
    
    // Validate email address if email notifications are enabled
    if (emailNotifications && !emailAddress.trim()) {
      toast({
        title: "Email Address Required",
        description: "Please enter an email address to enable email notifications.",
        variant: "destructive",
      });
      return;
    }
    
    // Validate email format
    if (emailNotifications && emailAddress && !emailAddress.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast({
        title: "Invalid Email Address",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    // Always allow save - create a complete settings object from current values
    const dataToSave = {
      analysisDepth: getCurrentValue("analysisDepth") || "comprehensive",
      confidenceThreshold: getCurrentValue("confidenceThreshold") || 80,
      enableDualAI: getCurrentValue("enableDualAI") || true,
      autoSeverityAdjustment: getCurrentValue("autoSeverityAdjustment") || false,
      customInstructions: getCurrentValue("customInstructions") || "", // This can be empty!
      theme: getCurrentValue("theme") || "dark",
      sessionTimeout: getCurrentValue("sessionTimeout") || 480,
      compactView: getCurrentValue("compactView") || false,
      autoRefresh: getCurrentValue("autoRefresh") || false,
      requireComments: getCurrentValue("requireComments") || false,
      emailNotifications: emailNotifications,
      emailAddress: emailAddress.trim(),
      highSeverityAlerts: getCurrentValue("highSeverityAlerts") || false,
    };
    
    updateSettingsMutation.mutate(dataToSave, {
      onSuccess: () => {
        // Apply theme change immediately after successful save
        if (dataToSave.theme) {
          const root = document.documentElement;
          root.classList.remove("light", "dark");
          if (dataToSave.theme === "light") {
            root.classList.add("light");
          }
        }
        setHasChanges(false);
        setFormData({}); // Clear form data after successful save
        
        // Show specific message for email notifications
        if (dataToSave.emailNotifications && dataToSave.emailAddress) {
          toast({
            title: "Email Notifications Enabled",
            description: `Incident alerts will be sent to ${dataToSave.emailAddress}`,
          });
        }
      }
    });
  };

  const getCurrentValue = (key: keyof InsertSettings) => {
    // Use formData if it has the key, otherwise use settings with safe defaults
    if (formData.hasOwnProperty(key)) {
      return formData[key];
    }
    const settingsValue = settings?.[key];
    // Handle null/undefined for text fields
    if ((key === 'customInstructions' || key === 'emailAddress') && (settingsValue === null || settingsValue === undefined)) {
      return "";
    }
    return settingsValue;
  };

  if (isLoading || !settings) {
    return (
      <div className="space-y-6">
        <div className="cyber-slate rounded-xl p-8 text-center">
          <div className="w-16 h-16 border-4 border-cyber-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 cyber-slate rounded-lg flex items-center justify-center">
            <SettingsIcon className="text-cyber-purple text-xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-gray-400">Configure your CyberSight AI experience</p>
          </div>
        </div>
        <Button 
          onClick={saveSettings}
          disabled={updateSettingsMutation.isPending}
          className="cyber-blue hover:bg-blue-600"
          type="button"
        >
          <Save className="w-4 h-4 mr-2" />
          {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      {/* AI Analysis Configuration */}
      <Card className="cyber-slate border-cyber-slate-light">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Brain className="text-cyber-purple" />
            <CardTitle>AI Analysis Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="analysisDepth">Analysis Depth</Label>
              <Select 
                value={getCurrentValue("analysisDepth") || "comprehensive"} 
                onValueChange={(value) => handleSettingChange("analysisDepth", value)}
              >
                <SelectTrigger className="cyber-dark border-cyber-slate-light">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="cyber-dark border-cyber-slate-light">
                  <SelectItem value="basic">Basic - Quick analysis</SelectItem>
                  <SelectItem value="standard">Standard - Balanced analysis</SelectItem>
                  <SelectItem value="comprehensive">Comprehensive - Deep analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Label htmlFor="confidenceThreshold">Confidence Threshold (%)</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-2">
                        <p className="font-medium">Confidence Threshold:</p>
                        <p className="text-xs">Minimum confidence required for AI classifications. Incidents below this threshold require manual review. Higher values reduce false positives but may miss threats.</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="px-3">
                <Slider
                  value={[getCurrentValue("confidenceThreshold") || 80]}
                  onValueChange={(value) => handleSettingChange("confidenceThreshold", value[0])}
                  max={100}
                  min={0}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0%</span>
                  <span className="font-medium">{getCurrentValue("confidenceThreshold") || 80}%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="enableDualAI">Enable Dual AI Analysis</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-gray-500 hover:text-gray-300 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="space-y-2">
                          <p className="font-medium">Dual-AI Analysis:</p>
                          <p className="text-xs">Enables Tactical Analyst (technical evidence), Strategic Analyst (patterns & hypotheticals), and Chief Analyst (final synthesis) for comprehensive incident analysis.</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="text-sm text-gray-400">Use Tactical, Strategic & Chief analysts for enhanced accuracy</div>
              </div>
              <Switch
                id="enableDualAI"
                checked={getCurrentValue("enableDualAI") || false}
                onCheckedChange={(checked) => handleSettingChange("enableDualAI", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoSeverityAdjustment">Auto Severity Adjustment</Label>
                <div className="text-sm text-gray-400">Allow AI to automatically adjust severity based on analysis</div>
              </div>
              <Switch
                id="autoSeverityAdjustment"
                checked={getCurrentValue("autoSeverityAdjustment") || false}
                onCheckedChange={(checked) => handleSettingChange("autoSeverityAdjustment", checked)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customInstructions">Custom Analysis Instructions</Label>
            <Textarea
              id="customInstructions"
              placeholder="Enter any specific instructions for the AI analysis (e.g., focus on specific attack vectors, compliance requirements, etc.)"
              value={getCurrentValue("customInstructions") || ""}
              onChange={(e) => handleSettingChange("customInstructions", e.target.value)}
              className="cyber-dark border-cyber-slate-light text-white placeholder-gray-500 min-h-[100px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* User Interface */}
      <Card className="cyber-slate border-cyber-slate-light">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Monitor className="text-cyber-cyan" />
            <CardTitle>User Interface</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Select 
                value={getCurrentValue("theme") || "dark"} 
                onValueChange={(value) => handleSettingChange("theme", value)}
              >
                <SelectTrigger className="cyber-dark border-cyber-slate-light">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="cyber-dark border-cyber-slate-light">
                  <SelectItem value="dark">🌙 Dark Theme</SelectItem>
                  <SelectItem value="light">☀️ Light Theme</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                min="30"
                max="1440"
                value={getCurrentValue("sessionTimeout") || 480}
                onChange={(e) => handleSettingChange("sessionTimeout", parseInt(e.target.value))}
                className="cyber-dark border-cyber-slate-light text-white"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="compactView">Compact View</Label>
                <div className="text-sm text-gray-400">Show more information in less space</div>
              </div>
              <Switch
                id="compactView"
                checked={getCurrentValue("compactView") || false}
                onCheckedChange={(checked) => handleSettingChange("compactView", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoRefresh">Auto-refresh Incidents</Label>
                <div className="text-sm text-gray-400">Automatically refresh incident list every 30 seconds</div>
              </div>
              <Switch
                id="autoRefresh"
                checked={getCurrentValue("autoRefresh") || false}
                onCheckedChange={(checked) => handleSettingChange("autoRefresh", checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security & Workflow */}
      <Card className="cyber-slate border-cyber-slate-light">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Shield className="text-green-500" />
            <CardTitle>Security & Workflow</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="requireComments">Require Comment on Status Changes</Label>
              <div className="text-sm text-gray-400">Force analysts to add comments when changing incident status</div>
            </div>
            <Switch
              id="requireComments"
              checked={getCurrentValue("requireComments") || false}
              onCheckedChange={(checked) => handleSettingChange("requireComments", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="emailNotifications">Email Notifications</Label>
              <div className="text-sm text-gray-400">Receive email alerts for new incidents with PDF reports</div>
            </div>
            <Switch
              id="emailNotifications"
              checked={getCurrentValue("emailNotifications") || false}
              onCheckedChange={(checked) => handleSettingChange("emailNotifications", checked)}
            />
          </div>

          {getCurrentValue("emailNotifications") && (
            <div className="space-y-2 ml-6 border-l-2 border-cyber-blue pl-4 bg-slate-800/30 p-4 rounded-lg">
              <Label htmlFor="emailAddress" className="text-cyan-400 font-medium">Email Address *</Label>
              <Input
                id="emailAddress"
                type="email"
                placeholder="Enter your email address for notifications"
                value={getCurrentValue("emailAddress") || ""}
                onChange={(e) => handleSettingChange("emailAddress", e.target.value)}
                className="cyber-dark border-cyber-slate-light text-white placeholder-gray-500 focus:border-cyan-400"
                required
              />
              <p className="text-xs text-gray-400">
                📧 This email will receive incident notifications with PDF reports attached
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="highSeverityAlerts">High Severity Alerts</Label>
              <div className="text-sm text-gray-400">Immediate notifications for critical and high severity incidents</div>
            </div>
            <Switch
              id="highSeverityAlerts"
              checked={getCurrentValue("highSeverityAlerts") || false}
              onCheckedChange={(checked) => handleSettingChange("highSeverityAlerts", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Advanced Configuration */}
      <Card className="cyber-slate border-cyber-slate-light">
        <CardHeader>
          <CardTitle>Advanced Configuration</CardTitle>
          <CardDescription>
            Expert-level settings for advanced users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="cyber-dark rounded-lg p-4 border border-yellow-600">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
              <span className="font-medium text-yellow-400">Advanced Settings</span>
            </div>
            <p className="text-sm text-gray-400">
              These settings affect core functionality. Only modify if you understand the implications.
            </p>
          </div>

          <div className="space-y-2">
            <Label>API Rate Limiting</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-400">Requests per minute</Label>
                <Input
                  type="number"
                  value="60"
                  disabled
                  className="cyber-dark border-cyber-slate-light text-gray-400"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-400">Burst limit</Label>
                <Input
                  type="number"
                  value="100"
                  disabled
                  className="cyber-dark border-cyber-slate-light text-gray-400"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}