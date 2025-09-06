# CI/Local Environment Parity Guide

## Overview

This guide explains how we ensure consistency between local development and CI environments to prevent "works on my machine" issues.

## 🎯 Key Components

### 1. Node.js Version Locking (`.nvmrc`)

We use a `.nvmrc` file to lock the Node.js version across all environments:

```bash
# Switch to the correct Node version
nvm use

# Verify you're on the right version
node --version  # Should match .nvmrc (currently v22)
```

**Why this matters:** Different Node.js versions can produce subtly different output in:

- TypeScript compilation
- YAML serialization
- Prettier formatting
- Package resolution

### 2. Local CI Simulation (`npm run ci:local`)

Before pushing code, run the same checks that CI will run:

```bash
npm run ci:local
```

This script:

- ✅ Verifies Node.js version matches `.nvmrc`
- ✅ Performs clean install (`npm ci`)
- ✅ Runs build process (including OpenAPI generation)
- ✅ Executes all linters
- ✅ Runs all tests
- ✅ Checks for OpenAPI drift
- ✅ Performs security audit

### 3. Pre-Push Protection

Git hooks automatically run CI checks before pushing:

```bash
# Normal push (runs CI checks)
git push

# Emergency skip (use sparingly!)
SKIP_PRE_PUSH=1 git push
```

### 4. CI Configuration

All GitHub Actions workflows use `.nvmrc` for Node version:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version-file: ".nvmrc"
```

## 🚨 Common Issues and Solutions

### Issue: "OpenAPI drift detected"

**Cause:** Generated OpenAPI differs from committed version.

**Solution:**

```bash
npm run generate:openapi
npm run format
git add openapi.yaml
git commit -m "Update generated OpenAPI spec"
```

### Issue: "Node version mismatch"

**Cause:** Local Node version doesn't match `.nvmrc`.

**Solution:**

```bash
nvm use            # Switch to correct version
npm ci             # Reinstall dependencies
npm run ci:local   # Verify everything works
```

### Issue: "Prettier formatting errors"

**Cause:** Different Node/Prettier versions format differently.

**Solution:**

```bash
nvm use           # Ensure correct Node version
npm ci            # Clean install dependencies
npm run format    # Fix formatting
```

## 📋 Checklist for New Developers

- [ ] Install `nvm` (Node Version Manager)
- [ ] Run `nvm use` in the project directory
- [ ] Run `npm ci` (not `npm install`)
- [ ] Test with `npm run ci:local`
- [ ] Enable git hooks with `npx husky install`

## 🔧 Best Practices

1. **Always use `npm ci` in scripts** - Never `npm install` in CI/automation
2. **Update `.nvmrc` when upgrading Node** - Keep it in sync with CI
3. **Run `ci:local` before creating PRs** - Catch issues early
4. **Don't skip pre-push hooks frequently** - They're there to help
5. **Keep dependencies locked** - Commit `package-lock.json` changes

## 🚀 Quick Commands

```bash
# Setup environment
nvm use && npm ci

# Verify everything works
npm run ci:local

# Fix common issues
npm run format      # Fix formatting
npm run generate:openapi  # Regenerate OpenAPI
npm test -- --watch # Debug failing tests

# Check what CI will run
cat scripts/ci-check.sh
```

## 📊 Environment Validation

Run this to validate your environment:

```bash
node -v | grep -q "$(cat .nvmrc)" && echo "✅ Node version correct" || echo "❌ Wrong Node version"
npm -v | grep -q "^10\." && echo "✅ npm version correct" || echo "⚠️ npm version may differ"
test -f node_modules/.package-lock.json && echo "✅ Dependencies installed with npm ci" || echo "❌ Run npm ci"
```

## 🔍 Debugging CI Failures

If CI passes locally but fails in GitHub Actions:

1. Check the exact Node version in CI logs
2. Ensure you're using `npm ci` not `npm install`
3. Verify no uncommitted changes with `git status`
4. Run `npm run ci:local` one more time
5. Compare your package-lock.json with the one in the PR

## 📚 References

- [Node Version Manager (nvm)](https://github.com/nvm-sh/nvm)
- [npm ci vs npm install](https://docs.npmjs.com/cli/v8/commands/npm-ci)
- [GitHub Actions setup-node](https://github.com/actions/setup-node)
- [Husky Git Hooks](https://typicode.github.io/husky/)
