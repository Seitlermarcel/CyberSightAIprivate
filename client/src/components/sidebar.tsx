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
    queryKey: ["/api/auth/user"],
  });

  const menuItems = [
    {
      id: "incident-analysis",
      icon: ChartLine,
      label: "Live Analysis",
      color: "text-cyan-400",
    },
    {
      id: "incident-history", 
      icon: History,
      label: "Investigation History",
      color: "text-green-400",
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
      label: "Defense Configuration", 
      color: "text-orange-400",
    },
  ];

  const externalPages = [
    {
      id: "advanced-query",
      icon: Search,
      label: "Hunting Console",
      path: "/advanced-query",
      color: "text-emerald-400",
    },
    {
      id: "api-settings",
      icon: Webhook,
      label: "SIEM Integration",
      path: "/api-settings",
      color: "text-blue-400",
    },
    {
      id: "billing",
      icon: CreditCard,
      label: "Credits & Billing",
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
    <div className="w-full lg:w-80 xl:w-96 bg-slate-800/70 backdrop-blur-sm border-b lg:border-b-0 lg:border-r border-slate-700/50 flex flex-col lg:min-h-screen">
      {/* Logo/Brand */}
      <div className="p-4 lg:p-6 border-b border-slate-700/50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
            <Shield className="text-blue-400 w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">CyberSight AI</h1>
            <p className="text-xs lg:text-sm text-gray-400">Threat Intelligence Platform</p>
          </div>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="p-4 lg:p-6">
        <h3 className="text-sm font-semibold bg-gradient-to-r from-gray-300 to-gray-400 bg-clip-text text-transparent mb-4">Quick Metrics</h3>
        <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-3">
          <button 
            onClick={() => onViewChange("incident-history")}
            className="p-3 bg-gradient-to-br from-red-500/10 to-red-600/10 rounded-xl border border-red-500/20 hover:border-red-500/40 transition-all duration-300 cursor-pointer group backdrop-blur-sm"
          >
            <div className="flex items-center space-x-2 mb-2">
              <div className="p-1 bg-red-500/20 rounded-lg">
                <TriangleAlert className="text-red-400 w-3 h-3 group-hover:text-red-300" />
              </div>
              <span className="text-xs text-gray-400 group-hover:text-gray-300 font-medium">Active Threats</span>
            </div>
            <div className="text-lg lg:text-xl font-bold text-red-400 group-hover:text-red-300">
              {stats?.activeThreats || 0}
            </div>
          </button>
          <button 
            onClick={() => onViewChange("incident-history")}
            className="p-3 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-xl border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 cursor-pointer group backdrop-blur-sm"
          >
            <div className="flex items-center space-x-2 mb-2">
              <div className="p-1 bg-blue-500/20 rounded-lg">
                <Clock className="text-blue-400 w-3 h-3 group-hover:text-blue-300" />
              </div>
              <span className="text-xs text-gray-400 group-hover:text-gray-300 font-medium">Today</span>
            </div>
            <div className="text-lg lg:text-xl font-bold text-blue-400 group-hover:text-blue-300">
              {stats?.todayIncidents || 0}
            </div>
          </button>
          <button 
            onClick={() => onViewChange("incident-history")}
            className="p-3 bg-gradient-to-br from-green-500/10 to-green-600/10 rounded-xl border border-green-500/20 hover:border-green-500/40 transition-all duration-300 cursor-pointer group backdrop-blur-sm"
          >
            <div className="flex items-center space-x-2 mb-2">
              <div className="p-1 bg-green-500/20 rounded-lg">
                <CheckCircle className="text-green-400 w-3 h-3 group-hover:text-green-300" />
              </div>
              <span className="text-xs text-gray-400 group-hover:text-gray-300 font-medium">True Positives</span>
            </div>
            <div className="text-lg lg:text-xl font-bold text-green-400 group-hover:text-green-300">
              {stats?.truePositives || 0}
            </div>
          </button>
          <button 
            onClick={() => onViewChange("incident-history")}
            className="p-3 bg-gradient-to-br from-purple-500/10 to-purple-600/10 rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 cursor-pointer group backdrop-blur-sm"
          >
            <div className="flex items-center space-x-2 mb-2">
              <div className="p-1 bg-purple-500/20 rounded-lg">
                <Brain className="text-purple-400 w-3 h-3 group-hover:text-purple-300" />
              </div>
              <span className="text-xs text-gray-400 group-hover:text-gray-300 font-medium">Avg. Confidence</span>
            </div>
            <div className="text-lg lg:text-xl font-bold text-purple-400 group-hover:text-purple-300">
              {stats?.avgConfidence || 0}%
            </div>
          </button>
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 p-4 lg:p-6">
        <h3 className="text-sm font-semibold bg-gradient-to-r from-gray-300 to-gray-400 bg-clip-text text-transparent mb-4">MENU</h3>
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  "w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300",
                  isActive
                    ? "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 border border-blue-500/30 backdrop-blur-sm"
                    : "text-gray-300 hover:bg-slate-700/50 hover:text-white"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
          
          {/* External Pages */}
          <div className="mt-6 pt-4 border-t border-slate-700/50">
            <h3 className="text-xs font-semibold bg-gradient-to-r from-gray-400 to-gray-500 bg-clip-text text-transparent mb-3 px-4">ADVANCED</h3>
            {externalPages.map((item) => {
              const Icon = item.icon;
              
              return (
                <Link key={item.id} to={item.path}>
                  <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 text-gray-300 hover:bg-slate-700/50 hover:text-white">
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
      <div className="p-4 lg:p-6 border-t border-slate-700/50">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center text-sm font-semibold border border-purple-500/30">
            <span className="text-purple-300">{user ? getInitials(`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email) : "??"}</span>
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
          className="w-full border-slate-600 text-gray-300 hover:bg-slate-700 hover:text-white transition-all duration-300 rounded-lg"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
}
