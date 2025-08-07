import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useAutoRefresh(enabled: boolean, interval: number = 30000) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    // Initial refetch
    queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });

    // Set up interval for auto-refresh (every 30 seconds by default)
    const refreshInterval = setInterval(() => {
      console.log("Auto-refreshing incidents...");
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
    }, interval);

    return () => clearInterval(refreshInterval);
  }, [enabled, interval, queryClient]);
}