import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Activity, AlertTriangle, Shield, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";

export default function RiskVisualizer() {
  const [selectedTimeframe, setSelectedTimeframe] = useState("24h");
  const [animatedRiskScore, setAnimatedRiskScore] = useState(0);

  const { data: riskData } = useQuery({
    queryKey: ["/api/risk-progression", selectedTimeframe],
    refetchInterval: 10000, // Update every 10 seconds
  });

  useEffect(() => {
    if (riskData?.currentRiskScore) {
      // Animate risk score
      const targetScore = riskData.currentRiskScore;
      const increment = targetScore / 50;
      let current = 0;
      const timer = setInterval(() => {
        current += increment;
        if (current >= targetScore) {
          setAnimatedRiskScore(targetScore);
          clearInterval(timer);
        } else {
          setAnimatedRiskScore(Math.round(current));
        }
      }, 20);
      return () => clearInterval(timer);
    }
  }, [riskData?.currentRiskScore]);

  // Sample data for charts
  const timeSeriesData = [
    { time: "00:00", risk: 45, incidents: 12, threats: 8 },
    { time: "04:00", risk: 52, incidents: 15, threats: 11 },
    { time: "08:00", risk: 68, incidents: 23, threats: 18 },
    { time: "12:00", risk: 75, incidents: 28, threats: 22 },
    { time: "16:00", risk: 82, incidents: 34, threats: 28 },
    { time: "20:00", risk: 71, incidents: 29, threats: 23 },
    { time: "24:00", risk: 63, incidents: 24, threats: 19 },
  ];

  const categoryRiskData = [
    { category: "Network", current: 78, previous: 65, trend: "up" },
    { category: "Application", current: 62, previous: 70, trend: "down" },
    { category: "Data", current: 85, previous: 72, trend: "up" },
    { category: "Identity", current: 55, previous: 58, trend: "down" },
    { category: "Cloud", current: 71, previous: 68, trend: "up" },
  ];

  const radarData = [
    { subject: "Malware", A: 85, fullMark: 100 },
    { subject: "Phishing", A: 72, fullMark: 100 },
    { subject: "DDoS", A: 56, fullMark: 100 },
    { subject: "Insider", A: 68, fullMark: 100 },
    { subject: "Ransomware", A: 91, fullMark: 100 },
    { subject: "Zero-Day", A: 43, fullMark: 100 },
  ];

  const getRiskColor = (score: number) => {
    if (score >= 80) return "text-red-500";
    if (score >= 60) return "text-orange-500";
    if (score >= 40) return "text-yellow-500";
    if (score >= 20) return "text-blue-500";
    return "text-green-500";
  };

  const getRiskLevel = (score: number) => {
    if (score >= 80) return "CRITICAL";
    if (score >= 60) return "HIGH";
    if (score >= 40) return "MEDIUM";
    if (score >= 20) return "LOW";
    return "MINIMAL";
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="cyber-slate border-b border-cyber-slate-light p-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center">
            <TrendingUp className="text-white text-xl" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-red-400">Security Risk Progression</h2>
            <p className="text-gray-400">Animated visualization of security risk evolution</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Current Risk Score */}
        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Overall Security Risk Score</span>
              <div className="flex space-x-2">
                {["24h", "7d", "30d"].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setSelectedTimeframe(tf)}
                    className={`px-3 py-1 rounded text-sm ${
                      selectedTimeframe === tf
                        ? "bg-cyber-blue text-white"
                        : "cyber-dark text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <motion.div
                className="text-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className={`text-7xl font-bold ${getRiskColor(animatedRiskScore)}`}>
                  {animatedRiskScore}
                </div>
                <Badge className={`mt-2 ${animatedRiskScore >= 60 ? "bg-red-500" : "bg-orange-500"}`}>
                  {getRiskLevel(animatedRiskScore)} RISK
                </Badge>
              </motion.div>

              {/* Animated circular progress */}
              <svg className="absolute inset-0 w-full h-full -z-10" viewBox="0 0 200 200">
                <motion.circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  className="text-gray-700"
                />
                <motion.circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  className={getRiskColor(animatedRiskScore)}
                  strokeDasharray={`${(animatedRiskScore / 100) * 502} 502`}
                  strokeLinecap="round"
                  transform="rotate(-90 100 100)"
                  initial={{ strokeDasharray: "0 502" }}
                  animate={{ strokeDasharray: `${(animatedRiskScore / 100) * 502} 502` }}
                  transition={{ duration: 2, ease: "easeOut" }}
                />
              </svg>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="cyber-dark rounded-lg p-3 text-center">
                <TrendingUp className="h-6 w-6 text-red-500 mx-auto mb-1" />
                <p className="text-xs text-gray-400">24h Change</p>
                <p className="text-lg font-bold text-red-400">+12%</p>
              </div>
              <div className="cyber-dark rounded-lg p-3 text-center">
                <Activity className="h-6 w-6 text-orange-500 mx-auto mb-1" />
                <p className="text-xs text-gray-400">Active Threats</p>
                <p className="text-lg font-bold">47</p>
              </div>
              <div className="cyber-dark rounded-lg p-3 text-center">
                <Shield className="h-6 w-6 text-green-500 mx-auto mb-1" />
                <p className="text-xs text-gray-400">Mitigated</p>
                <p className="text-lg font-bold text-green-400">89%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Progression Chart */}
        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle>Risk Progression Timeline</CardTitle>
            <CardDescription className="text-gray-400">
              Security risk evolution over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={timeSeriesData}>
                <defs>
                  <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Area
                  type="monotone"
                  dataKey="risk"
                  stroke="#ef4444"
                  fill="url(#riskGradient)"
                  strokeWidth={2}
                  animationDuration={2000}
                />
                <Line
                  type="monotone"
                  dataKey="incidents"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Risk Analysis */}
        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle>Risk by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryRiskData.map((category, index) => (
                <motion.div
                  key={category.category}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="cyber-dark rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium">{category.category}</span>
                      {category.trend === "up" ? (
                        <TrendingUp className="h-4 w-4 text-red-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-400">
                        {category.previous}% → {category.current}%
                      </span>
                      <Badge className={category.current >= 70 ? "bg-red-500" : "bg-orange-500"}>
                        {category.current}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={category.current} className="h-2" />
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Threat Radar */}
        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle>Threat Vector Analysis</CardTitle>
            <CardDescription className="text-gray-400">
              Current threat landscape visualization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="subject" stroke="#9ca3af" />
                <PolarRadiusAxis stroke="#9ca3af" />
                <Radar
                  name="Threat Level"
                  dataKey="A"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.4}
                  animationDuration={2000}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Risk Indicators */}
        <Card className="cyber-slate border-cyber-slate-light">
          <CardHeader>
            <CardTitle>Key Risk Indicators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <motion.div
                className="cyber-dark rounded-lg p-4"
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <Badge className="bg-yellow-500">ELEVATED</Badge>
                </div>
                <p className="text-sm text-gray-400 mb-1">Vulnerability Exposure</p>
                <p className="text-2xl font-bold">142</p>
                <p className="text-xs text-gray-500">Unpatched systems</p>
              </motion.div>

              <motion.div
                className="cyber-dark rounded-lg p-4"
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <Activity className="h-5 w-5 text-red-500" />
                  <Badge className="bg-red-500">HIGH</Badge>
                </div>
                <p className="text-sm text-gray-400 mb-1">Attack Surface</p>
                <p className="text-2xl font-bold">89%</p>
                <p className="text-xs text-gray-500">External exposure</p>
              </motion.div>

              <motion.div
                className="cyber-dark rounded-lg p-4"
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <Shield className="h-5 w-5 text-green-500" />
                  <Badge className="bg-green-500">GOOD</Badge>
                </div>
                <p className="text-sm text-gray-400 mb-1">Security Posture</p>
                <p className="text-2xl font-bold">72%</p>
                <p className="text-xs text-gray-500">Compliance score</p>
              </motion.div>

              <motion.div
                className="cyber-dark rounded-lg p-4"
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                  <Badge className="bg-orange-500">RISING</Badge>
                </div>
                <p className="text-sm text-gray-400 mb-1">Threat Velocity</p>
                <p className="text-2xl font-bold">+24%</p>
                <p className="text-xs text-gray-500">Week over week</p>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}