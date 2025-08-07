import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import IncidentAnalysis from "@/components/incident-analysis";
import IncidentHistory from "@/components/incident-history";
import Settings from "@/components/settings";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { useTheme } from "@/hooks/use-theme";

type View = "incident-analysis" | "incident-history" | "settings";

export default function Dashboard() {
  const [currentView, setCurrentView] = useState<View>("incident-analysis");

  // Get user settings for auto-refresh and other features
  const { data: user } = useQuery({ queryKey: ["/api/user"] });
  const { data: settings } = useQuery({
    queryKey: ["/api/settings", user?.id],
    enabled: !!user?.id,
  });

  // Auto-refresh functionality
  useAutoRefresh(settings?.autoRefresh || false);

  // Theme management
  useTheme();

  const renderView = () => {
    switch (currentView) {
      case "incident-analysis":
        return <IncidentAnalysis compactView={settings?.compactView || false} />;
      case "incident-history":
        return <IncidentHistory compactView={settings?.compactView || false} />;
      case "settings":
        return <Settings />;
      default:
        return <IncidentAnalysis compactView={settings?.compactView || false} />;
    }
  };

  return (
    <div className="flex h-screen bg-cyber-dark text-white">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <div className="flex-1 overflow-hidden">
        {renderView()}
      </div>
    </div>
  );
}
