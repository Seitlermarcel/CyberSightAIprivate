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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="flex flex-col lg:flex-row">
        <Sidebar currentView={currentView} onViewChange={(view) => setCurrentView(view as View)} />
        <div className="flex-1 min-h-screen lg:min-h-0">
          <div className="p-4 lg:p-6 xl:p-8">
            {renderView()}
          </div>
        </div>
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
    <div className="w-full">
      <div className="max-w-7xl mx-auto">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl blur-xl"></div>
          <div className="relative p-6 bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-700/50">
            <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
              🔮 Predictive Threat Intelligence
            </h1>
            <p className="text-slate-300 text-lg">Advanced AI models analyze patterns to predict and prevent future cyber attacks before they occur.</p>
            <p className="text-gray-400 text-sm lg:text-base">
              Advanced machine learning algorithms analyze your security incidents to predict future threats and provide actionable intelligence.
            </p>
          </div>
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
