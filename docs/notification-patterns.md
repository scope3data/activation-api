# Notification Types and Workflow Patterns

This document outlines the notification framework design and patterns for building agentic workflows around creative sync events and campaign health monitoring.

## Notification Architecture

### Resource.Action Taxonomy

The notification system uses a clear `resource.action` taxonomy that enables agents to understand both **what** changed and **what action** is needed:

```typescript
enum NotificationEventType {
  // Creative Sync Lifecycle
  CREATIVE_SYNC_STARTED = "creative.sync_started",
  CREATIVE_SYNC_COMPLETED = "creative.sync_completed", 
  CREATIVE_SYNC_FAILED = "creative.sync_failed",
  
  // Creative Approval Lifecycle
  CREATIVE_APPROVED = "creative.approved",
  CREATIVE_REJECTED = "creative.rejected",
  CREATIVE_NEEDS_REVISION = "creative.needs_revision",
  
  // Campaign Health Events
  CAMPAIGN_CREATIVE_SYNC_UNHEALTHY = "campaign.creative_sync_unhealthy",
  CAMPAIGN_CREATIVE_SYNC_HEALTHY = "campaign.creative_sync_healthy",
  CAMPAIGN_MISSING_CREATIVES = "campaign.missing_creatives",
  
  // Tactic Events
  TACTIC_CREATIVE_SYNC_COMPLETED = "tactic.creative_sync_completed",
  TACTIC_CREATIVE_SYNC_FAILED = "tactic.creative_sync_failed",
  
  // Sales Agent Events  
  SALES_AGENT_APPROVAL_TIMEOUT = "sales_agent.approval_timeout",
  SALES_AGENT_UNHEALTHY = "sales_agent.unhealthy"
}
```

### Notification Structure

Notifications use a minimal, action-oriented structure:

```typescript
interface Notification {
  id: string;
  type: NotificationEventType;
  timestamp: string;
  customerId: number;
  brandAgentId?: number;
  data: NotificationData;
  read: boolean;
  acknowledged: boolean;
}

interface NotificationData {
  message: string;              // Human-readable summary
  creativeId?: string;          // Relevant creative
  campaignId?: string;          // Relevant campaign  
  salesAgentId?: string;        // Relevant sales agent
  tacticId?: string;            // Relevant tactic
  rejectionReason?: string;     // Why something was rejected
  actionRequired?: string;      // What the agent should do
  urgency?: "low" | "medium" | "high";
}
```

## Workflow Patterns

### 1. Creative Sync Workflows

#### Pattern: Handle Sync Failures
```typescript
// Agent receives: creative.sync_failed
notification = {
  type: "creative.sync_failed",
  data: {
    message: "Creative failed to sync to Video Sales Agent",
    creativeId: "creative_123",
    salesAgentId: "video_agent_456", 
    rejectionReason: "Format not supported",
    actionRequired: "Update creative format or exclude this sales agent"
  }
}

// Agentic Response Options:
// 1. Check creative format compatibility
// 2. Update creative to supported format
// 3. Remove incompatible sales agent from sync list
// 4. Create alternative creative for this sales agent
```

#### Pattern: Monitor Approval Status
```typescript
// Agent receives: creative.approved
notification = {
  type: "creative.approved", 
  data: {
    message: "Creative approved by Premium Display Agent",
    creativeId: "creative_123",
    salesAgentId: "display_agent_789",
    actionRequired: "Creative ready for campaign deployment"
  }
}

// Agentic Response:
// 1. Update campaign health metrics
// 2. Check if all required agents have approved
// 3. Enable campaign for this sales agent if all approvals complete
```

### 2. Campaign Health Workflows

#### Pattern: Detect Unhealthy Campaigns
```typescript
// Agent receives: campaign.creative_sync_unhealthy
notification = {
  type: "campaign.creative_sync_unhealthy",
  data: {
    message: "Campaign has 3 of 5 tactics with sync issues",
    campaignId: "campaign_456",
    actionRequired: "Review and resolve creative sync failures",
    urgency: "high"
  }
}

// Agentic Response:
// 1. Query detailed sync status for campaign
// 2. Identify root causes (format issues, rejection patterns)
// 3. Propose systematic fixes (bulk format updates, agent exclusions)
// 4. Schedule follow-up health check
```

