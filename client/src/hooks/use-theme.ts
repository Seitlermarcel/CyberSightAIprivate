import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

export function useTheme() {
  const { data: user } = useQuery<{ id: string }>({ queryKey: ["/api/user"] });
  const { data: settings } = useQuery<{ theme?: string }>({
    queryKey: ["/api/settings", user?.id || "default-user"],
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (settings?.theme) {
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      
      if (settings.theme === "light") {
        root.classList.add("light");
      }
      // Dark theme is default, no class needed
    }
  }, [settings?.theme]);

  return settings?.theme || "dark";
}