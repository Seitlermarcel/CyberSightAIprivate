import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Settings, InsertSettings } from '@shared/schema';

/**
 * Custom hook for managing persistent user preferences
 */
export function useUserPreferences(userId: string) {
  const queryClient = useQueryClient();

  // Query for current user settings
  const {
    data: preferences,
    isLoading,
    error,
    refetch
  } = useQuery<Settings>({
    queryKey: ['/api/settings', userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });

  // Mutation for updating user preferences
  const updatePreferences = useMutation({
    mutationFn: async (updates: Partial<InsertSettings>) => {
      console.log('Updating preferences:', updates);
      return apiRequest(`/api/settings/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (updatedSettings) => {
      // Update the cache with the new settings
      queryClient.setQueryData(['/api/settings', userId], updatedSettings);
      
      // Also invalidate related queries that might depend on settings
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      
      console.log('Preferences updated successfully:', updatedSettings);
    },
    onError: (error) => {
      console.error('Failed to update preferences:', error);
      
      // Optionally refetch to ensure we have the latest data
      refetch();
    },
  });

  // Helper function to update a single preference
  const updateSinglePreference = <K extends keyof InsertSettings>(
    key: K,
    value: InsertSettings[K]
  ) => {
    return updatePreferences.mutateAsync({ [key]: value } as Partial<InsertSettings>);
  };

  // Helper function to reset preferences to defaults
  const resetPreferences = () => {
    const defaultPreferences: Partial<InsertSettings> = {
      analysisDepth: 'comprehensive',
      enableDualAI: true,
      autoSeverityAdjustment: false,
      customInstructions: '',
      theme: 'dark',
      sessionTimeout: 480,
      compactView: false,
      autoRefresh: false,
      requireComments: false,
      emailNotifications: false,
      emailAddress: null,
      highSeverityAlerts: false,
    };
    
    return updatePreferences.mutateAsync(defaultPreferences);
  };

  // Helper function to toggle boolean preferences
  const togglePreference = (key: keyof Pick<Settings, 'enableDualAI' | 'autoSeverityAdjustment' | 'compactView' | 'autoRefresh' | 'requireComments' | 'emailNotifications' | 'highSeverityAlerts'>) => {
    const currentValue = preferences?.[key] || false;
    return updateSinglePreference(key, !currentValue);
  };

  // Helper function for bulk updates
  const updateMultiplePreferences = (updates: Partial<InsertSettings>) => {
    return updatePreferences.mutateAsync(updates);
  };

  return {
    // Data
    preferences,
    isLoading,
    error,
    
    // State
    isUpdating: updatePreferences.isPending,
    updateError: updatePreferences.error,
    
    // Actions
    updatePreferences: updatePreferences.mutateAsync,
    updateSinglePreference,
    updateMultiplePreferences,
    togglePreference,
    resetPreferences,
    refetch,
    
    // Utility functions for common preference operations
    utils: {
      isEmailConfigured: () => !!(preferences?.emailNotifications && preferences?.emailAddress),
      isDarkMode: () => preferences?.theme === 'dark',
      isCompactView: () => preferences?.compactView || false,
      getSessionTimeout: () => preferences?.sessionTimeout || 480,
      getAnalysisDepth: () => preferences?.analysisDepth || 'comprehensive',
    }
  };
}

/**
 * Hook for managing theme preferences specifically
 */
export function useThemePreference(userId: string) {
  const { preferences, updateSinglePreference, isUpdating } = useUserPreferences(userId);
  
  const setTheme = (theme: 'light' | 'dark') => {
    return updateSinglePreference('theme', theme);
  };
  
  const toggleTheme = () => {
    const currentTheme = preferences?.theme || 'dark';
    return setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  };
  
  return {
    currentTheme: preferences?.theme || 'dark',
    setTheme,
    toggleTheme,
    isUpdating,
  };
}

/**
 * Hook for managing email notification preferences
 */
export function useEmailPreferences(userId: string) {
  const { preferences, updateMultiplePreferences, isUpdating } = useUserPreferences(userId);
  
  const configureEmail = (emailAddress: string, enableNotifications = true, enableHighSeverityAlerts = false) => {
    return updateMultiplePreferences({
      emailAddress,
      emailNotifications: enableNotifications,
      highSeverityAlerts: enableHighSeverityAlerts,
    });
  };
  
  const disableEmailNotifications = () => {
    return updateMultiplePreferences({
      emailNotifications: false,
      highSeverityAlerts: false,
    });
  };
  
  return {
    emailAddress: preferences?.emailAddress,
    emailNotifications: preferences?.emailNotifications || false,
    highSeverityAlerts: preferences?.highSeverityAlerts || false,
    configureEmail,
    disableEmailNotifications,
    isUpdating,
  };
}

/**
 * Hook for managing analysis preferences
 */
export function useAnalysisPreferences(userId: string) {
  const { preferences, updateMultiplePreferences, togglePreference, isUpdating } = useUserPreferences(userId);
  
  const setAnalysisDepth = (depth: 'basic' | 'comprehensive' | 'advanced') => {
    return updateMultiplePreferences({ analysisDepth: depth });
  };
  
  const toggleDualAI = () => togglePreference('enableDualAI');
  const toggleAutoSeverityAdjustment = () => togglePreference('autoSeverityAdjustment');
  
  return {
    analysisDepth: preferences?.analysisDepth || 'comprehensive',
    enableDualAI: preferences?.enableDualAI ?? true,
    autoSeverityAdjustment: preferences?.autoSeverityAdjustment || false,
    customInstructions: preferences?.customInstructions || '',
    setAnalysisDepth,
    toggleDualAI,
    toggleAutoSeverityAdjustment,
    isUpdating,
  };
}