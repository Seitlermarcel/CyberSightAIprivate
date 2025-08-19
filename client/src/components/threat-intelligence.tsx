import { Shield, AlertTriangle, Info, Globe, Server, Hash, Bug, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ThreatIntelligenceProps {
  threatReport: any;
}

export default function ThreatIntelligence({ threatReport }: ThreatIntelligenceProps) {
  if (!threatReport) {
    return (
      <Card className="cyber-slate border-cyber-slate-light">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-cyber-blue" />
            <span>Threat Intelligence</span>
          </CardTitle>
          <CardDescription>No threat intelligence data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getThreatLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-severity-critical';
      case 'high': return 'bg-severity-high';
      case 'medium': return 'bg-severity-medium';
      case 'low': return 'bg-severity-low';
      default: return 'bg-severity-info';
    }
  };

  const getIndicatorIcon = (type: string) => {
    switch (type) {
      case 'ip': return <Server className="w-4 h-4" />;
      case 'domain': return <Globe className="w-4 h-4" />;
      case 'hash': return <Hash className="w-4 h-4" />;
      case 'cve': return <Bug className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  return (
    <Card className="cyber-slate border-cyber-slate-light">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-cyber-blue" />
            <span>AlienVault OTX Threat Intelligence</span>
          </div>
          <Badge className={`${getThreatLevelColor(threatReport.threat_level)} text-white capitalize`}>
            {threatReport.threat_level}
          </Badge>
        </CardTitle>
        <CardDescription className="text-gray-400">
          {threatReport.summary}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Risk Score */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">Threat Risk Score</span>
            <span className="text-lg font-bold text-cyber-blue">{threatReport.risk_score}/100</span>
          </div>
          <Progress value={threatReport.risk_score} className="h-2" />
        </div>

        <Tabs defaultValue="indicators" className="w-full">
          <TabsList className="grid w-full grid-cols-3 cyber-dark">
            <TabsTrigger value="indicators">Indicators</TabsTrigger>
            <TabsTrigger value="iocs">IOCs</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="indicators" className="space-y-2 mt-4">
            {threatReport.indicators?.slice(0, 5).map((indicator: any, index: number) => (
              <div key={index} className="flex items-start space-x-3 p-3 rounded-lg cyber-dark">
                {getIndicatorIcon(indicator.type)}
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm">{indicator.value}</span>
                    {indicator.malicious && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Malicious
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {indicator.pulse_count > 0 && (
                      <span>Found in {indicator.pulse_count} threat reports</span>
                    )}
                    {indicator.threat_score && (
                      <span className="ml-2">• Risk: {indicator.threat_score}%</span>
                    )}
                    {indicator.tags?.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {indicator.tags.slice(0, 3).map((tag: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="iocs" className="mt-4">
            <div className="space-y-3">
              {(!threatReport.iocs?.ips?.length && !threatReport.iocs?.domains?.length && 
                !threatReport.iocs?.hashes?.length && !threatReport.iocs?.cves?.length && 
                !threatReport.iocs?.urls?.length) && (
                <div className="text-center py-8 text-gray-400">
                  <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No indicators of compromise detected in this incident</p>
                  <p className="text-xs mt-1">IOCs include IP addresses, domains, file hashes, and CVEs</p>
                </div>
              )}

              {threatReport.iocs?.ips?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-gray-400">IP Addresses ({threatReport.iocs.ips.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {threatReport.iocs.ips.slice(0, 8).map((ip: string, i: number) => (
                      <Badge key={i} variant="outline" className="font-mono text-xs">
                        <Server className="w-3 h-3 mr-1" />
                        {ip}
                      </Badge>
                    ))}
                    {threatReport.iocs.ips.length > 8 && (
                      <Badge variant="secondary" className="text-xs">
                        +{threatReport.iocs.ips.length - 8} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              
              {threatReport.iocs?.domains?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-gray-400">Domains ({threatReport.iocs.domains.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {threatReport.iocs.domains.slice(0, 8).map((domain: string, i: number) => (
                      <Badge key={i} variant="outline" className="font-mono text-xs">
                        <Globe className="w-3 h-3 mr-1" />
                        {domain}
                      </Badge>
                    ))}
                    {threatReport.iocs.domains.length > 8 && (
                      <Badge variant="secondary" className="text-xs">
                        +{threatReport.iocs.domains.length - 8} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              
              {threatReport.iocs?.hashes?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-gray-400">File Hashes ({threatReport.iocs.hashes.length})</h4>
                  <div className="space-y-1">
                    {threatReport.iocs.hashes.slice(0, 5).map((hash: string, i: number) => (
                      <div key={i} className="flex items-center space-x-2">
                        <Hash className="w-3 h-3 text-gray-400" />
                        <span className="font-mono text-xs text-gray-300 truncate max-w-xs">{hash}</span>
                      </div>
                    ))}
                    {threatReport.iocs.hashes.length > 5 && (
                      <div className="text-xs text-gray-400 ml-5">
                        +{threatReport.iocs.hashes.length - 5} more hashes
                      </div>
                    )}
                  </div>
                </div>
              )}

              {threatReport.iocs?.urls?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-gray-400">URLs ({threatReport.iocs.urls.length})</h4>
                  <div className="space-y-1">
                    {threatReport.iocs.urls.slice(0, 5).map((url: string, i: number) => (
                      <div key={i} className="flex items-center space-x-2">
                        <Link2 className="w-3 h-3 text-gray-400" />
                        <span className="font-mono text-xs text-gray-300 truncate max-w-xs">{url}</span>
                      </div>
                    ))}
                    {threatReport.iocs.urls.length > 5 && (
                      <div className="text-xs text-gray-400 ml-5">
                        +{threatReport.iocs.urls.length - 5} more URLs
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {threatReport.iocs?.cves?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-gray-400">CVEs ({threatReport.iocs.cves.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {threatReport.iocs.cves.map((cve: string, i: number) => (
                      <Badge key={i} variant="outline" className="font-mono text-xs">
                        <Bug className="w-3 h-3 mr-1" />
                        {cve}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="recommendations" className="mt-4">
            <div className="space-y-2">
              {threatReport.recommendations?.map((rec: string, index: number) => (
                <div key={index} className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-300">{rec}</p>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}