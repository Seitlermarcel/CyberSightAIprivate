import { useState } from "react";
import Sidebar from "@/components/sidebar";
import IncidentAnalysis from "@/components/incident-analysis";
import IncidentHistory from "@/components/incident-history";
import Settings from "@/components/settings";

type View = "incident-analysis" | "incident-history" | "settings";

export default function Dashboard() {
  const [currentView, setCurrentView] = useState<View>("incident-analysis");

  const renderView = () => {
    switch (currentView) {
      case "incident-analysis":
        return <IncidentAnalysis />;
      case "incident-history":
        return <IncidentHistory />;
      case "settings":
        return <Settings />;
      default:
        return <IncidentAnalysis />;
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
