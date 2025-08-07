import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Search, Eye, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import IncidentDetail from "@/components/incident-detail";
import type { Incident } from "@shared/schema";
import { format } from "date-fns";
import { CompactIncidentCard } from "./compact-incident-card";

interface IncidentHistoryProps {
  compactView?: boolean;
}

export default function IncidentHistory({ compactView = false }: IncidentHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [classificationFilter, setClassificationFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);

  const { data: incidents, isLoading } = useQuery({
    queryKey: ["/api/incidents"],
  });

  const filteredIncidents = incidents?.filter((incident: Incident) => {
    const matchesSearch = incident.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClassification = classificationFilter === "all" || incident.classification === classificationFilter;
    const matchesSeverity = severityFilter === "all" || incident.severity === severityFilter;
    const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
    
    return matchesSearch && matchesClassification && matchesSeverity && matchesStatus;
  }) || [];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-severity-critical";
      case "high":
        return "bg-severity-high";
      case "medium":
        return "bg-severity-medium";
      case "low":
        return "bg-severity-low";
      default:
        return "bg-severity-info";
    }
  };

  const getClassificationColor = (classification: string) => {
    return classification === "true-positive" ? "bg-severity-high" : "bg-green-500";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-cyber-blue";
      case "in-progress":
        return "bg-severity-medium";
      case "closed":
        return "bg-gray-600";
      default:
        return "bg-cyber-blue";
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyber-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading incidents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="cyber-slate border-b border-cyber-slate-light p-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 cyber-purple rounded-xl flex items-center justify-center">
            <History className="text-white text-xl" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-cyber-purple">Incident History</h2>
            <p className="text-gray-400">Review and analyze past security incidents</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search incidents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 cyber-slate border-cyber-slate-light text-white placeholder-gray-500 focus:ring-cyber-purple focus:border-transparent"
            />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <Select value={classificationFilter} onValueChange={setClassificationFilter}>
              <SelectTrigger className="cyber-slate border-cyber-slate-light text-white focus:ring-cyber-purple">
                <SelectValue placeholder="All Results" />
              </SelectTrigger>
              <SelectContent className="cyber-slate border-cyber-slate-light">
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="true-positive">True Positives</SelectItem>
                <SelectItem value="false-positive">False Positives</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="cyber-slate border-cyber-slate-light text-white focus:ring-cyber-purple">
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent className="cyber-slate border-cyber-slate-light">
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="informational">Informational</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="cyber-slate border-cyber-slate-light text-white focus:ring-cyber-purple">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="cyber-slate border-cyber-slate-light">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Incident List */}
        <div className={compactView ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-4"}>
          {filteredIncidents.length === 0 ? (
            <div className="text-center py-8 col-span-full">
              <p className="text-gray-400">No incidents found matching your criteria.</p>
            </div>
          ) : (
            filteredIncidents.map((incident: Incident) => (
              compactView ? (
                <CompactIncidentCard
                  key={incident.id}
                  incident={incident}
                  onClick={() => setSelectedIncident(incident.id)}
                />
              ) : (
                <div
                  key={incident.id}
                  className="cyber-slate rounded-xl p-6 border border-cyber-slate-light hover:border-cyber-purple transition-colors"
                >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold">{incident.title}</h3>
                      <Badge className={`${getStatusColor(incident.status)} text-white capitalize`}>
                        {incident.status.replace("-", " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-400 mb-3">
                      <span className="flex items-center">
                        <Calendar className="mr-1 w-3 h-3" />
                        {incident.createdAt ? format(new Date(incident.createdAt), "MMM d, yyyy 'at' h:mm a") : "N/A"}
                      </span>
                      {incident.confidence && (
                        <span>Confidence: {incident.confidence}%</span>
                      )}
                    </div>
                    
                    {/* Additional Info */}
                    <div className="flex items-center space-x-2 mb-2">
                      {incident.severity && (
                        <Badge className={`${getSeverityColor(incident.severity)} text-white text-xs capitalize`}>
                          {incident.severity}
                        </Badge>
                      )}
                      {incident.mitreAttack && incident.mitreAttack.length > 0 && (
                        <div className="flex space-x-1">
                          {incident.mitreAttack.slice(0, 2).map((technique, index) => (
                            <Badge key={index} variant="outline" className="text-xs text-gray-400 border-gray-600">
                              {technique}
                            </Badge>
                          ))}
                          {incident.mitreAttack.length > 2 && (
                            <Badge variant="outline" className="text-xs text-gray-400 border-gray-600">
                              +{incident.mitreAttack.length - 2} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {incident.classification && (
                      <Badge className={`${getClassificationColor(incident.classification)} text-white`}>
                        {incident.classification === "true-positive" ? "True Positive" : "False Positive"}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-white"
                      onClick={() => setSelectedIncident(incident.id)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              )
            ))
          )}
        </div>
      </div>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <IncidentDetail
          incidentId={selectedIncident}
          onClose={() => setSelectedIncident(null)}
        />
      )}
    </div>
  );
}
