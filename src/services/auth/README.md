# Authentication Handlers

This directory contains authentication handlers for different authentication mechanisms used by sales agents and other external services.

## Architecture

The authentication system is built around the `AuthHandler` interface, which provides a consistent way to handle different authentication types.

### Core Components

- **`auth-handler.interface.ts`** - Base interface that all auth handlers implement
- **`types.ts`** - Type definitions for all supported authentication configurations
- **`yahoo-jwt-handler.ts`** - Handler for Yahoo's JWT-based authentication

### Interface Overview

All authentication handlers implement the `AuthHandler` interface:

```typescript
interface AuthHandler {
  getToken(agentId: string, config: AuthConfig): Promise<AuthToken>;
  refreshToken(agentId: string, config: AuthConfig): Promise<AuthToken>;
  clearCache(agentId: string): void;
  isTokenValid(token: AuthToken): boolean;
}
```

## Yahoo JWT Handler

The `YahooJWTHandler` implements Yahoo's custom JWT-based authentication flow:

1. **JWT Generation**: Creates a signed JWT using ES256 algorithm
2. **Token Exchange**: Exchanges the JWT for an OAuth2 access token
3. **Token Caching**: Caches tokens with automatic expiry handling
4. **Auto Refresh**: Automatically refreshes tokens before expiry

### Configuration

Yahoo JWT authentication requires this configuration:

```typescript
interface YahooJWTConfig {
  type: "yahoo_jwt";
  privateKey: string; // PKCS8 format private key (PEM string)
  issuer: string; // e.g., "idb2b.monetization.scope3"
  subject: string; // e.g., "idb2b.monetization.scope3"
  keyId: string; // e.g., "0.0.1"
  scope: string; // e.g., "agentic-sales-client"
  environment?: "production" | "uat";
}
```

### Usage Example

```typescript
import { YahooJWTHandler } from "./yahoo-jwt-handler.js";

const handler = new YahooJWTHandler();
const config: YahooJWTConfig = {
  type: "yahoo_jwt",
  privateKey: process.env.YAHOO_PRIVATE_KEY_PKCS8!,
  issuer: "idb2b.monetization.scope3",
  subject: "idb2b.monetization.scope3",
  keyId: "0.0.1",
  scope: "agentic-sales-client",
  environment: "production",
};

// Get token (cached if available and valid)
const token = await handler.getToken("agent-id", config);

// Use token for API calls
const headers = handler.getAuthHeaders(token);
```

## Integration with Sales Agents

Authentication configuration is stored in the sales agent's config field:

```json
{
  "auth_type": "yahoo_jwt",
  "auth_config": {
    "private_key": "-----BEGIN PRIVATE KEY-----\\n...",
    "issuer": "idb2b.monetization.scope3",
    "subject": "idb2b.monetization.scope3",
    "key_id": "0.0.1",
    "scope": "agentic-sales-client",
    "environment": "production"
  }
}
```

## Testing

### Demo Testing (No Credentials Required)

```bash
tsx scripts/demo-yahoo-auth.ts
```

This validates the code structure and error handling without real credentials.

### Full Testing (Requires Credentials)

Option 1: Using environment variables

```bash
# Get PKCS8 private key
export YAHOO_PRIVATE_KEY_PKCS8="$(op read 'op://Engineering/Yahoo AdCP keys/private_key' | openssl pkcs8 -topk8 -nocrypt)"

# Run test
tsx scripts/test-yahoo-auth.ts production
```

Option 2: Using 1Password CLI directly

```bash
# Ensure 1Password CLI is authenticated
op account list

# Run test (will fetch key from 1Password)
tsx scripts/test-yahoo-auth.ts production
```

## Security Considerations

- **Private Keys**: Never commit private keys to version control
- **Token Caching**: Tokens are cached in memory only (cleared on restart)
- **Token Expiry**: 5-minute buffer before actual expiry for proactive refresh
  - Example: 6-hour token → cached for 5h 55m → refreshed 5 minutes before expiry
  - Prevents tokens expiring mid-request
- **Error Handling**: Failed auth attempts are logged but tokens are never logged

## Adding New Authentication Types

1. Define the configuration interface in `types.ts`
2. Create a handler class implementing `AuthHandler`
3. Add the new config type to `SupportedAuthConfig` union
4. Register the handler in the main authentication service

Example structure:

```typescript
// types.ts
interface CustomAuthConfig extends AuthConfig {
  type: "custom_auth";
  // ... custom fields
}

// custom-auth-handler.ts
class CustomAuthHandler implements AuthHandler {
  async getToken(
    agentId: string,
    config: CustomAuthConfig,
  ): Promise<AuthToken> {
    // Implementation
  }
  // ... other methods
}
```
