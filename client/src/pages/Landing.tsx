import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Zap, Database, Bot } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-4xl mx-auto text-center">
        <div className="mb-12">
          <Shield className="h-16 w-16 mx-auto mb-6 text-purple-400" />
          <h1 className="text-5xl font-bold text-white mb-4">
            CyberSight AI
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Advanced cybersecurity incident analysis platform powered by AI
          </p>
          <Button 
            onClick={() => window.location.href = '/api/login'}
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 text-lg"
          >
            Sign In with Replit
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <Bot className="h-8 w-8 text-purple-400 mb-2" />
              <CardTitle className="text-white">AI-Powered Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-gray-300">
                Multi-AI analysis system with tactical, strategic, and chief analyst roles
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <Zap className="h-8 w-8 text-purple-400 mb-2" />
              <CardTitle className="text-white">Real-time Detection</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-gray-300">
                Immediate threat classification with confidence scoring and MITRE ATT&CK mapping
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <Database className="h-8 w-8 text-purple-400 mb-2" />
              <CardTitle className="text-white">Threat Intelligence</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-gray-300">
                Comprehensive threat analysis with pattern recognition and prediction
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}