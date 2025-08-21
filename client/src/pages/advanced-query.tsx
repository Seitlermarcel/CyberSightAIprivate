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
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/queries/saved"] });
        queryClient.invalidateQueries({ queryKey: ["/api/queries/history"] });
      }, 500);
      setQueryName("");
      setShowSaveDialog(false);
      toast({
        title: "Query Saved",
        description: "Query has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Failed to save query. Please try again.",
        variant: "destructive",
      });
    },
  });

  const runQuery = () => {
    if (!query.trim()) {
      toast({
        title: "Empty Query",
        description: "Please enter a query to execute.",
        variant: "destructive",
      });
      return;
    }

    runQueryMutation.mutate({
      query: query.trim(),
      queryType,
    });
  };

  const handleSaveQuery = () => {
    if (!query.trim()) {
      toast({
        title: "Empty Query",
        description: "Please enter a query to save.",
        variant: "destructive",
      });
      return;
    }

    if (!queryName.trim()) {
      toast({
        title: "Missing Name",
        description: "Please enter a name for your query.",
        variant: "destructive",
      });
      return;
    }

    saveQueryMutation.mutate({
      name: queryName.trim(),
      query: query.trim(),
      queryType,
    });
  };

  const loadSavedQuery = (savedQuery: any) => {
    setQuery(savedQuery.query);
    setQueryType(savedQuery.queryType || "sql");
  };

  const loadQueryFromHistory = (historyItem: any) => {
    setQuery(historyItem.query);
    setQueryType(historyItem.queryType || "sql");
  };

  const exportResults = () => {
    if (!queryResults?.data) return;
    
    const csvContent = [
      Object.keys(queryResults.data[0] || {}).join(","),
      ...queryResults.data.map((row: any) =>
        Object.values(row).map((val: any) => 
          typeof val === 'string' && val.includes(',') ? `"${val}"` : val
        ).join(",")
      )
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `query-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Database schema information
  const databaseSchema = [
    {
      name: "incidents",
      description: "Security incidents and analysis results",
      columns: [
        { name: "id", type: "varchar", description: "Unique incident identifier" },
        { name: "title", type: "text", description: "Incident title/summary" },
        { name: "severity", type: "text", description: "critical, high, medium, low, informational" },
        { name: "classification", type: "text", description: "true-positive or false-positive" },
        { name: "confidence", type: "integer", description: "Analysis confidence (0-100)" },
        { name: "ai_investigation", type: "integer", description: "AI investigation progress (0-100)" },
        { name: "mitre_attack", type: "text[]", description: "MITRE ATT&CK technique IDs" },
        { name: "created_at", type: "timestamp", description: "When incident was created" },
        { name: "updated_at", type: "timestamp", description: "Last update time" },
      ]
    },
    {
      name: "users",
      description: "User accounts and preferences",
      columns: [
        { name: "id", type: "varchar", description: "User ID" },
        { name: "email", type: "text", description: "User email address" },
        { name: "credits", type: "decimal", description: "Available credits in EUR" },
        { name: "subscription_plan", type: "text", description: "starter, professional, business, enterprise" },
        { name: "created_at", type: "timestamp", description: "Account creation date" },
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 lg:p-6 xl:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl blur-xl"></div>
          <div className="relative p-4 lg:p-6 bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-700/50">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl flex items-center justify-center border border-green-500/30">
                <Search className="text-green-400 w-5 h-5 lg:w-6 lg:h-6" />
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">Advanced Query Console</h1>
                <p className="text-gray-300 text-sm lg:text-base mt-1">
                  Hunt for threats using powerful SQL queries across your security data
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Query Editor */}
          <div className="lg:col-span-2 space-y-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl blur-xl"></div>
              <div className="relative bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 lg:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl border border-blue-500/30">
                      <Code className="text-blue-400 w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">SQL Query Editor</h2>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuery(sampleQueries.sql)}
                      className="border-slate-600 text-gray-300 hover:bg-slate-700"
                    >
                      <FileJson className="w-4 h-4 mr-1" />
                      Sample Query
                    </Button>
                  </div>
                </div>

                <Textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter your SQL query here..."
                  className="font-mono min-h-[300px] bg-slate-900/50 border-slate-700/50 text-gray-100 placeholder-gray-400"
                />
                
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center space-x-2">
                    <Input
                      value={queryName}
                      onChange={(e) => setQueryName(e.target.value)}
                      placeholder="Query name (optional)"
                      className="w-48 bg-slate-900/50 border-slate-700/50"
                    />
                    <Button
                      variant="outline"
                      onClick={handleSaveQuery}
                      disabled={!query.trim() || !queryName.trim() || saveQueryMutation.isPending}
                      className="border-slate-600 text-gray-300 hover:bg-slate-700"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                  </div>
                  <Button
                    onClick={runQuery}
                    disabled={isRunning || !query.trim()}
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium px-6 py-2 rounded-lg transition-all duration-300"
                  >
                    {isRunning ? (
                      <>
                        <div className="animate-spin mr-2">
                          <Search className="w-4 h-4" />
                        </div>
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Execute Query
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Query Results */}
            {queryResults && (
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl blur-xl"></div>
                <div className="relative bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 lg:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30">
                        <Table2 className="text-purple-400 w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Query Results</h2>
                        <p className="text-sm text-gray-400">
                          {queryResults.resultCount || 0} results in {queryResults.executionTime || 0}ms
                        </p>
                      </div>
                    </div>
                    {queryResults.data && queryResults.data.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportResults}
                        className="border-slate-600 text-gray-300 hover:bg-slate-700"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Export CSV
                      </Button>
                    )}
                  </div>

                  {queryResults.data && queryResults.data.length > 0 ? (
                    <div className="overflow-x-auto bg-slate-900/50 rounded-lg border border-slate-700/30">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700/50">
                            {Object.keys(queryResults.data[0]).map((column) => (
                              <TableHead key={column} className="text-gray-300 font-medium">
                                {column}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {queryResults.data.slice(0, 100).map((row: any, index: number) => (
                            <TableRow key={index} className="border-slate-700/30 hover:bg-slate-800/30">
                              {Object.values(row).map((value: any, cellIndex: number) => (
                                <TableCell key={cellIndex} className="text-gray-200">
                                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {queryResults.data.length > 100 && (
                        <div className="p-4 text-center text-gray-400 text-sm border-t border-slate-700/30">
                          Showing first 100 results of {queryResults.data.length} total
                        </div>
                      )}
                    </div>
                  ) : queryResults.error ? (
                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                      <p className="text-red-400">{queryResults.error}</p>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      No results found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Database Schema */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 rounded-2xl blur-xl"></div>
              <div className="relative bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 lg:p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-gradient-to-br from-orange-500/20 to-yellow-500/20 rounded-xl border border-orange-500/30">
                    <Database className="text-orange-400 w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-bold bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">Database Schema</h2>
                </div>

                <div className="space-y-3">
                  {databaseSchema.map((table) => (
                    <div key={table.name}>
                      <Button
                        variant="ghost"
                        className="w-full justify-between p-2 text-left hover:bg-slate-700/50"
                        onClick={() => setExpandedTable(expandedTable === table.name ? null : table.name)}
                      >
                        <span className="font-medium text-white">{table.name}</span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${expandedTable === table.name ? 'rotate-90' : ''}`} />
                      </Button>
                      
                      {expandedTable === table.name && (
                        <div className="ml-2 mt-2 space-y-1 border-l border-slate-600 pl-3">
                          <p className="text-xs text-gray-400 mb-2">{table.description}</p>
                          {table.columns.map((column) => (
                            <div key={column.name} className="text-xs">
                              <span className="font-mono text-green-400">{column.name}</span>
                              <span className="text-gray-400 ml-2">{column.type}</span>
                              <p className="text-gray-500 ml-4">{column.description}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Saved Queries */}
            {savedQueries && savedQueries.length > 0 && (
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl blur-xl"></div>
                <div className="relative bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 lg:p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl border border-cyan-500/30">
                      <Star className="text-cyan-400 w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Saved Queries</h2>
                  </div>

                  <div className="space-y-2">
                    {savedQueries.slice(0, 5).map((savedQuery: any) => (
                      <div key={savedQuery.id} className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/30 hover:border-cyan-500/40 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-white text-sm">{savedQuery.queryName}</h4>
                            <p className="text-xs text-gray-400">
                              {savedQuery.createdAt ? format(new Date(savedQuery.createdAt), "MMM d, yyyy") : ''}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadSavedQuery(savedQuery)}
                            className="text-cyan-400 hover:bg-cyan-500/20"
                          >
                            Load
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Query History */}
            {queryHistory && queryHistory.length > 0 && (
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-2xl blur-xl"></div>
                <div className="relative bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 lg:p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-xl border border-violet-500/30">
                      <History className="text-violet-400 w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">Recent Queries</h2>
                  </div>

                  <div className="space-y-2">
                    {queryHistory.slice(0, 5).map((historyItem: any, index: number) => (
                      <div key={index} className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/30 hover:border-violet-500/40 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-400 truncate font-mono">
                              {historyItem.query.slice(0, 50)}...
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline" className="text-xs text-gray-400 border-gray-600">
                                {historyItem.resultCount || 0} results
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {historyItem.executionTime || 0}ms
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadQueryFromHistory(historyItem)}
                            className="text-violet-400 hover:bg-violet-500/20 ml-2"
                          >
                            Load
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}