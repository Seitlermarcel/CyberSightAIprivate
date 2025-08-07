import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Shield, Settings, Zap, Monitor, Bell, Save, RotateCcw, Check, Database, AlertTriangle } from "lucide-react";
import { useUserPreferences, useThemePreference, useEmailPreferences, useAnalysisPreferences } from "@/hooks/use-user-preferences";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";

export default function SettingsPage() {
  const { toast } = useToast();

  // Get current user
  const { data: user } = useQuery({
    queryKey: ["/api/user"],
  });

  const userId = user?.id || "default-user";

  // Use the persistent preferences hooks
  const {
    preferences,
    isLoading,
    isUpdating,
    updateSinglePreference,
    updateMultiplePreferences,
    resetPreferences,
    utils,
  } = useUserPreferences(userId);

  const { currentTheme, toggleTheme } = useThemePreference(userId);
  const { configureEmail, disableEmailNotifications } = useEmailPreferences(userId);
  const { toggleDualAI, toggleAutoSeverityAdjustment, setAnalysisDepth } = useAnalysisPreferences(userId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Database className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">Loading your preferences...</p>
        </div>
      </div>
    );
  }

  const handleEmailToggle = async (enabled: boolean) => {
    if (enabled && !preferences?.emailAddress) {
      toast({
        title: "Email Address Required",
        description: "Please enter an email address first.",
        variant: "destructive",
      });
      return;
    }
    
    await updateSinglePreference('emailNotifications', enabled);
    
    if (enabled) {
      toast({
        title: "Email Notifications Enabled",
        description: "You will receive incident notifications.",
      });
    }
  };

  const handleEmailSubmit = async (emailAddress: string) => {
    if (!emailAddress) {
      toast({
        title: "Email Address Required",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    await configureEmail(emailAddress, true, false);
    toast({
      title: "Email Configuration Saved",
      description: "Your email preferences have been updated.",
    });
  };

  const handleResetSettings = async () => {
    await resetPreferences();
    toast({
      title: "Settings Reset",
      description: "All preferences have been restored to defaults.",
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure your cybersecurity analysis preferences
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Database className="h-3 w-3" />
            Persistent Storage
          </Badge>
          {isUpdating && (
            <Badge variant="secondary" className="gap-1">
              <div className="h-2 w-2 bg-current rounded-full animate-pulse" />
              Saving...
            </Badge>
          )}
        </div>
      </div>

      {/* Persistence Alert */}
      <Alert>
        <Check className="h-4 w-4" />
        <AlertDescription>
          Your settings are now permanently saved to the database and will persist across sessions.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* AI Analysis Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              AI Analysis Settings
            </CardTitle>
            <CardDescription>
              Configure how the AI analyzes security incidents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="analysis-depth">Analysis Depth</Label>
              <Select
                value={preferences?.analysisDepth || "comprehensive"}
                onValueChange={(value) => setAnalysisDepth(value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic - Quick analysis</SelectItem>
                  <SelectItem value="comprehensive">Comprehensive - Detailed analysis</SelectItem>
                  <SelectItem value="advanced">Advanced - Deep investigation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Dual AI Analysis</Label>
                <p className="text-sm text-muted-foreground">
                  Use multiple AI perspectives for enhanced accuracy
                </p>
              </div>
              <Switch
                checked={preferences?.enableDualAI ?? true}
                onCheckedChange={toggleDualAI}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto Severity Adjustment</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically adjust severity based on context
                </p>
              </div>
              <Switch
                checked={preferences?.autoSeverityAdjustment || false}
                onCheckedChange={toggleAutoSeverityAdjustment}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-instructions">Custom Analysis Instructions</Label>
              <Textarea
                id="custom-instructions"
                placeholder="Enter specific instructions for AI analysis..."
                value={preferences?.customInstructions || ""}
                onChange={(e) => updateSinglePreference('customInstructions', e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Interface Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Interface Settings
            </CardTitle>
            <CardDescription>
              Customize the appearance and behavior of the interface
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Theme</Label>
              <Select value={currentTheme} onValueChange={(value) => updateSinglePreference('theme', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark Theme (Cyber Style)</SelectItem>
                  <SelectItem value="light">Light Theme</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Compact View</Label>
                <p className="text-sm text-muted-foreground">
                  Display more information in less space
                </p>
              </div>
              <Switch
                checked={preferences?.compactView || false}
                onCheckedChange={(checked) => updateSinglePreference('compactView', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto Refresh</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically refresh data every 30 seconds
                </p>
              </div>
              <Switch
                checked={preferences?.autoRefresh || false}
                onCheckedChange={(checked) => updateSinglePreference('autoRefresh', checked)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
              <Select
                value={String(preferences?.sessionTimeout || 480)}
                onValueChange={(value) => updateSinglePreference('sessionTimeout', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                  <SelectItem value="480">8 hours</SelectItem>
                  <SelectItem value="1440">24 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Workflow Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Workflow Settings
            </CardTitle>
            <CardDescription>
              Configure incident handling and review processes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Comments</Label>
                <p className="text-sm text-muted-foreground">
                  Require analyst comments before closing incidents
                </p>
              </div>
              <Switch
                checked={preferences?.requireComments || false}
                onCheckedChange={(checked) => updateSinglePreference('requireComments', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Email Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Email Notifications
            </CardTitle>
            <CardDescription>
              Configure email alerts for security incidents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email-address">Email Address</Label>
              <Input
                id="email-address"
                type="email"
                placeholder="Enter your email address"
                value={preferences?.emailAddress || ""}
                onChange={(e) => updateSinglePreference('emailAddress', e.target.value)}
                onBlur={(e) => {
                  if (e.target.value && e.target.value !== preferences?.emailAddress) {
                    handleEmailSubmit(e.target.value);
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive email alerts for new incidents
                </p>
              </div>
              <Switch
                checked={preferences?.emailNotifications || false}
                onCheckedChange={handleEmailToggle}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>High Severity Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Immediate alerts for critical incidents
                </p>
              </div>
              <Switch
                checked={preferences?.highSeverityAlerts || false}
                onCheckedChange={(checked) => updateSinglePreference('highSeverityAlerts', checked)}
              />
            </div>

            {utils.isEmailConfigured() && (
              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <Check className="h-4 w-4" />
                  <span className="text-sm font-medium">Email notifications are active</span>
                </div>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                  Notifications will be sent to {preferences?.emailAddress}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-6 border-t">
        <Button
          variant="outline"
          onClick={handleResetSettings}
          disabled={isUpdating}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Reset to Defaults
        </Button>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Database className="h-4 w-4" />
          All changes are automatically saved to the database
        </div>
      </div>
    </div>
  );
}