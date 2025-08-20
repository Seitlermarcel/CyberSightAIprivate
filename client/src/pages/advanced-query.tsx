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
  Table2,
  Info,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

export default function AdvancedQuery() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [queryType, setQueryType] = useState("sql");
  const [queryName, setQueryName] = useState("");
  const [queryResults, setQueryResults] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);

  // Fetch saved queries
  const { data: savedQueries = [] } = useQuery<any[]>({
    queryKey: ["/api/queries/saved"],
  });

  // Fetch query history
  const { data: queryHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/queries/history"],
  });

  // Run query
  const runQueryMutation = useMutation({
    mutationFn: async (queryData: any) => {
      setIsRunning(true);
      const response = await apiRequest("POST", "/api/queries/run", queryData);
      return await response.json();
    },
    onSuccess: (data) => {
      setQueryResults(data);
      // Only invalidate if needed to reduce API calls
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/queries/history"] }), 1000);
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
      const response = await apiRequest("POST", "/api/queries/save", queryData);
      return await response.json();
    },
    onSuccess: () => {
      // Delay invalidation to reduce rapid API calls
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/queries/saved"] }), 500);
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
    runQueryMutation.mutate({ query, queryType: "sql" });
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
    saveQueryMutation.mutate({ query, queryType: "sql", queryName });
  };

  const loadQuery = (savedQuery: any) => {
    setQuery(savedQuery.query);
    setQueryType("sql");
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

  const tableSchemas = [
    {
      name: "incidents",
      description: "Security incidents and analysis results",
      columns: [
        { name: "id", type: "varchar", description: "Unique incident identifier" },
        { name: "user_id", type: "varchar", description: "Owner user ID" },
        { name: "title", type: "text", description: "Incident title" },
        { name: "severity", type: "text", description: "critical, high, medium, low, informational" },
        { name: "status", type: "text", description: "open, in-progress, closed" },
        { name: "classification", type: "text", description: "true-positive, false-positive" },
        { name: "confidence", type: "integer", description: "AI confidence score (0-100)" },
        { name: "mitre_attack", type: "text[]", description: "MITRE ATT&CK techniques" },
        { name: "created_at", type: "timestamp", description: "Creation timestamp" },
      ]
    },
    {
      name: "api_configurations",
      description: "Log streaming and integration endpoints",
      columns: [
        { name: "id", type: "varchar", description: "Configuration ID" },
        { name: "name", type: "text", description: "Configuration name" },
        { name: "endpoint_type", type: "text", description: "webhook, syslog, splunk, elastic, azure-sentinel" },
        { name: "endpoint_url", type: "text", description: "Endpoint URL" },
        { name: "is_active", type: "boolean", description: "Active status" },
        { name: "last_sync", type: "timestamp", description: "Last synchronization time" },
      ]
    },
    {
      name: "billing_transactions",
      description: "Credit purchases and usage transactions",
      columns: [
        { name: "id", type: "varchar", description: "Transaction ID" },
        { name: "type", type: "text", description: "credit-purchase, incident-analysis, storage-fee" },
        { name: "amount", type: "decimal", description: "Transaction amount in EUR" },
        { name: "status", type: "text", description: "pending, completed, failed, refunded" },
        { name: "created_at", type: "timestamp", description: "Transaction date" },
      ]
    },
    {
      name: "usage_tracking",
      description: "Monthly usage statistics for billing",
      columns: [
        { name: "month", type: "text", description: "YYYY-MM format" },
        { name: "incidents_analyzed", type: "integer", description: "Number of incidents analyzed" },
        { name: "storage_gb", type: "real", description: "Storage used in GB" },
        { name: "total_cost", type: "decimal", description: "Total cost in EUR" },
      ]
    },
    {
      name: "query_history",
      description: "Saved and executed queries",
      columns: [
        { name: "query_name", type: "text", description: "Query name (if saved)" },
        { name: "query", type: "text", description: "Query text" },
        { name: "query_type", type: "text", description: "kql, sql, custom" },
        { name: "result_count", type: "integer", description: "Number of results" },
        { name: "execution_time", type: "integer", description: "Execution time in ms" },
      ]
    }
  ];

  const sampleQueries = {
    sql: `-- Find incidents with high confidence true positives
SELECT id, title, severity, confidence, created_at
FROM incidents
WHERE classification = 'true-positive'
  AND confidence > 90
ORDER BY created_at DESC
LIMIT 100`,
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
                <CardTitle>SQL Query Editor</CardTitle>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuery(sampleQueries.sql)}
                  >
                    <Code className="w-4 h-4 mr-1" />
                    Sample Query
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your SQL query here..."
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
          {/* Table Schemas */}
          <Card className="cyber-slate border-cyber-slate-light">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Table2 className="w-4 h-4 mr-2 text-purple-500" />
                Table Schemas
              </CardTitle>
              <CardDescription>Available tables and columns for querying</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {tableSchemas.map((table) => (
                  <div key={table.name} className="cyber-dark rounded-lg">
                    <button
                      className="w-full p-3 flex items-center justify-between hover:bg-gray-700 transition-colors"
                      onClick={() => setExpandedTable(expandedTable === table.name ? null : table.name)}
                    >
                      <div className="flex items-center space-x-2">
                        <Database className="w-4 h-4 text-gray-400" />
                        <div className="text-left">
                          <p className="font-mono text-sm font-medium">{table.name}</p>
                          <p className="text-xs text-gray-400">{table.description}</p>
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 text-gray-400 transition-transform ${
                          expandedTable === table.name ? "rotate-90" : ""
                        }`}
                      />
                    </button>
                    {expandedTable === table.name && (
                      <div className="px-3 pb-3">
                        <div className="border-t border-gray-700 pt-2 mt-1">
                          {table.columns.map((col) => (
                            <div key={col.name} className="py-1 flex items-start space-x-2">
                              <code className="text-xs text-cyber-blue">{col.name}</code>
                              <span className="text-xs text-gray-500">({col.type})</span>
                              <span className="text-xs text-gray-400 flex-1">- {col.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

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