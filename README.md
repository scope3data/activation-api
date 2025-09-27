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

Authentication is handled via environment variables for MCP client connections:

```bash
# Set your API key in environment
export SCOPE3_API_KEY="your_api_key"

# MCP clients connect to the server endpoint
# Server handles authentication internally using the API key
```

**Note**: This is an MCP server, not a REST API. Authentication is configured through MCP client setup, not HTTP headers.

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

### BigQuery Setup (Optional)

For backend development with BigQuery integration:

```bash
# Create BigQuery tables
bq query --project_id=bok-playground --use_legacy_sql=false < scripts/create-bigquery-tables.sql

# Seed demo data
tsx scripts/seed-bigquery-data.ts

# Test BigQuery integration
tsx scripts/test-bigquery-integration.ts
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
- **Campaign Management** - Launch and optimize campaigns (BigQuery backend)
- **Creative Management** - Upload and manage ad creatives with automated sync (BigQuery backend)
- **Asset Upload & Distribution** - GCS backend for creative assets with public URL generation
- **Creative Sync System** - Automatic creative distribution to sales agents with smart format matching
- **Tactic Management** - Configure targeting and budget allocation with auto-sync integration
- **Product Discovery** - Distributed inventory via MCP agent network
- **Notification Framework** - Real-time campaign health and sync status alerts
- **Reporting & Analytics** - Campaign performance insights with sync health tracking

## Asset Upload & Distribution via MCP Tools

This MCP server provides specialized tools for uploading creative assets to Google Cloud Storage (GCS) and distributing them to sales agents via public URLs.

**🔧 Available MCP Tools**:

- `assets_upload` - Upload base64-encoded assets with automatic validation
- `assets_list_uploads` - List uploaded assets with public URLs
- `assets_analytics` - View usage analytics and directory management

**📏 File Size Limits**:

- **Image**: 10MB maximum
- **Video**: 100MB maximum
- **Audio**: 50MB maximum
- **Logo**: 5MB maximum
- **Font**: 2MB maximum

### Quick Setup

Create `.env` file (copy from `.env.template`):

```env
# Required
SCOPE3_API_KEY=your-api-key-here
CUSTOMER_ID=12345

# GCS Configuration
GCS_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=scope3-creative-assets
GOOGLE_APPLICATION_CREDENTIALS=./gcs-credentials.json
```

### GCS Setup

**Automated Setup (Recommended):**

```bash
# Run the setup script
./scripts/setup/setup-gcs.sh
```

**Manual Setup:**

```bash
# Create bucket with public read access
export PROJECT_ID="your-project-id"
export BUCKET_NAME="scope3-creative-assets"

gsutil mb -p $PROJECT_ID gs://$BUCKET_NAME
gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME

# Create service account
gcloud iam service-accounts create asset-upload-service \
    --display-name="Asset Upload Service"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:asset-upload-service@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

# For local development, download credentials
gcloud iam service-accounts keys create ./secrets/gcs-credentials.json \
    --iam-account=asset-upload-service@$PROJECT_ID.iam.gserviceaccount.com
```

**🚨 For Production (Cloud Run):**

- **DO NOT** store credentials in files
- Use Cloud Run's [Secret Manager integration](https://cloud.google.com/run/docs/configuring/secrets)
- Service account should be attached to Cloud Run service directly

### MCP Tool Details

**`assets_upload`** - Primary upload tool

- Accepts base64-encoded file data (no data URI prefix)
- Validates file type and size constraints automatically
- Organizes assets hierarchically in GCS by customer/brand-agent
- Returns public URLs for immediate use
- Supports batch uploads (max 10 assets per request)

**`assets_list_uploads`** - Asset inventory management

- Lists all uploaded assets with metadata
- Provides public URLs for distribution
- Supports filtering by asset type and date ranges

**`assets_analytics`** - Usage tracking

- View upload statistics and storage usage
- Directory management and organization insights

### File Organization

Assets are organized hierarchically in GCS:

```
bucket-name/
└── customers/
    └── {customer-id}/
        └── brand-agents/
            └── {brand-agent-id}/
                └── assets/
                    ├── {uuid}.jpg
                    ├── {uuid}.mp4
                    └── {uuid}.png
```

### MCP Tool Usage Examples

**Upload Assets via MCP Client**:

```typescript
// Upload multiple assets via MCP tool
const result = await client.callTool({
  name: "assets_upload",
  arguments: {
    assets: [{
      assetType: "image",
      base64Data: "iVBORw0KGgoAAAANSUhEUgAA...", // No data URI prefix
      contentType: "image/png",
      filename: "hero-banner.png",
      metadata: {
        buyerAgentId: "123",
        tags: ["hero", "banner"]
      }
    }, {
      assetType: "video",
      base64Data: "UklGRr4..." // Base64 video data
      contentType: "video/mp4",
      filename: "product-demo.mp4",
      metadata: {
        buyerAgentId: "123",
        tags: ["demo", "product"]
      }
    }]
  }
});

// Response includes public URLs:
// {
//   "success": true,
//   "assets": [
//     {
//       "filename": "hero-banner.png",
//       "publicUrl": "https://storage.googleapis.com/bucket/customers/123/assets/uuid.png",
//       "assetId": "asset_abc123"
//     }
//   ]
// }
```

**List Uploaded Assets**:

```typescript
// List assets for a brand agent
const assets = await client.callTool({
  name: "assets_list_uploads",
  arguments: {
    buyerAgentId: "123", // Optional filter
    assetType: "image", // Optional filter
  },
});
```

````

### Testing

```bash
# Demo upload (simulation, no GCS required)
node examples/test-upload-demo.js

# Test real upload (requires GCS setup)
node scripts/examples/integration-test.js

# MCP over HTTP transport test (NOT REST API)
node examples/test-upload-http.js
````

**Important**: The HTTP test uses MCP over HTTP transport (SSE), not REST API calls. This demonstrates how MCP clients can connect over HTTP while still using the MCP protocol.

## Support

- **API Issues**: Check your API key and server logs
- **Documentation**: Visit [docs.agentic.scope3.com](https://docs.agentic.scope3.com)
- **Feature Requests**: Submit GitHub issues

---

**Built for AI-powered advertising workflows**
