import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Shield, 
  AlertTriangle,
  Zap,
  Brain,
  Target,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThreatPredictionData {
  overallThreatLevel: number;
  confidence: number;
  riskTrend: 'increasing' | 'stable' | 'decreasing';
  predictions: {
    category: string;
    likelihood: number;
    timeframe: string;
    description: string;
    impact: 'low' | 'medium' | 'high' | 'critical';
  }[];
  factors: {
    name: string;
    weight: number;
    contribution: number;
    trend: 'up' | 'down' | 'stable';
  }[];
  recommendations: string[];
  lastUpdated: string;
}

interface ThreatPredictionMeterProps {
  data?: ThreatPredictionData;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function ThreatPredictionMeter({ 
  data, 
  onRefresh, 
  isLoading = false 
}: ThreatPredictionMeterProps) {
  const [animationProgress, setAnimationProgress] = useState(0);

  useEffect(() => {
    if (data) {
      const timer = setTimeout(() => {
        setAnimationProgress(data.overallThreatLevel);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [data]);

  const getThreatLevelColor = (level: number) => {
    if (level >= 85) return 'text-red-500';
    if (level >= 70) return 'text-orange-500';
    if (level >= 50) return 'text-yellow-500';
    if (level >= 30) return 'text-blue-500';
    return 'text-green-500';
  };

  const getThreatLevelBg = (level: number) => {
    if (level >= 85) return 'bg-red-500/20';
    if (level >= 70) return 'bg-orange-500/20';
    if (level >= 50) return 'bg-yellow-500/20';
    if (level >= 30) return 'bg-blue-500/20';
    return 'bg-green-500/20';
  };

  const getThreatLevelLabel = (level: number) => {
    if (level >= 85) return 'CRITICAL';
    if (level >= 70) return 'HIGH';
    if (level >= 50) return 'MEDIUM';
    if (level >= 30) return 'LOW';
    return 'MINIMAL';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'decreasing': return <TrendingDown className="h-4 w-4 text-green-500" />;
      default: return <Minus className="h-4 w-4 text-blue-500" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  if (!data) {
    return (
      <Card className="border-cyber-blue/20 bg-background/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            AI Threat Prediction
          </CardTitle>
          <Brain className="h-4 w-4 text-cyber-blue" />
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No prediction data available</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRefresh}
              disabled={isLoading}
              className="mt-4"
            >
              {isLoading ? 'Loading...' : 'Generate Prediction'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Threat Level Meter */}
      <Card className="border-cyber-blue/20 bg-background/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            AI Threat Prediction Confidence
          </CardTitle>
          <div className="flex items-center gap-2">
            {getTrendIcon(data.riskTrend)}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onRefresh}
              disabled={isLoading}
              className="h-8 w-8 p-0"
            >
              <Activity className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Threat Level Circle */}
            <div className="relative">
              <div className={cn(
                "mx-auto w-32 h-32 rounded-full flex items-center justify-center border-4 transition-all duration-1000",
                getThreatLevelBg(data.overallThreatLevel),
                `border-current ${getThreatLevelColor(data.overallThreatLevel)}`
              )}>
                <div className="text-center">
                  <div className={cn("text-3xl font-bold", getThreatLevelColor(data.overallThreatLevel))}>
                    {Math.round(animationProgress)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getThreatLevelLabel(data.overallThreatLevel)}
                  </div>
                </div>
              </div>
            </div>

            {/* Confidence Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Prediction Confidence</span>
                <span className="font-medium">{data.confidence}%</span>
              </div>
              <Progress value={data.confidence} className="h-2" />
            </div>

            {/* Risk Trend Badge */}
            <div className="flex items-center justify-center">
              <Badge variant="outline" className="flex items-center gap-1">
                {getTrendIcon(data.riskTrend)}
                Risk Trend: {data.riskTrend.toUpperCase()}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Threat Predictions */}
      <Card className="border-cyber-blue/20 bg-background/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" />
            Predicted Threats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(data.predictions || []).map((prediction, index) => (
              <div key={index} className="border border-border/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{prediction.category}</span>
                  <Badge className={getImpactColor(prediction.impact)}>
                    {prediction.impact.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Likelihood: {prediction.likelihood}%</span>
                  <span>{prediction.timeframe}</span>
                </div>
                <p className="text-xs text-muted-foreground">{prediction.description}</p>
                <Progress value={prediction.likelihood} className="h-1" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contributing Factors */}
      <Card className="border-cyber-blue/20 bg-background/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Contributing Factors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(data.factors || []).map((factor, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {factor.trend === 'up' && <TrendingUp className="h-3 w-3 text-red-500" />}
                    {factor.trend === 'down' && <TrendingDown className="h-3 w-3 text-green-500" />}
                    {factor.trend === 'stable' && <Minus className="h-3 w-3 text-blue-500" />}
                    {factor.name}
                  </span>
                  <span className="font-medium">{factor.contribution}%</span>
                </div>
                <Progress value={factor.contribution} className="h-1" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Recommendations */}
      <Card className="border-cyber-blue/20 bg-background/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(data.recommendations || []).map((recommendation, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">{recommendation}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-muted-foreground text-center">
            Last updated: {new Date(data.lastUpdated).toLocaleString()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}