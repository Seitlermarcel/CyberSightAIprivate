import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, TrendingUp, Clock, Brain } from "lucide-react";
import type { Incident } from "@shared/schema";

interface CompactIncidentCardProps {
  incident: Incident;
  onClick: () => void;
}

export function CompactIncidentCard({ incident, onClick }: CompactIncidentCardProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-red-600 hover:bg-red-700';
      case 'high': return 'bg-orange-600 hover:bg-orange-700';
      case 'medium': return 'bg-yellow-600 hover:bg-yellow-700';
      case 'low': return 'bg-green-600 hover:bg-green-700';
      default: return 'bg-gray-600 hover:bg-gray-700';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'high':
        return <Shield className="w-3 h-3" />;
      case 'medium':
        return <TrendingUp className="w-3 h-3" />;
      case 'low':
      case 'informational':
        return <Clock className="w-3 h-3" />;
      default:
        return <Shield className="w-3 h-3" />;
    }
  };

  return (
    <div 
      onClick={onClick}
      className="cyber-slate rounded-lg p-3 hover:bg-cyber-slate-light transition-colors cursor-pointer border border-cyber-slate-light"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Badge className={`${getSeverityColor(incident.severity)} text-white text-xs px-2 py-1`}>
            {getSeverityIcon(incident.severity)}
            <span className="ml-1">{incident.severity?.toUpperCase()}</span>
          </Badge>
          <span className="text-xs text-gray-400">
            {incident.classification === 'true-positive' ? 'TRUE+' : 'FALSE+'}
          </span>
        </div>
        <div className="text-xs text-gray-500">
          {incident.createdAt ? format(new Date(incident.createdAt), "MMM d, HH:mm") : ''}
        </div>
      </div>
      
      <h3 className="text-sm font-medium text-white mb-2 line-clamp-2">
        {incident.title}
      </h3>
      
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-center space-x-1">
          <Shield className="w-3 h-3 text-cyber-blue" />
          <span className="text-gray-400">Confidence:</span>
          <span className="text-white font-medium">{incident.confidence}%</span>
        </div>
        <div className="flex items-center space-x-1">
          <Brain className="w-3 h-3 text-cyber-purple" />
          <span className="text-gray-400">AI:</span>
          <span className="text-white font-medium">{incident.aiInvestigation || 85}%</span>
        </div>
      </div>
      
      <div className="flex space-x-2 mt-2">
        <div className="flex-1">
          <Progress value={incident.confidence || 0} className="h-1" />
        </div>
        <div className="flex-1">
          <Progress value={incident.aiInvestigation || 85} className="h-1" />
        </div>
      </div>
      
      {incident.mitreAttack && incident.mitreAttack.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {incident.mitreAttack.slice(0, 2).map((mitre, index) => (
            <Badge key={index} variant="outline" className="text-xs px-1 py-0 text-gray-400 border-gray-600">
              {mitre}
            </Badge>
          ))}
          {incident.mitreAttack.length > 2 && (
            <Badge variant="outline" className="text-xs px-1 py-0 text-gray-400 border-gray-600">
              +{incident.mitreAttack.length - 2}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}