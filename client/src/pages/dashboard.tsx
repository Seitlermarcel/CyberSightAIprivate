import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import IncidentAnalysis from "@/components/incident-analysis";
import IncidentHistory from "@/components/incident-history";
import Settings from "@/components/settings";
import { ThreatPredictionMeter } from "@/components/threat-prediction-meter";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { useSessionTimeout } from "@/hooks/use-session-timeout";
import { useTheme } from "@/hooks/use-theme";

type View = "incident-analysis" | "incident-history" | "settings" | "threat-prediction";

export default function Dashboard() {
  const [currentView, setCurrentView] = useState<View>("incident-analysis");

  // Get user settings for auto-refresh and other features
  const { data: user } = useQuery<any>({ queryKey: ["/api/user"] });
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings", user?.id || "default-user"],
    enabled: !!user,
  });

  // Auto-refresh functionality (every 30 seconds when enabled)
  useAutoRefresh(settings?.autoRefresh || false, 30000);

  // Session timeout functionality
  useSessionTimeout(settings?.sessionTimeout || 480);

  // Theme management
  useTheme();

  const renderView = () => {
    switch (currentView) {
      case "incident-analysis":
        return <IncidentAnalysis 
          compactView={settings?.compactView || false}
          requireComments={settings?.requireComments || false}
        />;
      case "incident-history":
        return <IncidentHistory 
          compactView={settings?.compactView || false}
          requireComments={settings?.requireComments || false}
        />;
      case "threat-prediction":
        return <ThreatPredictionView />;
      case "settings":
        return <Settings />;
      default:
        return <IncidentAnalysis 
          compactView={settings?.compactView || false}
          requireComments={settings?.requireComments || false}
        />;
    }
  };

  return (
    <div className="flex h-screen bg-cyber-dark text-white">
      <Sidebar currentView={currentView} onViewChange={(view) => setCurrentView(view as View)} />
      <div className="flex-1 overflow-hidden">
        {renderView()}
      </div>
    </div>
  );
}

function ThreatPredictionView() {
  const { data: threatPrediction, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/threat-prediction"],
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  return (
    <div className="h-full p-6 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-cyber-blue mb-2">
            AI-Powered Threat Prediction
          </h1>
          <p className="text-muted-foreground">
            Advanced machine learning algorithms analyze your security incidents to predict future threats and provide actionable intelligence.
          </p>
        </div>
        
        <ThreatPredictionMeter 
          data={threatPrediction} 
          onRefresh={() => refetch()}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
