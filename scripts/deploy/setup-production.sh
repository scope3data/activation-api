#!/bin/bash

# Production deployment setup for Cloud Run
# This script sets up GCS, secrets, and service accounts properly for production

set -e

# Configuration (using existing production setup)
PROJECT_ID="${PROJECT_ID:-swift-catfish-337215}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="scope3-upload-assets"
BUCKET_NAME="scope3-assets-swift-catfish"  # Using existing bucket
SERVICE_ACCOUNT_NAME="asset-upload-service"  # Using existing service account

echo "🚀 Setting up production deployment for ${SERVICE_NAME}"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"

# Enable required APIs
echo "📡 Enabling required Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  storage-api.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  --project="${PROJECT_ID}"

# Verify existing GCS bucket
echo "🪣 Verifying existing GCS bucket..."
if gsutil ls "gs://${BUCKET_NAME}" >/dev/null 2>&1; then
  echo "✅ GCS bucket gs://${BUCKET_NAME} already exists and is accessible"
else
  echo "❌ GCS bucket gs://${BUCKET_NAME} not found. Please run scripts/setup/setup-gcs.sh first"
  exit 1
fi

# Verify existing service account
echo "👤 Verifying existing service account..."
if gcloud iam service-accounts describe "${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "✅ Service account ${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com already exists"
else
  echo "❌ Service account not found. Please run scripts/setup/setup-gcs.sh first"
  exit 1
fi

# Ensure service account has Cloud Run permissions
echo "🔐 Ensuring service account has Cloud Run permissions..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None || echo "Permission already exists"

# Create secrets in Secret Manager (you'll need to add the actual values)
echo "🔑 Creating secrets in Secret Manager..."

# PostHog API Key
echo "Creating PostHog API key secret..."
echo -n "YOUR_POSTHOG_API_KEY" | gcloud secrets create posthog-api-key \
  --data-file=- \
  --project="${PROJECT_ID}" || echo "PostHog secret already exists"

# Scope3 API Key
echo "Creating Scope3 API key secret..."
echo -n "YOUR_SCOPE3_API_KEY" | gcloud secrets create scope3-api-key \
  --data-file=- \
  --project="${PROJECT_ID}" || echo "Scope3 secret already exists"

# Build and deploy container
echo "🏗️  Building container image..."
gcloud builds submit \
  --tag="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest" \
  --project="${PROJECT_ID}"

# Deploy to Cloud Run
echo "🚢 Deploying to Cloud Run..."

# Replace placeholders in cloud-run.yaml
sed "s/PROJECT_ID/${PROJECT_ID}/g" scripts/deploy/cloud-run.yaml > /tmp/cloud-run-${PROJECT_ID}.yaml

gcloud run services replace /tmp/cloud-run-${PROJECT_ID}.yaml \
  --region="${REGION}" \
  --project="${PROJECT_ID}"

# Get the service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(status.url)")

echo "✅ Deployment complete!"
echo ""
echo "🌐 Service URL: ${SERVICE_URL}"
echo "🪣 GCS Bucket: gs://${BUCKET_NAME}"
echo "👤 Service Account: ${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
echo ""
echo "📋 Next steps:"
echo "1. Update the secret values with your actual API keys:"
echo "   gcloud secrets versions add posthog-api-key --data-file=- --project=${PROJECT_ID}"
echo "   gcloud secrets versions add scope3-api-key --data-file=- --project=${PROJECT_ID}"
echo ""
echo "2. Test the health endpoint:"
echo "   curl ${SERVICE_URL}/health"
echo ""
echo "3. Test asset upload:"
echo "   curl -X POST ${SERVICE_URL}/mcp \\
  -H 'Content-Type: application/json' \\
  -H 'x-scope3-api-key: YOUR_API_KEY' \\
  -d '{\"method\": \"call\", \"params\": {\"name\": \"assets_upload\", \"arguments\": {...}}}'
echo ""

# Cleanup temporary file
rm -f /tmp/cloud-run-${PROJECT_ID}.yaml

echo "🎉 Production setup complete!"