#!/bin/bash

# Scope3 Asset Upload - GCS Setup Script
# This script sets up Google Cloud Storage for creative asset uploads

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI is not installed. Please install it first:"
        echo "https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    
    if ! command -v gsutil &> /dev/null; then
        log_error "gsutil is not installed. Please install Google Cloud SDK first."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Get configuration from user
get_configuration() {
    log_info "Getting configuration..."
    
    # Project ID
    if [ -z "$PROJECT_ID" ]; then
        echo -n "Enter your Google Cloud Project ID: "
        read PROJECT_ID
    fi
    
    if [ -z "$PROJECT_ID" ]; then
        log_error "Project ID is required"
        exit 1
    fi
    
    # Bucket name
    if [ -z "$BUCKET_NAME" ]; then
        BUCKET_NAME="scope3-creative-assets-${PROJECT_ID}"
        echo -n "Enter bucket name (default: $BUCKET_NAME): "
        read USER_BUCKET_NAME
        if [ ! -z "$USER_BUCKET_NAME" ]; then
            BUCKET_NAME="$USER_BUCKET_NAME"
        fi
    fi
    
    # Service account name
    if [ -z "$SERVICE_ACCOUNT_NAME" ]; then
        SERVICE_ACCOUNT_NAME="asset-upload-service"
    fi
    
    echo
    log_info "Configuration:"
    echo "  Project ID: $PROJECT_ID"
    echo "  Bucket Name: $BUCKET_NAME"
    echo "  Service Account: $SERVICE_ACCOUNT_NAME"
    echo
    
    echo -n "Continue with this configuration? (y/N): "
    read CONFIRM
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        log_info "Setup cancelled"
        exit 0
    fi
}

# Set active project
set_project() {
    log_info "Setting active project to $PROJECT_ID..."
    gcloud config set project "$PROJECT_ID"
    log_success "Project set to $PROJECT_ID"
}

# Create GCS bucket
create_bucket() {
    log_info "Creating GCS bucket: gs://$BUCKET_NAME..."
    
    # Check if bucket already exists
    if gsutil ls -b gs://"$BUCKET_NAME" &> /dev/null; then
        log_warning "Bucket gs://$BUCKET_NAME already exists"
    else
        gsutil mb -p "$PROJECT_ID" gs://"$BUCKET_NAME"
        log_success "Bucket created: gs://$BUCKET_NAME"
    fi
    
    # Set public read access
    log_info "Setting public read access..."
    gsutil iam ch allUsers:objectViewer gs://"$BUCKET_NAME"
    log_success "Public read access enabled"
}

# Create service account
create_service_account() {
    log_info "Creating service account: $SERVICE_ACCOUNT_NAME..."
    
    SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
    
    # Check if service account already exists
    if gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" &> /dev/null; then
        log_warning "Service account $SERVICE_ACCOUNT_EMAIL already exists"
    else
        gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
            --description="Service account for creative asset uploads" \
            --display-name="Asset Upload Service"
        log_success "Service account created: $SERVICE_ACCOUNT_EMAIL"
    fi
    
    # Grant Storage Admin role
    log_info "Granting Storage Admin role..."
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
        --role="roles/storage.admin"
    log_success "Storage Admin role granted"
    
    # Create and download key
    log_info "Creating service account key..."
    CREDENTIALS_FILE="./gcs-credentials.json"
    
    if [ -f "$CREDENTIALS_FILE" ]; then
        log_warning "Credentials file already exists: $CREDENTIALS_FILE"
        echo -n "Overwrite? (y/N): "
        read OVERWRITE
        if [ "$OVERWRITE" != "y" ] && [ "$OVERWRITE" != "Y" ]; then
            log_info "Skipping key creation"
            return
        fi
    fi
    
    gcloud iam service-accounts keys create "$CREDENTIALS_FILE" \
        --iam-account="$SERVICE_ACCOUNT_EMAIL"
    log_success "Service account key saved to: $CREDENTIALS_FILE"
}

