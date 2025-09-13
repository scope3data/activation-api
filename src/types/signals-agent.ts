// Signals Agent types - represents external agents that manage segments

// Activate signal request
export interface ActivateSignalRequest {
  signalId: string; // ID from agent's get_signals response
}

export interface ActivateSignalResponse {
  segmentId: string;
  segmentIds?: string[]; // If agent created multiple segments
}

// ADCP protocol types for communication with agents
export interface ADCPRequest {
  action: "activate_signal" | "get_signals";
  data?: Record<string, unknown>;
  requestId: string;
  timestamp: string;
}

export interface ADCPResponse {
  data?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
  requestId: string;
  status: "error" | "success";
  timestamp: string;
}

// Get signals request/response types
export interface GetSignalsRequest {
  brief?: string; // Optional campaign brief for tailored signals
  context?: {
    brandAgentId: string;
    campaignId?: string;
    objectives?: string[];
  };
}

export interface GetSignalsResponse {
  agentId: string;
  agentName: string;
  metadata?: Record<string, unknown>;
  signals: Array<{
    clusters: Array<{
      channel?: string;
      gdpr?: boolean;
      region: string;
    }>;
    confidence?: number;
    description: string;
    id?: string; // If referencing existing segment
    keyType: string;
    name: string;
    reasoning?: string;
  }>;
}

export interface SignalsAgent {
  brandAgentId: string;
  config?: Record<string, unknown>;
  createdAt: Date;
  description?: string;
  endpointUrl: string;
  id: string;
  name: string;
  registeredAt: Date;
  registeredBy?: string;
  status: "active" | "inactive" | "suspended";
  updatedAt: Date;
}

export interface SignalsAgentActivitiesData {
  activities: SignalsAgentActivity[];
  total: number;
}

// Agent activity tracking
export interface SignalsAgentActivity {
  activityType:
    | "activate_signal"
    | "get_signals"
    | "segment_created"
    | "segment_deleted"
    | "segment_updated";
  brandAgentId: string;
  errorDetails?: string;
  executedAt: Date;
  id: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  responseTimeMs?: number;
  segmentIds?: string[];
  signalsAgentId: string;
  status: "failed" | "success" | "timeout";
}

export interface SignalsAgentInput {
  brandAgentId: string;
  config?: Record<string, unknown>;
  description?: string;
  endpointUrl: string;
  name: string;
  registeredBy?: string;
}

export interface SignalsAgentsData {
  signalsAgents: SignalsAgent[];
}

export interface SignalsAgentUpdateInput {
  config?: Record<string, unknown>;
  description?: string;
  endpointUrl?: string;
  name?: string;
  status?: "active" | "inactive" | "suspended";
}
