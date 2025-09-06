# Google Cloud Run Deployment Setup

This guide walks you through setting up automatic deployment to Google Cloud Run using GitHub integration and Buildpacks.

## Prerequisites

- Google Cloud Project with billing enabled
- Cloud Run API enabled
- Repository pushed to GitHub
- Google Cloud Console access

## Step 1: Enable Required APIs

In Google Cloud Console, enable these APIs:
- Cloud Run Admin API
- Cloud Build API
- Artifact Registry API (if using custom images)

## Step 2: Set Up Cloud Run Service

1. Go to Google Cloud Console → Cloud Run
2. Click "Create Service"
3. Select "Continuously deploy from a repository"
4. Click "Set up with Cloud Build"

## Step 3: Connect GitHub Repository

1. Select "GitHub" as the source
2. Authenticate with GitHub if needed
3. Select your repository: `conductor/activation-api`
4. Choose branch: `main`

## Step 4: Configure Build Settings

1. **Build Type**: Select "Buildpack" (recommended)
2. **Build Context**: Leave as root directory
3. **Entry Point**: Will be auto-detected from package.json

## Step 5: Configure Service Settings

### Basic Settings
- **Service Name**: `scope3-campaign-api` (or your preferred name)
- **Region**: Choose your preferred region (e.g., `us-central1`)

### Environment Variables (Optional)
Add these optional environment variables:
- `SCOPE3_GRAPHQL_URL`: https://api.scope3.com/graphql (if different)
- `NODE_ENV`: production

**Important**: API keys are NOT stored as environment variables. They must be provided by clients in HTTP headers.

### Scaling Settings (Recommended)
- **Minimum instances**: 0 (scales to zero when no traffic)
- **Maximum instances**: 10 (adjust based on expected load)
- **CPU allocation**: CPU is only allocated during request processing
- **Memory**: 512 MB (increase if needed)

### Security Settings
- **Allow unauthenticated invocations**: Enable (for public API access)
- Or configure authentication based on your needs

## Step 6: Deploy

1. Click "Create" to set up the service
2. Cloud Run will automatically trigger a build from your main branch
3. Monitor the build in Cloud Build logs

## Step 7: Verify Deployment

Once deployed, your service will be available at:
```
https://YOUR_SERVICE_NAME-PROJECT_ID-REGION.a.run.app
```

### Test the MCP Server
```bash
# Test with API key in headers
curl -H "x-scope3-api-key: YOUR_API_KEY" https://YOUR_SERVICE_URL/mcp

# Or using Bearer token
curl -H "Authorization: Bearer YOUR_API_KEY" https://YOUR_SERVICE_URL/mcp
```

## Ongoing Deployment

After initial setup:
1. Push changes to the `main` branch
2. Cloud Run automatically detects changes
3. Builds new container using Buildpacks
4. Deploys new version with zero-downtime rollout
5. Automatically rolls back if health checks fail

## Monitoring and Logs

### View Logs
```bash
# Using gcloud CLI
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=YOUR_SERVICE_NAME"

# Or in Google Cloud Console → Cloud Run → Your Service → Logs
```

### Monitoring Metrics
- Request count and latency
- Error rates
- Memory and CPU usage
- Instance scaling events

## Troubleshooting

### Build Failures
- Check Cloud Build logs in Google Cloud Console
- Verify all dependencies in package.json
- Ensure start script is defined

### Runtime Issues
- Check Cloud Run logs
- Verify environment variables are set
- Check that PORT environment variable is handled correctly

### Authentication Issues
- Verify API key is sent in request headers (x-scope3-api-key or Authorization: Bearer)
- Check API key permissions in Scope3 dashboard
- API keys are never stored on the server - they must come from client requests

## Cost Optimization

- Service scales to zero when not in use
- You're only charged for request processing time
- Consider setting appropriate CPU and memory limits
- Use minimum instances only if you need sub-second response times

## Security Best Practices

- API keys are only passed through HTTP headers, never stored server-side
- Enable Cloud Run security features if needed
- Regularly rotate API keys
- Consider rate limiting for production use

## Rollback

If you need to rollback a deployment:
1. Go to Cloud Console → Cloud Run → Your Service
2. Click "Manage Traffic"
3. Allocate 100% traffic to a previous revision
4. Or use gcloud CLI:
   ```bash
   gcloud run services update-traffic YOUR_SERVICE_NAME --to-revisions=REVISION_NAME=100
   ```