# Scope3 Campaign API MCP Server

**Model Context Protocol (MCP) server for programmatic advertising campaign management**

This is an MCP server that provides AI agents with tools for creating and managing programmatic advertising campaigns through the Scope3 platform.

## Quick Start

### Prerequisites

- Node.js 22+
- Scope3 API key ([Get one here](https://app.scope3.com/api-keys))

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The MCP server runs on `http://localhost:3001/mcp` by default.

### Authentication

Include your Scope3 API key in requests:

```bash
curl -H "x-scope3-api-key: your_api_key" http://localhost:3001/mcp
```

## Development

### Available Scripts

```bash
# Development with hot reload
npm run dev

# Production build
npm run build

# Start production server
npm start

# Run tests
npm test

# Run local CI validation (build + lint + test)
npm run ci:local

# Documentation development
npm run docs:dev

# Validate documentation links
npm run docs:validate:links
```

### Project Structure

```
├── src/                 # MCP server implementation
├── mintlify/            # User documentation (Mintlify)
├── docs/                # Developer documentation
├── scripts/             # Build and validation scripts
└── openapi.yaml         # Auto-generated API specification
```

## MCP Integration

This server implements the Model Context Protocol for AI agent integration:

### With Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "scope3-campaign-api": {
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

### With Other MCP Clients

Connect to the server endpoint with proper authentication headers.

## Documentation

**For Users**: Visit the [complete documentation](https://docs.agentic.scope3.com) for API usage, examples, and guides.

**For Developers**: See the `/docs` directory for implementation details.

## Core Capabilities

- **Brand Agent Management** - Create advertiser accounts
- **Campaign Management** - Launch and optimize campaigns
- **Creative Management** - Upload and manage ad creatives
- **Inventory Control** - Configure targeting and budget allocation
- **Reporting & Analytics** - Campaign performance insights

## Support

- **API Issues**: Check your API key and server logs
- **Documentation**: Visit [docs.agentic.scope3.com](https://docs.agentic.scope3.com)
- **Feature Requests**: Submit GitHub issues

---

**Built for AI-powered advertising workflows**
