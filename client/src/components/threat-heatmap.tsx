import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Map, AlertCircle, Globe, Activity, Shield, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";

interface ThreatLocation {
  country: string;
  city: string;
  lat: number;
  lng: number;
  threatLevel: number;
  incidents: number;
  type: string;
}

export default function ThreatHeatmap() {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [realTimeAlerts, setRealTimeAlerts] = useState<any[]>([]);

  const { data: heatmapData } = useQuery({
    queryKey: ["/api/threat-heatmap"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: alertsData } = useQuery({
    queryKey: ["/api/threat-alerts"],
    refetchInterval: 5000, // Refresh every 5 seconds for real-time feel
  });

  useEffect(() => {
    if (alertsData?.newAlerts) {
      setRealTimeAlerts(prev => [...alertsData.newAlerts, ...prev].slice(0, 10));
    }
  }, [alertsData]);

  const getThreatColor = (level: number) => {
    if (level >= 80) return "bg-red-500";
    if (level >= 60) return "bg-orange-500";
    if (level >= 40) return "bg-yellow-500";
    if (level >= 20) return "bg-blue-500";
    return "bg-green-500";
  };

  const worldRegions = [
    { id: "na", name: "North America", x: "15%", y: "35%", threatLevel: 72, incidents: 234 },
    { id: "sa", name: "South America", x: "25%", y: "65%", threatLevel: 45, incidents: 89 },
    { id: "eu", name: "Europe", x: "50%", y: "30%", threatLevel: 68, incidents: 312 },
    { id: "af", name: "Africa", x: "50%", y: "55%", threatLevel: 38, incidents: 67 },
    { id: "as", name: "Asia", x: "75%", y: "40%", threatLevel: 85, incidents: 456 },
    { id: "oc", name: "Oceania", x: "85%", y: "70%", threatLevel: 25, incidents: 34 },
  ];

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="cyber-slate border-b border-cyber-slate-light p-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
            <Map className="text-white text-xl" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-orange-400">Threat Intelligence Heatmap</h2>
            <p className="text-gray-400">Real-time global threat visualization and alerts</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Real-time Alerts */}
        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="text-red-500 animate-pulse" />
                <span>Real-time Threat Alerts</span>
              </div>
              <Badge className="bg-red-500 animate-pulse">LIVE</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {realTimeAlerts.length > 0 ? (
                realTimeAlerts.map((alert, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center justify-between p-2 cyber-dark rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${getThreatColor(alert?.severity || 50)} animate-pulse`} />
                      <div>
                        <p className="text-sm font-medium">{alert?.location || "Unknown Location"} - {alert?.type || "Security Alert"}</p>
                        <p className="text-xs text-gray-400">{new Date().toLocaleTimeString()}</p>
                      </div>
                    </div>
                    <Badge className={getThreatColor(alert?.severity || 50)}>
                      {alert?.severity || 50}%
                    </Badge>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-4 text-gray-400">
                  <Activity className="h-8 w-8 mx-auto mb-2 animate-pulse" />
                  <p className="text-sm">Monitoring for threats...</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Interactive World Map */}
        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Globe className="text-cyber-blue" />
              <span>Global Threat Distribution</span>
            </CardTitle>
            <CardDescription className="text-gray-400">
              Click on a region to view detailed threat intelligence
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative w-full h-96 cyber-dark rounded-lg overflow-hidden">
              {/* Simplified World Map Visualization */}
              <div className="relative w-full h-full">
                {/* Background grid effect */}
                <div className="absolute inset-0 opacity-20">
                  <div className="grid grid-cols-12 grid-rows-8 h-full">
                    {[...Array(96)].map((_, i) => (
                      <div key={i} className="border border-cyber-slate-light"></div>
                    ))}
                  </div>
                </div>

                {/* Interactive Regions */}
                {worldRegions.map((region) => (
                  <motion.div
                    key={region.id}
                    className="absolute cursor-pointer"
                    style={{ left: region.x, top: region.y, transform: 'translate(-50%, -50%)' }}
                    whileHover={{ scale: 1.1 }}
                    onClick={() => setSelectedRegion(region.id)}
                  >
                    <div className="relative">
                      <motion.div
                        className={`w-16 h-16 rounded-full ${getThreatColor(region.threatLevel)} opacity-40`}
                        animate={{
                          scale: [1, 1.2, 1],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          repeatType: "loop",
                        }}
                      />
                      <div className={`absolute inset-0 w-16 h-16 rounded-full ${getThreatColor(region.threatLevel)} opacity-60 flex items-center justify-center`}>
                        <div className="text-center">
                          <p className="text-xs font-bold text-white">{region.threatLevel}%</p>
                          <p className="text-xs text-white">{region.incidents}</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-300 mt-2 text-center whitespace-nowrap">{region.name}</p>
                  </motion.div>
                ))}
              </div>

              {/* Legend */}
              <div className="absolute bottom-4 left-4 cyber-dark p-3 rounded-lg border border-cyber-slate-light">
                <p className="text-xs text-gray-400 mb-2">Threat Levels</p>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-xs text-gray-300">Critical (80-100%)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span className="text-xs text-gray-300">High (60-79%)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="text-xs text-gray-300">Medium (40-59%)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-xs text-gray-300">Low (20-39%)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-300">Minimal (0-19%)</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Regional Details */}
        {selectedRegion && (
          <Card className="cyber-slate border-cyber-slate-light">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="text-cyber-purple" />
                <span>Regional Threat Details - {worldRegions.find(r => r.id === selectedRegion)?.name}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="cyber-dark rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-2">Active Threats</p>
                  <p className="text-2xl font-bold text-red-400">
                    {worldRegions.find(r => r.id === selectedRegion)?.incidents || 0}
                  </p>
                  <Progress 
                    value={worldRegions.find(r => r.id === selectedRegion)?.threatLevel || 0} 
                    className="mt-2 h-2"
                  />
                </div>
                <div className="cyber-dark rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-2">Threat Level</p>
                  <p className="text-2xl font-bold">
                    {worldRegions.find(r => r.id === selectedRegion)?.threatLevel || 0}%
                  </p>
                  <Badge className={getThreatColor(worldRegions.find(r => r.id === selectedRegion)?.threatLevel || 0)}>
                    {worldRegions.find(r => r.id === selectedRegion)?.threatLevel >= 60 ? "HIGH RISK" : "MODERATE"}
                  </Badge>
                </div>
                <div className="cyber-dark rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-2">Top Threat Type</p>
                  <p className="text-lg font-bold">Malware</p>
                  <p className="text-xs text-gray-500 mt-1">42% of incidents</p>
                </div>
              </div>

              <div className="mt-4 cyber-dark rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Recent Incidents</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">DDoS Attack - Banking Sector</span>
                    <Badge className="bg-red-500">Critical</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Ransomware - Healthcare</span>
                    <Badge className="bg-orange-500">High</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Phishing Campaign - Government</span>
                    <Badge className="bg-yellow-500">Medium</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Global Statistics */}
        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle>Global Threat Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="cyber-dark rounded-lg p-4 text-center">
                <Activity className="h-8 w-8 text-red-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{heatmapData?.totalThreats || 1847}</p>
                <p className="text-xs text-gray-400">Active Threats</p>
              </div>
              <div className="cyber-dark rounded-lg p-4 text-center">
                <Globe className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{heatmapData?.countriesAffected || 67}</p>
                <p className="text-xs text-gray-400">Countries Affected</p>
              </div>
              <div className="cyber-dark rounded-lg p-4 text-center">
                <Shield className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{heatmapData?.threatsBlocked || 892}</p>
                <p className="text-xs text-gray-400">Threats Blocked</p>
              </div>
              <div className="cyber-dark rounded-lg p-4 text-center">
                <AlertCircle className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{heatmapData?.avgResponseTime || "2.3"}s</p>
                <p className="text-xs text-gray-400">Avg Response Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}