#### Pattern: Missing Creatives Alert
```typescript
// Agent receives: campaign.missing_creatives
notification = {
  type: "campaign.missing_creatives",
  data: {
    message: "Campaign launching in 2 days with 0 approved creatives",
    campaignId: "campaign_789",
    actionRequired: "Assign and sync creatives before launch",
    urgency: "high"
  }
}

// Agentic Response:
// 1. Identify suitable existing creatives
// 2. Trigger creative assignment and sync
// 3. Monitor approval progress
// 4. Suggest campaign delay if insufficient time for approvals
```

### 3. Proactive Monitoring Workflows

#### Pattern: Sales Agent Health Monitoring
```typescript
// Agent receives: sales_agent.unhealthy
notification = {
  type: "sales_agent.unhealthy", 
  data: {
    message: "Mobile Video Agent has 80% rejection rate (last 7 days)",
    salesAgentId: "mobile_video_123",
    actionRequired: "Investigate rejection patterns and adjust targeting",
    urgency: "medium"
  }
}

// Agentic Response:
// 1. Analyze recent rejections for patterns
// 2. Compare with healthy sales agents
// 3. Adjust creative formats or targeting parameters
// 4. Test with smaller creative batches before full sync
```

## Integration Patterns

### MCP Tool Integration

Enhanced tools automatically generate notifications:

```typescript
// creative/update with content changes
await creativeUpdateTool.execute({
  creativeId: "creative_123",
  updates: { content: { htmlSnippet: "<updated>" } }
});
// → Triggers automatic re-sync
// → Generates creative.sync_started notifications
```

```typescript  
// creative/assign to campaign
await creativeAssignTool.execute({
  creativeId: "creative_123", 
  campaignId: "campaign_456"
});
// → Triggers sync to campaign's sales agents
// → Generates tactic.creative_sync_completed notifications
```

### Health Data Integration

Campaign and creative tools include health metrics:

```typescript
// campaign/list includes notification counts
response = {
  campaigns: [...],
  healthMetrics: {
    healthyCount: 5,
    warningCount: 2,    // Has unresolved notifications
    criticalCount: 1    // Has high-urgency notifications  
  }
}
```

```typescript
// creative/get includes sync status summary  
response = {
  creative: {...},
  syncStatusSummary: {
    totalRelevantAgents: 8,
    approved: 6,
    pending: 1,
    rejected: 1    // → Generates actionable notifications
  }
}
```

## Best Practices

### For Agents

1. **Filter by Urgency**: Process high-urgency notifications first
2. **Batch Similar Actions**: Group related creative updates, format changes
3. **Monitor Patterns**: Track recurring issues to identify systematic problems
4. **Acknowledge Completed Actions**: Mark notifications as acknowledged after resolution

### For Integration

1. **Use Structured Data**: Always include relevant IDs (creativeId, campaignId, etc.)
2. **Provide Clear Actions**: Specify exactly what the agent should do  
3. **Include Context**: Add rejection reasons, error details for debugging
4. **Set Appropriate Urgency**: Reserve "high" for launch-blocking issues

### Notification Filtering

```typescript
// Get campaign-specific notifications
const notifications = await getNotifications({
  campaignId: "campaign_123",
  types: [
    "campaign.creative_sync_unhealthy",
    "creative.sync_failed", 
    "creative.rejected"
  ],
  unreadOnly: true
});

// Get high-priority cross-campaign notifications
const urgent = await getNotifications({
  urgency: "high",
  acknowledged: false
});
```

## Performance Considerations

- **Deduplication**: Similar notifications within 5-minute windows are deduplicated
- **Retention**: Notifications are automatically cleaned up after 30 days
- **Batching**: Related notifications (e.g., multiple creative sync failures) can be batched
- **Indexing**: Notifications are indexed by `customerId`, `brandAgentId`, and `type` for fast filtering

This framework enables agents to build sophisticated workflows around creative sync events while maintaining simple, actionable notification structures.