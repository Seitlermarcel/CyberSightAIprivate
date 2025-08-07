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
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function Settings() {
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = "default-user"; // In a real app, this would come from auth context

  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/settings", userId],
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
    },
  });

  // Update form when settings are loaded
  React.useEffect(() => {
    if (settings) {
      form.reset(settings);
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
    saveSettingsMutation.mutate(data);
  };

  if (isLoading) {
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
                <h3 className="text-lg font-semibold">AI Analysis Configuration</h3>
              </div>

              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="analysisDepth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Analysis Depth</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="cyber-dark border-cyber-slate-light text-white focus:ring-cyber-blue">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="cyber-dark border-cyber-slate-light">
                          <SelectItem value="comprehensive">Comprehensive - Deep analysis</SelectItem>
                          <SelectItem value="standard">Standard - Balanced analysis</SelectItem>
                          <SelectItem value="quick">Quick - Fast analysis</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-6 space-y-4">
                <FormField
                  control={form.control}
                  name="enableDualAI"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-cyber-slate-light p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-medium">Enable Dual AI Analysis</FormLabel>
                        <FormDescription className="text-gray-400">
                          Use two different AI analysts for enhanced accuracy
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
                  name="autoSeverityAdjustment"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-cyber-slate-light p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-medium">Auto Severity Adjustment</FormLabel>
                        <FormDescription className="text-gray-400">
                          Allow AI to automatically adjust severity based on analysis
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="customInstructions"
                render={({ field }) => (
                  <FormItem className="mt-6">
                    <FormLabel className="text-gray-300">Custom Analysis Instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter any specific instructions for the AI analysis (e.g., focus on specific attack vectors, compliance requirements, etc.)"
                        className="cyber-dark border-cyber-slate-light text-white placeholder-gray-500 focus:ring-cyber-blue resize-none"
                        rows={3}
                        value={field.value || ""}
                        onChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* User Interface */}
            <div className="cyber-slate rounded-xl p-6">
              <div className="flex items-center space-x-2 mb-6">
                <Monitor className="text-cyber-cyan" />
                <h3 className="text-lg font-semibold">User Interface</h3>
              </div>

              <div className="grid grid-cols-2 gap-6">
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
                          <SelectItem value="dark">Dark Theme</SelectItem>
                          <SelectItem value="light">Light Theme</SelectItem>
                          <SelectItem value="auto">Auto (System)</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="sessionTimeout"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Session Timeout (minutes)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="30"
                          max="1440"
                          className="cyber-dark border-cyber-slate-light text-white focus:ring-cyber-cyan"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-6 space-y-4">
                <FormField
                  control={form.control}
                  name="compactView"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-cyber-slate-light p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-medium">Compact View</FormLabel>
                        <FormDescription className="text-gray-400">
                          Show more information in less space
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
                  name="autoRefresh"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-cyber-slate-light p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-medium">Auto-refresh Incidents</FormLabel>
                        <FormDescription className="text-gray-400">
                          Automatically refresh incident list every 30 seconds
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
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
                
                <FormField
                  control={form.control}
                  name="highSeverityAlerts"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-cyber-slate-light p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-medium">High Severity Alerts</FormLabel>
                        <FormDescription className="text-gray-400">
                          Immediate notifications for critical and high severity incidents
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
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
              >
                {saveSuccess ? (
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