# Create environment file
create_env_file() {
    log_info "Creating environment configuration..."
    
    ENV_FILE=".env"
    
    if [ -f "$ENV_FILE" ]; then
        log_warning "Environment file already exists: $ENV_FILE"
        echo -n "Overwrite? (y/N): "
        read OVERWRITE
        if [ "$OVERWRITE" != "y" ] && [ "$OVERWRITE" != "Y" ]; then
            log_info "Skipping environment file creation"
            return
        fi
    fi
    
    cat > "$ENV_FILE" << EOF
# Scope3 Campaign API - Environment Configuration
# Generated by setup-gcs.sh on $(date)

# ========================================
# Authentication (Required)
# ========================================

# Scope3 API Key (required for all operations)
SCOPE3_API_KEY=your-api-key-here

# Customer ID (required for testing)
CUSTOMER_ID=12345

# ========================================
# Google Cloud Storage Configuration
# ========================================

# GCS Project ID
GCS_PROJECT_ID=$PROJECT_ID

# GCS Bucket Name for storing creative assets
GCS_BUCKET_NAME=$BUCKET_NAME

# Path to service account credentials JSON file
GOOGLE_APPLICATION_CREDENTIALS=./gcs-credentials.json

# ========================================
# Testing Configuration
# ========================================

# Test buyer agent ID (for upload tests)
TEST_BUYER_AGENT_ID=agent-001
EOF
    
    log_success "Environment file created: $ENV_FILE"
    log_warning "Remember to update SCOPE3_API_KEY with your actual API key!"
}

# Test setup
test_setup() {
    log_info "Testing setup..."
    
    # Test authentication
    log_info "Testing service account authentication..."
    gcloud auth activate-service-account --key-file=./gcs-credentials.json
    
    # Test bucket access
    log_info "Testing bucket access..."
    gsutil ls gs://"$BUCKET_NAME" > /dev/null
    log_success "Bucket access test passed"
    
    # Create test object
    log_info "Creating test object..."
    echo "Test upload at $(date)" | gsutil cp - gs://"$BUCKET_NAME"/test.txt
    
    # Test public access
    log_info "Testing public access..."
    TEST_URL="https://storage.googleapis.com/$BUCKET_NAME/test.txt"
    if curl -s "$TEST_URL" > /dev/null; then
        log_success "Public access test passed"
        log_info "Test URL: $TEST_URL"
    else
        log_error "Public access test failed"
    fi
    
    # Clean up test object
    gsutil rm gs://"$BUCKET_NAME"/test.txt
}

# Create CORS configuration
create_cors_config() {
    log_info "Creating CORS configuration..."
    
    CORS_FILE="cors-config.json"
    cat > "$CORS_FILE" << 'EOF'
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "POST", "PUT"],
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
EOF
    
    # Apply CORS configuration
    log_info "Applying CORS configuration to bucket..."
    gsutil cors set "$CORS_FILE" gs://"$BUCKET_NAME"
    log_success "CORS configuration applied"
}

# Main setup function
main() {
    echo
    log_info "Scope3 Asset Upload - GCS Setup"
    echo "=================================="
    echo
    
    check_prerequisites
    get_configuration
    set_project
    create_bucket
    create_service_account
    create_cors_config
    create_env_file
    test_setup
    
    echo
    log_success "GCS setup completed successfully!"
    echo
    log_info "Next steps:"
    echo "1. Update SCOPE3_API_KEY in .env file"
    echo "2. Run: npm install"
    echo "3. Test upload: node test-upload-local.js"
    echo
    log_info "Bucket URL: https://console.cloud.google.com/storage/browser/$BUCKET_NAME"
    log_info "Public URL format: https://storage.googleapis.com/$BUCKET_NAME/customers/{customerId}/brand-agents/{buyerAgentId}/assets/{assetId}.ext"
    echo
}

# Run main function
main "$@"