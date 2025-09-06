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

# Check documentation links (requires Mintlify CLI)
echo "📖 Checking documentation links..."
if command -v mintlify >/dev/null 2>&1; then
  npm run docs:validate:links
  echo "✅ Documentation links checked"
else
  echo "⚠️  Mintlify CLI not found - skipping documentation link check"
  echo "   Install with: npm install -g mintlify"
fi

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