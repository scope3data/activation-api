# MCP Integration Guide

The Scope3 Ad Platform is built as an MCP (Model Context Protocol) server, designed for seamless integration with AI agents and conversational interfaces.

## What is MCP?

[Model Context Protocol](https://modelcontextprotocol.io/) is an open standard for connecting AI agents to external systems and data sources. It enables AI assistants to:

- Execute functions with real-world effects
- Access structured data and APIs
- Maintain context across interactions
- Work with multiple tools simultaneously

For advertising teams, this means you can manage campaigns through natural language conversations with AI agents.

## Natural Language Campaign Management

### Conversational Workflow Examples

**Campaign Creation**

```
Human: "Create a brand awareness campaign for our new sustainable sneaker line, targeting eco-conscious millennials with a $75K budget"

AI Agent: I'll create that campaign for you. Let me set up:
→ create_brand_agent({ name: "EcoStep Footwear" })
→ create_campaign({
    brandAgentId: "ba_123",
    name: "Sustainable Sneaker Launch",
    prompt: "Target eco-conscious millennials interested in sustainable fashion and footwear",
    budget: { total: 75000, currency: "USD" }
  })

✅ Campaign created! Using built-in optimization to find the best inventory mix for eco-conscious millennials. Expected reach: 2.5M people.
```

**Inventory Discovery**

```
Human: "Find me premium CTV inventory under $35 CPM"

AI Agent: → discover_publisher_products({
    formats: ["video"],
    deliveryType: "ctv",
    maxCpm: 35,
    quality: "premium"
  })

Found 12 premium CTV options under $35 CPM:
📺 Hulu Premium CTV - $28 CPM, 85% completion rate
📺 Samsung TV Plus Premium - $32 CPM, viewability 95%
📺 Roku Premium Inventory - $30 CPM, brand-safe content
...
```

**Performance Analysis**

```
Human: "How is our sneaker campaign performing? Focus on CTV vs display"

AI Agent: → analyze_inventory_performance({
    campaignId: "camp_456",
    groupBy: ["format", "inventorySource"]
  })

📊 Performance Breakdown (Last 7 days):
CTV Inventory: $45K spent, 1.8M impressions, 0.85% CTR
Display Inventory: $22K spent, 3.2M impressions, 0.31% CTR

Recommendation: CTV is delivering 2.7x higher engagement. Consider shifting more budget to CTV formats.
```

## MCP Tools Overview

### Brand Agent Management

Tools for managing advertiser accounts and organizational structure.

| Tool                 | Purpose                    | Natural Language Examples               |
| -------------------- | -------------------------- | --------------------------------------- |
| `create_brand_agent` | Set up advertiser accounts | "Create an advertiser account for Nike" |
| `list_brand_agents`  | View all accounts          | "Show me all our advertiser accounts"   |
| `update_brand_agent` | Modify account details     | "Update the Nike account description"   |

### Campaign Lifecycle

Tools for creating, managing, and optimizing advertising campaigns.

| Tool              | Purpose                  | Natural Language Examples                      |
| ----------------- | ------------------------ | ---------------------------------------------- |
| `create_campaign` | Launch new campaigns     | "Create a $50K performance campaign for Q4"    |
| `update_campaign` | Modify running campaigns | "Increase the holiday campaign budget to $75K" |
| `list_campaigns`  | View campaign status     | "Show me all active campaigns for Nike"        |

### Inventory Management

Tools for discovering, configuring, and optimizing inventory allocation.

| Tool                            | Purpose                      | Natural Language Examples                 |
| ------------------------------- | ---------------------------- | ----------------------------------------- |
| `discover_publisher_products`   | Find available inventory     | "Find video inventory under $40 CPM"      |
| `create_inventory_option`       | Configure custom allocation  | "Add premium CTV with 1P data targeting"  |
| `adjust_inventory_allocation`   | Optimize budget distribution | "Move $10K from display to CTV"           |
| `analyze_inventory_performance` | Get performance insights     | "Show me performance by inventory source" |

### Creative Assets

Tools for managing creative assets and syncing them to sales agents.

| Tool                         | Purpose                        | Natural Language Examples                             |
| ---------------------------- | ------------------------------ | ----------------------------------------------------- |
| `create_creative`            | Upload creative assets         | "Add our new video creative for the holiday campaign" |
| `list_creatives`             | View creative library          | "Show me all video creatives for Nike"                |
| `update_creative`            | Modify creative details        | "Update the headline for the summer sale banner"      |
| `creative_sync_sales_agents` | Sync creatives to sales agents | "Sync this creative to relevant sales agents"         |
| `creative_assign`            | Assign creative to campaign    | "Assign creative cr_123 to campaign camp_456"         |

**Enhanced with Automatic Sync**: Creative operations now automatically trigger sync to sales agents when appropriate, ensuring creatives are distributed and approved before campaigns launch.

## Integration Patterns

### Claude Desktop Integration

Add Scope3 to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "scope3-campaigns": {
      "command": "npm",
      "args": ["start"],
      "cwd": "/path/to/scope3-campaign-api",
      "env": {
        "SCOPE3_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Custom AI Agent Integration

For custom agents, connect to the MCP server:

```python
import mcp

# Connect to Scope3 MCP server
client = mcp.Client("http://localhost:3001/mcp")

# Execute campaign creation
result = await client.call_tool("create_campaign", {
    "brandAgentId": "ba_123",
    "name": "AI-Managed Campaign",
    "prompt": "Optimize for brand awareness among tech professionals",
    "budget": {"total": 50000, "currency": "USD"}
})
```

### Multi-Agent Workflows

Different agents can specialize in different aspects:

```
Creative Agent: Manages creative assets and A/B testing
→ create_creative(), update_creative()

Campaign Manager Agent: Handles campaign setup and goals
→ create_campaign(), update_campaign()

Optimization Agent: Manages inventory and performance
→ discover_publisher_products(), adjust_inventory_allocation()

Reporting Agent: Provides insights and analysis
→ analyze_inventory_performance(), list_campaigns()
```

## Advanced MCP Features

### Context Preservation

The MCP server maintains context across interactions:

```
Session 1: Create campaign "camp_123"
Session 2: "Adjust that campaign's budget" → Knows to use "camp_123"
Session 3: "How is it performing?" → Analyzes performance for "camp_123"
```

### Structured Data Exchange

All tools return structured, AI-friendly data:

```json
{
  "success": true,
  "data": {
    "campaignId": "camp_123",
    "name": "Q4 Performance Campaign",
    "status": "active",
    "budget": {
      "total": 50000,
      "spent": 12500,
      "remaining": 37500,
      "currency": "USD"
    }
  },
  "humanReadable": "✅ Campaign 'Q4 Performance Campaign' created successfully with $50K budget. Currently active with $37.5K remaining."
}
```

### Error Handling

Clear error messages help agents understand and respond to issues:

```json
{
  "success": false,
  "error": "INSUFFICIENT_BUDGET",
  "message": "Budget allocation ($75,000) exceeds campaign total ($50,000)",
  "suggestions": [
    "Reduce individual allocations",
    "Increase campaign budget",
    "Remove some inventory options"
  ]
}
```

## Best Practices for AI Agents

### 1. Use Natural Language Processing

Convert human requests into structured tool calls:

```
Human: "I want to spend more on premium inventory"
↓
Agent Processing: Identify campaign, determine "premium" criteria, calculate budget shift
↓
Tool Call: adjust_inventory_allocation({
  campaignId: "current_campaign",
  adjustments: [{
    inventoryOptionId: "premium_options",
    budgetIncrease: calculated_amount
  }]
})
```

### 2. Provide Context-Rich Responses

Transform structured data into actionable insights:

```javascript
// Raw API Response
{
  "inventoryOptions": [
    {"name": "CTV Premium", "cpm": 28, "performance": 0.85},
    {"name": "Display Standard", "cpm": 12, "performance": 0.31}
  ]
}

// AI Agent Response
"Your CTV Premium inventory is performing 2.7x better than Display (0.85% vs 0.31% CTR),
but costs 2.3x more ($28 vs $12 CPM). The efficiency is worth the premium -
consider shifting more budget to CTV."
```

### 3. Suggest Next Actions

Help users understand their options:

```
After creating campaign:
"✅ Campaign created with built-in optimization.

Next steps:
• discover_publisher_products() - Explore specific inventory options
• create_creative() - Add creative assets
• analyze_inventory_performance() - Monitor performance after 48 hours"
```

### 4. Handle Complex Workflows

Break down complex requests into multiple tool calls:

```
Human: "Set up a complete campaign for our new product launch"

Agent Workflow:
1. create_brand_agent() - If needed
2. create_creative() - For launch assets
3. create_campaign() - Main campaign setup
4. create_inventory_option() - For specific inventory requirements
5. Provide launch checklist and monitoring plan
```

## Development and Testing

### Local Development

Start the MCP server locally:

```bash
npm run dev
```

Test tool calls directly:

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "x-scope3-api-key: your-key" \
  -d '{"tool": "create_campaign", "parameters": {...}}'
```

### Tool Testing

Test individual tools with sample data:

```javascript
// Test campaign creation
const result = await testTool("create_campaign", {
  brandAgentId: "test_brand_agent",
  name: "Test Campaign",
  prompt: "Test targeting tech enthusiasts",
  budget: { total: 10000, currency: "USD" },
});

console.log("Campaign created:", result.data.campaignId);
```

### Error Simulation

Test error handling:

```javascript
// Test insufficient budget error
const result = await testTool("create_inventory_option", {
  campaignId: "camp_123",
  budgetAllocation: { amount: 999999, currency: "USD" }, // Exceeds campaign budget
});

console.log("Error handled:", result.error);
```

## Security Considerations

### API Key Management

- Store API keys in environment variables, never in code
- Use different keys for development and production
- Rotate keys regularly
- Monitor API key usage

### Input Validation

All tool parameters are validated using Zod schemas:

```typescript
const CreateCampaignParams = z.object({
  brandAgentId: z.string(),
  name: z.string().min(1).max(100),
  budget: z.object({
    total: z.number().positive(),
    currency: z.string().length(3),
  }),
});
```

### Rate Limiting

The MCP server implements rate limiting to prevent abuse:

- 100 requests per minute per API key
- Burst protection for sudden spikes
- Graceful degradation with helpful error messages

---

_MCP integration makes sophisticated advertising operations accessible through natural language, enabling AI agents to work alongside human teams effectively._
