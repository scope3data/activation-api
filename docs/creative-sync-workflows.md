# Creative Sync Workflows

This document explains the enhanced creative sync system and how MCP tools now automatically manage creative distribution to sales agents.

## System Overview

The creative sync system automatically ensures that creatives are synced to and approved by all relevant sales agents before campaigns launch. Key features:

- **Automatic Sync Triggers** - Creative lifecycle events trigger smart syncs
- **Format-Aware Matching** - Video creatives only sync to video-capable sales agents  
- **Recent History Intelligence** - Auto-detects relevant sales agents based on 30-day activity
- **Campaign Health Tracking** - Real-time visibility into sync status across campaigns
- **Notification-Driven Workflows** - Actionable alerts for sync issues

## Core Concepts

### Sync Relationship Model
```
Brand Agent → Creative → Sales Agent
    ↓           ↓           ↓
 Advertiser   Ad Asset   Publisher
```

Each creative tracks sync status per sales agent independently, enabling:
- Granular approval tracking
- Selective re-sync when content changes
- Sales agent-specific rejection handling

### Smart Format Matching
```typescript
// Creative formats are matched to sales agent capabilities
creative = { format: "video/mp4" }
salesAgent = { supportedFormats: ["video/mp4", "video/webm"] }
// ✅ Match - sync will proceed

creative = { format: "video/mp4" } 
salesAgent = { supportedFormats: ["image/jpeg", "image/png"] }
// ❌ No match - sync will be skipped
```

## Enhanced Tool Workflows

### 1. Creative Update with Auto Re-sync

When creative content is updated, automatic re-sync ensures sales agents get the latest version:

```typescript
// Update creative content
await creativeUpdateTool.execute({
  creativeId: "creative_123",
  updates: {
    content: {
      htmlSnippet: "<div>Updated creative</div>",
      vastTag: "https://example.com/new-vast.xml"
    }
  }
});

// Automatic flow:
// 1. Creative updated successfully  
// 2. System identifies previously synced sales agents
// 3. Background re-sync triggered to those agents
// 4. Notifications sent if any re-sync failures occur
```

**Key Behaviors:**
- Only content changes trigger re-sync (not metadata updates)
- Only syncs to agents with previous "synced" status
- Re-sync failures don't block the creative update
- Users receive notifications about re-sync progress

### 2. Creative Assignment with Smart Sync

When creatives are assigned to campaigns, automatic sync to campaign's sales agents:

```typescript
// Assign creative to campaign
await creativeAssignTool.execute({
  creativeId: "creative_123", 
  campaignId: "campaign_456",
  buyerAgentId: "ba_789"
});

// Automatic flow:
// 1. Creative assigned to campaign
// 2. System gets campaign's active tactics  
// 3. Extracts sales agents from those tactics
// 4. Triggers sync to format-compatible agents
// 5. User receives confirmation of assignment + sync status
```

**Key Behaviors:**
- Only syncs to sales agents used by campaign's tactics
- Format compatibility checked before sync attempts
- Assignment succeeds even if sync setup fails
- Background sync doesn't block assignment response

### 3. Tactic Creation with Creative Sync

When new tactics are created, existing campaign creatives sync to the new sales agent:

```typescript
// Create new tactic
await createTacticTool.execute({
  name: "Mobile Video Tactic",
  campaignId: "campaign_456",
  mediaProductId: "mobile_video_product",
  // ... other tactic config
});

// Automatic flow:
// 1. Tactic created with sales agent (from media product)
// 2. System finds campaign's existing creatives
// 3. Filters for format-compatible creatives  
// 4. Syncs compatible creatives to new sales agent
// 5. Tactic ready for activation with pre-approved creatives
```

**Key Behaviors:**
- Only compatible creative formats are synced
- Sync happens in background after tactic creation
- Tactic creation succeeds regardless of sync status
- Sales agent ID extracted from media product or tactic

### 4. Manual Creative Sync with Smart Defaults

The dedicated sync tool provides flexibility with intelligent defaults:

```typescript
// Auto-detection (default behavior)
await creativeSyncSalesAgentsTool.execute({
  creativeId: "creative_123"
  // No explicit agents - system auto-detects based on:
  // - Recent 30-day tactic activity for this brand agent
  // - Creative format compatibility
  // - Active campaign sales agents
});

// Manual override
await creativeSyncSalesAgentsTool.execute({
  creativeId: "creative_123",
  salesAgentIds: ["agent_1", "agent_2", "agent_3"]
});

// Campaign-specific sync
await creativeSyncSalesAgentsTool.execute({
  creativeId: "creative_123", 
  campaignId: "campaign_456"
  // Only syncs to sales agents used by this campaign
});
```

## Campaign Health Patterns

### Health Status Integration

Campaign and creative listing tools now include sync health data:

