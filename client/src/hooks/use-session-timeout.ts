import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

export function useSessionTimeout(timeoutMinutes: number) {
  const { toast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const resetTimers = () => {
      // Clear existing timers
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);

      const timeoutMs = timeoutMinutes * 60 * 1000;
      const warningMs = Math.max(timeoutMs - 60000, 0); // Warn 1 minute before timeout

      // Set warning timer (1 minute before timeout)
      if (timeoutMs > 60000) {
        warningRef.current = setTimeout(() => {
          toast({
            title: "Session Expiring Soon",
            description: "Your session will expire in 1 minute. Please save your work.",
            variant: "destructive",
          });
        }, warningMs);
      }

      // Set timeout timer
      timeoutRef.current = setTimeout(() => {
        toast({
          title: "Session Expired",
          description: "Your session has expired. Refreshing page...",
          variant: "destructive",
        });
        
        // Clear session and reload after 2 seconds
        setTimeout(() => {
          localStorage.clear();
          sessionStorage.clear();
          window.location.reload();
        }, 2000);
      }, timeoutMs);
    };

    // Set up activity listeners to reset timeout on user activity
    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart"];
    
    const handleActivity = () => {
      resetTimers();
    };

    // Initial setup
    resetTimers();

    // Add event listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    return () => {
      // Cleanup
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [timeoutMinutes, toast]);
}