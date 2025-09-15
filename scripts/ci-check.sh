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

# Check documentation links (using local Mintlify + smart API validation)
echo "📖 Checking documentation links..."
BROKEN_LINKS_OUTPUT=$(npm run docs:validate:links 2>&1)

# Filter out API reference links for separate validation
NON_API_BROKEN_LINKS=$(echo "$BROKEN_LINKS_OUTPUT" | grep -v "/api-reference/" || true)

# Check non-API broken links
if echo "$NON_API_BROKEN_LINKS" | grep -q " ⎿ "; then
  echo "❌ Non-API reference broken links detected!"
  echo "Please fix these broken links:"
  echo "$NON_API_BROKEN_LINKS"
  exit 1
fi

# Smart validation of API reference links
echo "🔗 Validating API reference links..."
if ! npm run docs:validate:api-links; then
  echo "⚠️  Some API reference links are broken, but not blocking CI yet"
  echo "   These need to be fixed: see the report above"
  echo "   Future versions may block CI on these issues"
else
  echo "✅ All API reference links working"
fi

echo "✅ Documentation links checked - core navigation working"

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