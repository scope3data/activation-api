#!/bin/bash

# Local CI Simulation Script
# This script runs the same checks as CI to catch issues before pushing

set -e  # Exit on error

echo "🔍 Starting local CI simulation..."

# Check Node version matches .nvmrc
REQUIRED_NODE=$(cat .nvmrc)
CURRENT_NODE=$(node -v | sed 's/v//' | cut -d. -f1)

if [ "$CURRENT_NODE" != "$REQUIRED_NODE" ]; then
  echo "❌ Node version mismatch!"
  echo "   Required: v$REQUIRED_NODE (from .nvmrc)"
  echo "   Current:  v$CURRENT_NODE"
  echo ""
  echo "   Please run: nvm use"
  exit 1
fi

echo "✅ Node version: v$CURRENT_NODE"

# Clean install (like CI)
echo "📦 Installing dependencies (npm ci)..."
npm ci

# Run build (includes OpenAPI generation)
echo "🔨 Building project..."
npm run build

# Run linting
echo "🎨 Running linters..."
npm run lint

# Run tests
echo "🧪 Running tests..."
npm test

# Check documentation links (using local Mintlify)
echo "📖 Checking documentation links..."
BROKEN_LINKS_OUTPUT=$(npm run docs:validate:links 2>&1)

# Filter out API reference false positives (Mintlify tool issue)
NON_API_BROKEN_LINKS=$(echo "$BROKEN_LINKS_OUTPUT" | grep -v "/api-reference/" || true)

if echo "$NON_API_BROKEN_LINKS" | grep -q " ⎿ "; then
  echo "❌ Non-API reference broken links detected!"
  echo "Please fix these broken links (excluding known API reference false positives):"
  echo "$NON_API_BROKEN_LINKS"
  exit 1
fi

# Count total API reference false positives for informational purposes
API_FALSE_POSITIVES=$(echo "$BROKEN_LINKS_OUTPUT" | grep -c "/api-reference/" || echo "0")
if [ "$API_FALSE_POSITIVES" -gt 0 ]; then
  echo "ℹ️  Note: $API_FALSE_POSITIVES API reference links flagged as broken (likely false positives)"
fi

echo "✅ Documentation links checked - no non-API broken links found"

# Check for OpenAPI drift
echo "📋 Checking OpenAPI consistency..."
ORIGINAL_OPENAPI=$(cat openapi.yaml)
npm run generate:openapi
NEW_OPENAPI=$(cat openapi.yaml)

if [ "$ORIGINAL_OPENAPI" != "$NEW_OPENAPI" ]; then
  echo "❌ OpenAPI drift detected!"
  echo "   The generated OpenAPI differs from the committed version."
  echo "   Please commit the changes to openapi.yaml"
  exit 1
fi

echo "✅ OpenAPI is consistent"

# Security audit (non-blocking, just informational)
echo "🔒 Running security audit..."
npm audit --audit-level=moderate || true

echo ""
echo "🎉 Local CI simulation passed! Safe to push."