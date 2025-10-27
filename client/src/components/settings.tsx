import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Settings as SettingsIcon, Brain, Monitor, Shield, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import * as React from "react";
import type { User } from "@shared/schema";

const settingsSchema = z.object({
  analysisDepth: z.string(),
  enableDualAI: z.boolean(),
  autoSeverityAdjustment: z.boolean(),
  customInstructions: z.string().optional(),
  theme: z.string(),
  sessionTimeout: z.number().min(30).max(1440),
  compactView: z.boolean(),
  autoRefresh: z.boolean(),
  requireComments: z.boolean(),
  emailNotifications: z.boolean(),
  highSeverityAlerts: z.boolean(),
  emailAddress: z.string().optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function Settings() {
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get the actual user from the auth endpoint
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });
  
  const userId = user?.id || "default-user"; // Use actual user ID

  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/settings", userId],
    enabled: !!user, // Only fetch settings when user is loaded
  });

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      analysisDepth: "comprehensive",
      enableDualAI: true,
      autoSeverityAdjustment: false,
      customInstructions: "",
      theme: "dark",
      sessionTimeout: 480,
      compactView: false,
      autoRefresh: false,
      requireComments: false,
      emailNotifications: false,
      highSeverityAlerts: false,
      emailAddress: "",
    },
  });

  // Update form when settings are loaded
  React.useEffect(() => {
    if (settings) {
      const settingsData = settings as any; // Type assertion to handle missing fields
      form.reset({
        analysisDepth: settingsData.analysisDepth || "comprehensive",
        enableDualAI: settingsData.enableDualAI ?? true,
        autoSeverityAdjustment: settingsData.autoSeverityAdjustment ?? false,
        customInstructions: settingsData.customInstructions || "",
        theme: settingsData.theme || "dark",
        sessionTimeout: settingsData.sessionTimeout || 480,
        compactView: settingsData.compactView ?? false,
        autoRefresh: settingsData.autoRefresh ?? false,
        requireComments: settingsData.requireComments ?? false,
        emailNotifications: settingsData.emailNotifications ?? false,
        highSeverityAlerts: settingsData.highSeverityAlerts ?? false,
        emailAddress: settingsData.emailAddress || "",
      });
    }
  }, [settings, form]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      const response = await apiRequest("PATCH", `/api/settings/${userId}`, data);
      return response.json();
    },
    onSuccess: () => {
      setSaveSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["/api/settings", userId] });
      toast({
        title: "Settings Saved",
        description: "Your preferences have been updated successfully.",
      });
      
      // Reset success state after 2 seconds
      setTimeout(() => setSaveSuccess(false), 2000);
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SettingsFormData) => {
    console.log("Form submitted with data:", data);
    saveSettingsMutation.mutate(data);
  };

  if (!user || isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyber-purple border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="cyber-slate border-b border-cyber-slate-light p-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 cyber-purple rounded-xl flex items-center justify-center">
            <SettingsIcon className="text-white text-xl" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-cyber-purple">Settings</h2>
            <p className="text-gray-400">Configure your CyberSight AI experience</p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* AI Analysis Configuration */}
            <div className="cyber-slate rounded-xl p-6">
              <div className="flex items-center space-x-2 mb-6">
                <Brain className="text-cyber-blue" />
                <h3 className="text-lg font-semibold">AI Analysis System</h3>
              </div>

              <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-500/20">
                <h4 className="font-medium text-purple-400 mb-3">🧠 What CyberSight AI Does for Incident Analysis</h4>
                <div className="space-y-3 text-sm text-gray-300">
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2"></div>
                    <div>
                      <span className="font-medium text-cyan-400">Multi-Agent Analysis:</span> Employs 8 specialized AI agents including Pattern Recognition, Threat Intelligence, MITRE ATT&CK mapping, and IOC Enrichment for comprehensive incident evaluation.
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                    <div>
                      <span className="font-medium text-green-400">Dual-AI Workflow:</span> Features Tactical Analyst (technical evidence), Strategic Analyst (threat patterns), and Chief Analyst (final synthesis) for enhanced accuracy and decision-making.
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2"></div>
                    <div>
                      <span className="font-medium text-yellow-400">Real-time Processing:</span> Automatically classifies incidents as True/False Positives, maps to MITRE ATT&CK techniques, extracts IOCs, and provides confidence scoring with detailed explanations.
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full mt-2"></div>
                    <div>
                      <span className="font-medium text-red-400">Threat Intelligence:</span> Integrates with AlienVault OTX and other sources to correlate detected indicators with known threats and provide geo-location context.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* User Interface */}
            <div className="cyber-slate rounded-xl p-6">
              <div className="flex items-center space-x-2 mb-6">
                <Monitor className="text-cyber-cyan" />
                <h3 className="text-lg font-semibold">User Interface</h3>
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="theme"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Theme</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="cyber-dark border-cyber-slate-light text-white focus:ring-cyber-cyan">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="cyber-dark border-cyber-slate-light">
                          <SelectItem value="dark">🌙 Dark Theme</SelectItem>
                          <SelectItem value="light">☀️ Light Theme</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-400">Choose your preferred visual theme. Dark theme is optimized for extended cybersecurity analysis sessions.</p>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Security & Workflow */}
            <div className="cyber-slate rounded-xl p-6">
              <div className="flex items-center space-x-2 mb-6">
                <Shield className="text-green-500" />
                <h3 className="text-lg font-semibold">Security & Workflow</h3>
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="requireComments"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-cyber-slate-light p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-medium">Require Comment on Status Changes</FormLabel>
                        <FormDescription className="text-gray-400">
                          Force analysts to add comments when changing incident status
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="emailNotifications"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-cyber-slate-light p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-medium">Email Notifications</FormLabel>
                        <FormDescription className="text-gray-400">
                          Receive email alerts for new incidents
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                {/* Email Address Field - Show when email notifications are enabled */}
                {form.watch("emailNotifications") && (
                  <FormField
                    control={form.control}
                    name="emailAddress"
                    render={({ field }) => (
                      <FormItem className="ml-4">
                        <FormLabel className="text-gray-300">Email Address</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="Enter your email address"
                            className="cyber-dark border-cyber-slate-light text-white focus:ring-cyber-blue"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-gray-400">
                          Email address for receiving incident notifications
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-6">
              <Button
                type="submit"
                disabled={saveSettingsMutation.isPending}
                className={`transition-colors font-medium ${
                  saveSuccess 
                    ? "bg-green-600 hover:bg-green-600" 
                    : "cyber-blue hover:bg-blue-600"
                } text-white`}
                onClick={() => {
                  console.log("Save button clicked");
                  console.log("Form errors:", form.formState.errors);
                  console.log("Form values:", form.getValues());
                }}
              >
                {saveSettingsMutation.isPending ? (
                  <>
                    <div className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : saveSuccess ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