```typescript
// campaign/list response includes health indicators
campaigns = [
  {
    id: "campaign_123",
    name: "Summer Campaign",
    syncHealth: {
      status: "healthy",        // healthy | warning | critical
      syncedTactics: 8,
      totalTactics: 8,
      approvedCreatives: 12,
      totalCreatives: 15,
      lastSyncIssue: null
    },
    notifications: {
      unread: 0,
      highPriority: 0
    }
  },
  {
    id: "campaign_456", 
    name: "Holiday Campaign",
    syncHealth: {
      status: "warning",
      syncedTactics: 3,
      totalTactics: 5,
      approvedCreatives: 8,
      totalCreatives: 12,
      lastSyncIssue: "2 tactics have creative sync failures"
    },
    notifications: {
      unread: 3,
      highPriority: 1  
    }
  }
]
```

### Creative Sync Status

Creative tools show detailed sync status:

```typescript
// creative/get response includes sync summary
creative = {
  id: "creative_123",
  name: "Video Creative",
  syncStatusSummary: {
    totalRelevantAgents: 8,
    approved: 6,
    pending: 1, 
    rejected: 1,
    lastSyncDate: "2024-01-15T14:30:00Z"
  },
  syncDetails: [
    {
      salesAgentId: "video_agent_1",
      salesAgentName: "Premium Video",
      status: "synced",
      approvalStatus: "approved",
      syncDate: "2024-01-15T14:30:00Z"
    },
    {
      salesAgentId: "video_agent_2", 
      salesAgentName: "Mobile Video",
      status: "synced",
      approvalStatus: "rejected",
      rejectionReason: "Creative resolution too low for mobile",
      syncDate: "2024-01-15T14:30:00Z"
    }
  ]
}
```

## Notification Integration

### Event-Driven Notifications

Each sync event generates appropriate notifications:

```typescript
// Creative content update → Re-sync → Notifications
{
  type: "creative.sync_started",
  data: {
    message: "Re-syncing updated creative to 5 sales agents",
    creativeId: "creative_123", 
    actionRequired: "Monitor for approval updates"
  }
}

// Sync failure → Actionable notification
{
  type: "creative.sync_failed",
  data: {
    message: "Creative sync failed: format not supported",
    creativeId: "creative_123",
    salesAgentId: "display_agent_456",
    rejectionReason: "Video format not supported by display agent",
    actionRequired: "Update creative format or exclude this agent"
  }
}

// Campaign health issue → High-priority notification  
{
  type: "campaign.creative_sync_unhealthy",
  data: {
    message: "Campaign has 3 tactics with sync failures", 
    campaignId: "campaign_456",
    actionRequired: "Review sync failures before campaign launch",
    urgency: "high"
  }
}
```

### Notification-Driven Workflows

Agents can build sophisticated workflows around these notifications:

```typescript
// Monitor for high-priority campaign issues
const urgentIssues = await getNotifications({
  types: ["campaign.creative_sync_unhealthy", "campaign.missing_creatives"],
  urgency: "high",
  acknowledged: false
});

// Handle creative sync failures systematically
const syncFailures = await getNotifications({
  type: "creative.sync_failed",
  unreadOnly: true
});

// Batch process by failure type
const formatIssues = syncFailures.filter(n => 
  n.data.rejectionReason?.includes("format")
);
const resolutionIssues = syncFailures.filter(n =>
  n.data.rejectionReason?.includes("resolution") 
);
```

## Best Practices

### For Campaign Managers

1. **Monitor Health Dashboards**: Use campaign/list to identify issues early
2. **Review Sync Failures**: Check notifications for systematic problems  
3. **Pre-sync for Launch**: Sync creatives well before campaign activation
4. **Format Optimization**: Ensure creative formats match target sales agents

### For Creative Operations

1. **Batch Updates**: Group creative updates to minimize re-sync overhead
2. **Format Planning**: Design creatives for maximum sales agent compatibility
3. **Approval Monitoring**: Track approval rates per sales agent to identify issues
4. **Rejection Analysis**: Use rejection patterns to improve creative strategy

### For System Integration

1. **Background Processing**: All sync operations happen asynchronously  
2. **Graceful Degradation**: Primary operations succeed even if sync fails
3. **Notification Acknowledgment**: Mark notifications as handled after resolution
4. **Performance Monitoring**: Track sync success rates and processing times

## Migration and Rollout

### Feature Adoption

The sync system is designed for gradual adoption:

1. **Phase 1**: Enhanced tools with automatic sync (current)
2. **Phase 2**: Campaign health dashboards and notifications  
3. **Phase 3**: Advanced agent workflows and bulk operations
4. **Phase 4**: Predictive sync optimization and ML-driven improvements

### Backward Compatibility  

All existing tool functionality remains unchanged:
- Creative updates still work without sync
- Campaign assignments still work without automatic sync
- Sync features are additive, not replacing existing workflows

This approach ensures smooth adoption while providing immediate value through intelligent automation.