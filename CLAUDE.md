# Scope3 Campaign API MCP Server

This is an MCP (Model Context Protocol) server that provides tools for creating and managing advertising campaigns through the Scope3 API. The server encapsulates complex multi-step workflows into simple, natural language interfaces.

## Available Tools

### 1. create_campaign

Creates a complete campaign by parsing natural language prompts and automatically generating strategy and targeting profiles.

**Parameters:**

- `name` (string, required): Name for the campaign strategy
- `prompt` (string, required): Natural language description of campaign objectives and strategy

**Usage Examples:**

- User: "Create a $50,000 CTV campaign for cat lovers in New York"
- User: "I need a premium display campaign targeting tech professionals in California, budget $25K"
- User: "Create a video campaign for luxury car brands, focusing on high-income demographics"

**Returns:** Text summary of created campaign including strategy ID, targeting profiles, and key details.

### 2. update_campaign

Updates an existing campaign strategy with new prompt and optional name change.

**Parameters:**

- `campaignId` (string, required): ID of the campaign to update
- `prompt` (string, required): New campaign prompt with updated objectives and strategy
- `name` (string, optional): New name for the campaign

**Usage Examples:**

- User: "Update campaign 12345 to target millennials instead of gen-z"
- User: "Change the budget to $75,000 and add premium inventory requirements for campaign abc-123"

**Returns:** Text summary of changes made to the campaign strategy.

### 3. check_auth

Verifies API key authentication status and returns user information.

**Parameters:** None

**Usage Examples:**

- User: "Am I authenticated?"
- User: "Check my login status"
- User: "What's my customer ID?"

**Returns:** Authentication status and customer information if authenticated.

### 4. get_amp_agents

Retrieves available AMP agents and their models from Scope3.

**Parameters:**

- `where` (object, optional): Filters for agents
  - `customerId` (number, optional): Filter by customer ID
  - `name` (string, optional): Filter by agent name (partial match)

**Usage Examples:**

- User: "Show me all available agents"
- User: "Find agents with 'brand' in the name"
- User: "Get agents for customer 12345"

**Returns:** List of available agents with their IDs, names, and model information.

## Authentication

All tools (except check_auth) require a Scope3 API key. Provide authentication via HTTP headers only:

- `x-scope3-api-key` header
- `Authorization: Bearer <api_key>` header

**Note**: API keys are never stored server-side and must be provided by the client in each request.

## Configuration

### Claude Desktop

This MCP server runs in HTTP mode only. Start the server:

```bash
npm start
```

The server will be available at `http://localhost:3001/mcp`.

**Authentication**: Include your Scope3 API key in requests:
```bash
curl -H "x-scope3-api-key: your_api_key" http://localhost:3001/mcp
```

### HTTP Mode

The server runs in HTTP mode by default:

```bash
npm start  # Starts on port 3001
```

Or specify a custom port:
```bash
PORT=8080 npm start
```

## Features

- **Encapsulated Workflows**: Single tool calls handle complex multi-step processes
- **Natural Language Processing**: Convert campaign descriptions into technical targeting profiles
- **INTELLIGENT_PMPS Strategy**: Uses Scope3's intelligent programmatic private marketplace strategy
- **Human-Readable Responses**: Returns text summaries instead of raw technical data
- **Error Handling**: Provides clear error messages for authentication and API issues

## Development

### Build and Test

```bash
npm run build    # Compile TypeScript
npm test        # Run tests
npm run lint    # Check code style
```

### Project Structure

- `src/tools/` - MCP tool implementations
- `src/client/` - Scope3 API client and GraphQL queries
- `src/types/` - TypeScript interfaces
- `src/utils/` - Shared utilities
- `openapi.yaml` - REST API specification
