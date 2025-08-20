import { useQuery } from "@tanstack/react-query";
import { Shield, ChartLine, History, Settings, TriangleAlert, Clock, CheckCircle, Brain, LogOut, CreditCard, Webhook, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export default function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const { data: stats } = useQuery<any>({
    queryKey: ["/api/dashboard-stats"],
  });

  const { data: user } = useQuery<any>({
    queryKey: ["/api/user"],
  });

  const menuItems = [
    {
      id: "incident-analysis",
      icon: ChartLine,
      label: "Incident Analysis",
      color: "text-cyber-blue",
    },
    {
      id: "incident-history", 
      icon: History,
      label: "Incident History",
      color: "text-gray-300",
    },
    {
      id: "threat-prediction",
      icon: Brain,
      label: "Threat Prediction",
      color: "text-purple-400",
    },
    {
      id: "settings",
      icon: Settings,
      label: "Settings", 
      color: "text-gray-300",
    },
  ];

  const externalPages = [
    {
      id: "advanced-query",
      icon: Search,
      label: "Advanced Query",
      path: "/advanced-query",
      color: "text-green-400",
    },
    {
      id: "api-settings",
      icon: Webhook,
      label: "API Settings",
      path: "/api-settings",
      color: "text-orange-400",
    },
    {
      id: "billing",
      icon: CreditCard,
      label: "Billing & Usage",
      path: "/billing",
      color: "text-yellow-400",
    },
  ];

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "??";
    return name
      .split(" ")
      .map(word => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="w-64 cyber-slate border-r border-cyber-slate-light flex flex-col">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-cyber-slate-light">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 cyber-blue rounded-lg flex items-center justify-center">
            <Shield className="text-white text-lg" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">CyberSight AI</h1>
            <p className="text-sm text-gray-400">Threat Intelligence Platform</p>
          </div>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Quick Metrics</h3>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => onViewChange("incident-history")}
            className="cyber-dark rounded-lg p-3 hover:bg-gray-700 transition-colors cursor-pointer group"
          >
            <div className="flex items-center space-x-2 mb-1">
              <TriangleAlert className="text-red-600 text-sm group-hover:text-red-500" />
              <span className="text-xs text-gray-400 group-hover:text-gray-300">Active Threats</span>
            </div>
            <div className="text-xl font-bold text-red-600 group-hover:text-red-500">
              {stats?.activeThreats || 0}
            </div>
          </button>
          <button 
            onClick={() => onViewChange("incident-history")}
            className="cyber-dark rounded-lg p-3 hover:bg-gray-700 transition-colors cursor-pointer group"
          >
            <div className="flex items-center space-x-2 mb-1">
              <Clock className="text-cyber-blue text-sm group-hover:text-blue-400" />
              <span className="text-xs text-gray-400 group-hover:text-gray-300">Today</span>
            </div>
            <div className="text-xl font-bold text-cyber-blue group-hover:text-blue-400">
              {stats?.todayIncidents || 0}
            </div>
          </button>
          <button 
            onClick={() => onViewChange("incident-history")}
            className="cyber-dark rounded-lg p-3 hover:bg-gray-700 transition-colors cursor-pointer group"
          >
            <div className="flex items-center space-x-2 mb-1">
              <CheckCircle className="text-green-500 text-sm group-hover:text-green-400" />
              <span className="text-xs text-gray-400 group-hover:text-gray-300">True Positives</span>
            </div>
            <div className="text-xl font-bold text-green-500 group-hover:text-green-400">
              {stats?.truePositives || 0}
            </div>
          </button>
          <button 
            onClick={() => onViewChange("incident-history")}
            className="cyber-dark rounded-lg p-3 hover:bg-gray-700 transition-colors cursor-pointer group"
          >
            <div className="flex items-center space-x-2 mb-1">
              <Brain className="text-cyber-purple text-sm group-hover:text-purple-400" />
              <span className="text-xs text-gray-400 group-hover:text-gray-300">Avg. Confidence</span>
            </div>
            <div className="text-xl font-bold text-cyber-purple group-hover:text-purple-400">
              {stats?.avgConfidence || 0}%
            </div>
          </button>
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">MENU</h3>
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  "w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
                  isActive
                    ? "cyber-blue text-white"
                    : "text-gray-300 hover:bg-cyber-slate-light"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
          
          {/* External Pages */}
          <div className="mt-4 pt-4 border-t border-cyber-slate-light">
            <h3 className="text-xs font-medium text-gray-400 mb-2 px-3">ADVANCED</h3>
            {externalPages.map((item) => {
              const Icon = item.icon;
              
              return (
                <Link key={item.id} to={item.path}>
                  <button className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-gray-300 hover:bg-cyber-slate-light">
                    <Icon className={cn("w-4 h-4", item.color)} />
                    <span>{item.label}</span>
                  </button>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* User Profile with dynamic login info */}
      <div className="p-4 border-t border-cyber-slate-light">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-8 h-8 cyber-purple rounded-full flex items-center justify-center text-sm font-semibold">
            <span>{user ? getInitials(`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email) : "??"}</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {user ? (`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User') : 'Unknown User'}
            </p>
            <p className="text-xs text-gray-400">Security Analyst</p>
            <div className="text-xs space-y-1">
              <p className="text-green-400">● {stats?.totalIncidents || 0} Incidents analysed in total</p>
            </div>
          </div>
        </div>
        <Button
          onClick={() => {
            window.location.href = '/api/logout';
          }}
          variant="outline"
          size="sm"
          className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
}
