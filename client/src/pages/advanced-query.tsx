import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Play,
  Save,
  Clock,
  Database,
  Filter,
  Download,
  Copy,
  History,
  Star,
  Code,
  FileJson,
} from "lucide-react";
import { format } from "date-fns";

export default function AdvancedQuery() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [queryType, setQueryType] = useState("kql");
  const [queryName, setQueryName] = useState("");
  const [queryResults, setQueryResults] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Fetch saved queries
  const { data: savedQueries } = useQuery({
    queryKey: ["/api/queries/saved"],
  });

  // Fetch query history
  const { data: queryHistory } = useQuery({
    queryKey: ["/api/queries/history"],
  });

  // Run query
  const runQueryMutation = useMutation({
    mutationFn: async (queryData: any) => {
      setIsRunning(true);
      return await apiRequest("POST", "/api/queries/run", queryData);
    },
    onSuccess: (data) => {
      setQueryResults(data);
      queryClient.invalidateQueries({ queryKey: ["/api/queries/history"] });
      toast({
        title: "Query Executed",
        description: `Found ${data.resultCount || 0} results in ${data.executionTime || 0}ms`,
      });
    },
    onError: (error) => {
      toast({
        title: "Query Failed",
        description: "Error executing query. Please check your syntax.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsRunning(false);
    },
  });

  // Save query
  const saveQueryMutation = useMutation({
    mutationFn: async (queryData: any) => {
      return await apiRequest("POST", "/api/queries/save", queryData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/queries/saved"] });
      toast({
        title: "Query Saved",
        description: "Your query has been saved successfully.",
      });
      setShowSaveDialog(false);
    },
  });

  const handleRunQuery = () => {
    if (!query.trim()) {
      toast({
        title: "Empty Query",
        description: "Please enter a query to run.",
        variant: "destructive",
      });
      return;
    }
    runQueryMutation.mutate({ query, queryType });
  };

  const handleSaveQuery = () => {
    if (!queryName.trim()) {
      toast({
        title: "Name Required",
        description: "Please provide a name for the query.",
        variant: "destructive",
      });
      return;
    }
    saveQueryMutation.mutate({ query, queryType, queryName });
  };

  const loadQuery = (savedQuery: any) => {
    setQuery(savedQuery.query);
    setQueryType(savedQuery.queryType);
    setQueryName(savedQuery.queryName || "");
  };

  const exportResults = () => {
    if (!queryResults) return;
    const blob = new Blob([JSON.stringify(queryResults.results, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `query-results-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const sampleQueries = {
    kql: `// Find all critical incidents in the last 24 hours
Incidents
| where Severity == "critical"
| where Timestamp > ago(24h)
| project Timestamp, Title, Classification, Confidence
| order by Timestamp desc`,
    sql: `-- Find incidents with high confidence true positives
SELECT id, title, severity, confidence, created_at
FROM incidents
WHERE classification = 'true-positive'
  AND confidence > 90
ORDER BY created_at DESC
LIMIT 100`,
    custom: `// Custom threat hunting query
search:
  - mitre_attack: "T1055"
  - severity: ["critical", "high"]
  - time_range: "last_7_days"
  
aggregate:
  - group_by: "attacker_ip"
  - count: "incidents"
  - avg: "confidence"`,
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Advanced Query</h1>
        <p className="text-gray-500">Hunt for threats using powerful query capabilities</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Query Editor */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="cyber-slate border-cyber-slate-light">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Query Editor</CardTitle>
                <div className="flex items-center space-x-2">
                  <Select value={queryType} onValueChange={setQueryType}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kql">KQL</SelectItem>
                      <SelectItem value="sql">SQL</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuery(sampleQueries[queryType as keyof typeof sampleQueries])}
                  >
                    <Code className="w-4 h-4 mr-1" />
                    Sample
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Enter your ${queryType.toUpperCase()} query here...`}
                className="font-mono min-h-[300px] cyber-dark border-cyber-slate-light"
              />
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center space-x-2">
                  <Input
                    value={queryName}
                    onChange={(e) => setQueryName(e.target.value)}
                    placeholder="Query name (optional)"
                    className="w-48"
                  />
                  <Button
                    variant="outline"
                    onClick={handleSaveQuery}
                    disabled={!query.trim()}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                </div>
                <Button
                  className="cyber-blue hover:bg-blue-600"
                  onClick={handleRunQuery}
                  disabled={isRunning || !query.trim()}
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isRunning ? "Running..." : "Run Query"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Query Results */}
          {queryResults && (
            <Card className="cyber-slate border-cyber-slate-light">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Query Results</CardTitle>
                    <CardDescription>
                      {queryResults.resultCount || 0} results in {queryResults.executionTime || 0}ms
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={exportResults}>
                    <Download className="w-4 h-4 mr-1" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {queryResults.results && queryResults.results.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(queryResults.results[0]).map((key) => (
                            <TableHead key={key}>{key}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queryResults.results.slice(0, 100).map((row: any, idx: number) => (
                          <TableRow key={idx}>
                            {Object.values(row).map((value: any, cellIdx: number) => (
                              <TableCell key={cellIdx} className="font-mono text-xs">
                                {typeof value === "object" 
                                  ? JSON.stringify(value) 
                                  : String(value)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {queryResults.results.length > 100 && (
                      <p className="text-sm text-gray-400 text-center mt-4">
                        Showing first 100 results of {queryResults.results.length}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Database className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No results found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Saved Queries & History */}
        <div className="space-y-4">
          {/* Saved Queries */}
          <Card className="cyber-slate border-cyber-slate-light">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Star className="w-4 h-4 mr-2 text-yellow-500" />
                Saved Queries
              </CardTitle>
            </CardHeader>
            <CardContent>
              {savedQueries && savedQueries.length > 0 ? (
                <div className="space-y-2">
                  {savedQueries.map((savedQuery: any) => (
                    <div
                      key={savedQuery.id}
                      className="p-3 cyber-dark rounded-lg cursor-pointer hover:bg-gray-700 transition-colors"
                      onClick={() => loadQuery(savedQuery)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{savedQuery.queryName}</p>
                          <p className="text-xs text-gray-400">
                            {savedQuery.queryType.toUpperCase()}
                          </p>
                        </div>
                        <Play className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  No saved queries yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* Query History */}
          <Card className="cyber-slate border-cyber-slate-light">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <History className="w-4 h-4 mr-2 text-blue-500" />
                Query History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {queryHistory && queryHistory.length > 0 ? (
                <div className="space-y-2">
                  {queryHistory.slice(0, 10).map((historyItem: any) => (
                    <div
                      key={historyItem.id}
                      className="p-3 cyber-dark rounded-lg cursor-pointer hover:bg-gray-700 transition-colors"
                      onClick={() => loadQuery(historyItem)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-xs font-mono truncate">
                            {historyItem.query.substring(0, 50)}...
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {historyItem.queryType}
                            </Badge>
                            <span className="text-xs text-gray-400">
                              {historyItem.resultCount || 0} results
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(new Date(historyItem.createdAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  No query history yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}