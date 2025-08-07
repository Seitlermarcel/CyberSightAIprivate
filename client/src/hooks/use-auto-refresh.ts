import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useAutoRefresh(enabled: boolean, intervalMs = 30000) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      // Refresh incidents and dashboard stats
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [enabled, intervalMs, queryClient]);
}