# Scope3 Ad Platform

**The Ad Buying Platform for People & Agents**

🚀 Start Simple, Scale Sophisticated

Welcome to Scope3 - where campaigns are conversations and complexity is optional.

## Quick Start: Your First Campaign

```javascript
// Step 1: Create your advertiser (brand agent)
const advertiser = await create_brand_agent({
  name: "Acme Corp",
  description: "Sustainable fashion brand"
});

// Step 2: Add a creative
const creative = await create_creative({
  brandAgentId: advertiser.id,
  name: "Summer Sale Video",
  type: "video",
  url: "https://cdn.example.com/summer-sale.mp4"
});

// Step 3: Launch your campaign
await create_campaign({
  brandAgentId: advertiser.id,
  name: "Summer Sale 2024",
  prompt: "Reach eco-conscious millennials interested in sustainable fashion",
  budget: { 
    total: 50000,
    currency: "USD"
  },
  startDate: "2024-06-01",
  endDate: "2024-08-31",
  creativeIds: [creative.id]
});
```

**That's it. Our built-in optimization handles the rest.**

## Our Philosophy

### 1. People & Agents, Together

Your team and AI agents work side-by-side. Humans set strategy, agents execute tactics. Full transparency and control when you want it.

### 2. Allocation, Not Bidding

Unlike traditional DSPs with complex bidding algorithms, we focus on intelligent allocation - distributing your budget across the right inventory mix. Think portfolio management, not auction mechanics.

### 3. Works Alongside Your Stack

Run Scope3 in parallel with your existing platforms. Test new inventory sources, explore emerging channels, or optimize specific campaign types.

## Choose Your Optimization Approach

### 🎯 Built-in Optimization
**Perfect for: Teams seeking efficiency and simplicity**

```javascript
// We optimize inventory allocation automatically
await create_campaign({
  brandAgentId: "ba_123",
  name: "Brand Awareness Q4",
  prompt: "Maximize reach for our new product launch",
  budget: { 
    total: 100000,
    currency: "USD"
  },
  startDate: "2024-10-01",
  endDate: "2024-12-31"
  // inventoryManagement defaults to scope3_managed
});
```

**What we handle:**
- Inventory mix optimization
- Signal selection
- Budget allocation across publishers
- Performance-based rebalancing

### 🎛️ Granular Control
**Perfect for: Teams with specific strategies**

```javascript
// You control the inventory allocation
await create_campaign({
  brandAgentId: "ba_123",
  name: "Performance Campaign Q4",
  budget: { 
    total: 100000,
    currency: "USD"
  },
  inventoryManagement: {
    mode: "user_managed",
    optimizationGoal: "conversions"
  }
});

// Configure your inventory mix
await create_inventory_option({
  campaignId: "camp_123",
  name: "Premium CTV + 1P Data",
  mediaProductId: "hulu_premium_ctv",
  targeting: {
    signalType: "buyer"
  },
  budgetAllocation: { 
    amount: 40000,
    currency: "USD"
  }
});
```

## How We're Different

### Allocation vs. Bidding

Traditional DSPs focus on bid optimization - how much to pay for each impression. We focus on allocation optimization - where to spend your budget for maximum impact.

### Inventory as Building Blocks

Think of inventory options as building blocks for your campaign portfolio:

```javascript
// Build your campaign like a diversified portfolio
const portfolioApproach = [
  { name: "Premium CTV + Scope3 signals", allocation: "30%" },
  { name: "Programmatic display + 1P data", allocation: "40%" },
  { name: "Contextual targeting premium sites", allocation: "30%" }
];
```

## MCP: Built for AI Collaboration

### Natural Language, Real Actions

As an MCP (Model Context Protocol) server, Scope3 is designed for AI agents to work directly with humans:

```
Human: "Find me premium video inventory under $40 CPM"
AI Agent: → discover_publisher_products({ formats: ["video"], maxCpm: 40 })
```

**Human readable results:** AI agents get structured data, humans get clear insights.

## Available Tools

### Brand Agent Management
- `create_brand_agent` - Set up advertiser accounts
- `update_brand_agent` - Modify account settings  
- `list_brand_agents` - View all accounts

### Campaign Management
- `create_campaign` - Launch campaigns with smart defaults
- `update_campaign` - Modify campaigns and inventory
- `list_campaigns` - Track campaign performance

### Inventory Control
- `discover_publisher_products` - Find available inventory
- `create_inventory_option` - Configure custom allocation
- `adjust_inventory_allocation` - Optimize budget distribution
- `analyze_inventory_performance` - Get performance insights

### Creative Management
- `create_creative` - Upload creative assets
- `update_creative` - Modify creative details
- `list_creatives` - View creative library

[View complete tool documentation →](docs/tools/)

## Getting Started

### For Claude Users

Add this server to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "scope3-campaigns": {
      "command": "npm",
      "args": ["start"],
      "cwd": "/path/to/scope3-campaign-api",
      "env": {
        "SCOPE3_API_KEY": "your-api-key"
      }
    }
  }
}
```

### For Developers

This is an MCP server implementation that can be integrated with any MCP-compatible client.

#### Development Setup

**Prerequisites**: Node.js 22+

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Run local CI validation
npm run ci:local
```

#### Documentation Development

```bash
# Start documentation development server
npm run docs:dev

# Check for broken links in documentation
npm run docs:validate:links

# Full documentation validation (links + OpenAPI)
npm run docs:validate
```

**Prerequisites for documentation validation**: Install Mintlify CLI globally:
```bash
npm install -g mintlify
```

#### Production Setup

```bash
# Start the server
npm start
```

The server runs on `http://localhost:3001/mcp` by default.

**Authentication**: Include your Scope3 API key in requests:
```bash
curl -H "x-scope3-api-key: your_api_key" http://localhost:3001/mcp
```

## Architecture

### Brand Agent Model

```
BrandAgent (Advertiser/Account)
  ├── Campaigns (multiple, owned by brand agent)
  ├── Creatives (multiple, shared across campaigns)  
  ├── Standards (brand safety configuration)
  ├── SyntheticAudiences (multiple, shared across campaigns)
  └── MeasurementSources (tracking integrations)
```

### Inventory Options

Each **Inventory Option** combines:
- **Publisher Media Product** (raw inventory from AdCP)
- **Targeting Strategy** (signal type + configuration)  
- **Budget Allocation** (amount + pacing)

## Documentation

- [Complete Tool Reference](docs/tools/)
- [Architecture Guide](docs/architecture/)
- [MCP Integration](docs/mcp-integration/)
- [API Reference](docs/api/)

## Support

For questions or support:
- [GitHub Issues](https://github.com/anthropics/claude-code/issues)
- [Documentation](docs/)

---

**Built with ❤️ for the future of advertising**