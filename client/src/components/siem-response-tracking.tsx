import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface SiemResponseProps {
  incident: any;
}

interface SiemResponse {
  id: string;
  siemType: string;
  endpointUrl: string;
  responseStatus: string;
  httpStatus?: number;
  errorMessage?: string;
  responsePayload: any;
  responseData?: any;
  sentAt: string;
  retriedCount: number;
}

export function SiemResponseTracking({ incident }: SiemResponseProps) {
  const [selectedResponse, setSelectedResponse] = useState<SiemResponse | null>(null);

  const { data: siemResponses = [], isLoading, refetch } = useQuery<SiemResponse[]>({
    queryKey: [`/api/incidents/${incident.id}/siem-responses`],
    enabled: !!incident.id
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'not-configured':
        return <AlertTriangle className="w-4 h-4 text-orange-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-600 text-white';
      case 'failed':
        return 'bg-red-600 text-white';
      case 'pending':
        return 'bg-yellow-600 text-white';
      case 'not-configured':
        return 'bg-orange-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  const isAutomatedIncident = incident.source === 'siem-webhook' || incident.source === 'siem-api';
  const siemSource = incident.siemSource || 'Unknown SIEM';
  const responseStatus = incident.siemResponseStatus || 'no-response';

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-cyber-blue" />
          <span className="ml-2 text-gray-400">Loading SIEM responses...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* SIEM Integration Status */}
      <div className="cyber-slate rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <ExternalLink className="text-cyber-purple" />
            <span>SIEM Integration Status</span>
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="text-gray-400 hover:text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <span className="text-sm text-gray-400">Incident Source</span>
            <div className="flex items-center space-x-2 mt-1">
              <Badge className={isAutomatedIncident ? 'bg-cyber-purple text-white' : 'bg-gray-600 text-white'}>
                {isAutomatedIncident ? '🔗 AUTOMATED' : '👤 MANUAL'}
              </Badge>
              {isAutomatedIncident && (
                <span className="text-sm text-white">{siemSource}</span>
              )}
            </div>
          </div>
          <div>
            <span className="text-sm text-gray-400">Response Status</span>
            <div className="flex items-center space-x-2 mt-1">
              {getStatusIcon(responseStatus)}
              <Badge className={getStatusColor(responseStatus)}>
                {responseStatus.replace('-', ' ').toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>

        {isAutomatedIncident && (
          <div className="cyber-dark rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">
                Original SIEM Incident ID: 
                <span className="text-white font-mono ml-1">
                  {incident.siemIntegrationId || 'Not provided'}
                </span>
              </span>
              {incident.siemResponseTime && (
                <span className="text-xs text-gray-400">
                  Response sent: {format(new Date(incident.siemResponseTime), "MMM d, HH:mm")}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Response History */}
      {siemResponses.length > 0 ? (
        <div className="cyber-slate rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Response History</h3>
          <div className="space-y-3">
            {siemResponses.map((response: SiemResponse) => (
              <div key={response.id} className="cyber-dark rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(response.responseStatus)}
                    <span className="font-medium">{response.siemType.toUpperCase()}</span>
                    <Badge className={getStatusColor(response.responseStatus)}>
                      {response.responseStatus.replace('-', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-400">
                    {format(new Date(response.sentAt), "MMM d, yyyy HH:mm")}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <span className="text-gray-400">Endpoint:</span>
                    <div className="text-white font-mono text-xs mt-1 break-all">
                      {response.endpointUrl.replace(/https?:\/\//, '').substring(0, 40)}
                      {response.endpointUrl.length > 40 ? '...' : ''}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Status:</span>
                    <div className="flex items-center space-x-2 mt-1">
                      {response.httpStatus && (
                        <span className={`text-xs px-2 py-1 rounded ${
                          response.httpStatus >= 200 && response.httpStatus < 300
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}>
                          HTTP {response.httpStatus}
                        </span>
                      )}
                      {response.retriedCount > 0 && (
                        <span className="text-xs text-orange-400">
                          Retried {response.retriedCount}x
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {response.errorMessage && (
                  <div className="bg-red-900/20 border border-red-600/30 rounded p-2 mt-2">
                    <span className="text-red-400 text-sm">Error: {response.errorMessage}</span>
                  </div>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedResponse(selectedResponse?.id === response.id ? null : response)}
                  className="text-cyber-blue hover:text-white text-xs mt-2"
                >
                  {selectedResponse?.id === response.id ? 'Hide Details' : 'Show Payload'}
                </Button>

                {selectedResponse?.id === response.id && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <h5 className="text-sm font-semibold text-gray-300 mb-2">Sent to SIEM:</h5>
                      <div className="bg-black/50 rounded border border-cyber-slate-light p-3 text-xs font-mono overflow-auto max-h-40">
                        <pre className="text-gray-300">
                          {JSON.stringify(response.responsePayload, null, 2)}
                        </pre>
                      </div>
                    </div>

                    {response.responseData && (
                      <div>
                        <h5 className="text-sm font-semibold text-gray-300 mb-2">SIEM Response:</h5>
                        <div className="bg-black/50 rounded border border-cyber-slate-light p-3 text-xs font-mono overflow-auto max-h-40">
                          <pre className="text-gray-300">
                            {JSON.stringify(response.responseData, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : isAutomatedIncident ? (
        <div className="cyber-slate rounded-lg p-4">
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No SIEM Responses Recorded</h3>
            <p className="text-gray-400 mb-4">
              This incident was received from {siemSource} but no automated response has been sent back yet.
            </p>
            <p className="text-sm text-gray-500">
              Responses are automatically sent after AI analysis completes. Check your SIEM API configuration if responses are missing.
            </p>
          </div>
        </div>
      ) : (
        <div className="cyber-slate rounded-lg p-4">
          <div className="text-center py-8">
            <ExternalLink className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Manual Incident</h3>
            <p className="text-gray-400">
              This incident was created manually and does not have SIEM integration responses.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              SIEM responses are only available for incidents received via SIEM webhook integrations.
            </p>
          </div>
        </div>
      )}

      {/* Response Summary */}
      {isAutomatedIncident && incident.siemResponseData && (
        <div className="cyber-slate rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Latest Response Summary</h3>
          <div className="cyber-dark rounded-lg p-3">
            <pre className="text-xs text-gray-300 overflow-auto">
              {JSON.stringify(JSON.parse(incident.siemResponseData), null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}