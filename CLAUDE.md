# Scope3 Campaign API - Development Guidelines

## Project Overview

This is the Scope3 Campaign API MCP server with comprehensive brand agent management and dual-mode reporting capabilities. The API provides both conversational AI interactions and enterprise data integration.

## Architecture

### Core Components

- **Brand Agents**: Central advertiser accounts that own all resources
- **Campaigns**: Marketing initiatives with budgets and targeting
- **Creatives**: Reusable ad content assets
- **Reporting**: Dual-mode (conversational + structured data export)

### Tech Stack

- **Runtime**: Node.js with TypeScript
- **Protocol**: MCP (Model Context Protocol)
- **Documentation**: Mintlify with OpenAPI auto-generation
- **Backend**: Hybrid GraphQL + BigQuery architecture

### Backend Architecture

The server uses a **GraphQL-primary with BigQuery enhancement approach**:

- **GraphQL** (`https://api.scope3.com/api/graphql`): Primary data source for all core entities
  - Brand agents (`public_agent` table) - base brand agent data
  - Brand stories, brand standards, PMPs, measurement sources
  - Reliable, always-available API with authentication
- **BigQuery** (`bok-playground.agenticapi`): Customer-scoped extensions and advanced features
  - `brand_agent_extensions` - Extends `public_agent` with customer-scoped fields
  - `campaigns` - Campaign management with budget tracking
  - `creatives` - Creative assets with format/content metadata
  - Assignment mappings and relationships

**Architecture Pattern**:

1. **GraphQL First**: Query GraphQL for core entity data (reliable, authenticated)
2. **BigQuery Enhancement**: Add customer-scoped fields and advanced features when available
3. **No Fallbacks**: Each backend serves its specific architectural purpose - don't treat as backups

#### BigQuery Tables

- `brand_agent_extensions` - Extends GraphQL `public_agent` with customer-scoped fields
- `campaigns` - Campaign management with budget tracking
- `creatives` - Creative assets with format/content metadata
- `campaign_creatives` - Campaign-creative assignment mapping
- `campaign_brand_stories` - Campaign-brand story assignment mapping

#### Caching Layer

The server implements a comprehensive in-memory caching system to reduce BigQuery costs and improve response times:

**Architecture**:

- **Transparent Caching**: Drop-in replacement for BigQuery with same interface
- **TTL-Based Invalidation**: Configurable time-to-live for different data types
- **Race Condition Prevention**: Promise deduplication prevents duplicate queries
- **Customer Scoping**: Cache keys include customer identification for isolation
- **Background Preloading**: Common queries preloaded on customer authentication

**Cache Configuration** (`src/server.ts`):

```typescript
const cacheConfig = {
  ttl: {
    brandAgents: 300000, // 5 minutes - static advertiser data
    campaigns: 120000, // 2 minutes - config data (no delivery metrics)
    creatives: 300000, // 5 minutes - asset metadata
    default: 60000, // 1 minute - general queries
  },
};
```

**Performance Characteristics**:

- **Cache Hits**: ~100% speed improvement (sub-millisecond response)
- **Memory Management**: Automatic cleanup on TTL expiration
- **Hit Rate Tracking**: Monitoring for cache effectiveness
- **Pattern Invalidation**: Clear related entries on updates

#### Key Services

- **CachedBigQuery** (`src/services/cache/cached-bigquery.ts`) - In-memory caching wrapper for BigQuery
- **PreloadService** (`src/services/cache/preload-service.ts`) - Background preloading of common queries
- **CampaignBigQueryService** (`src/services/campaign-bigquery-service.ts`) - CRUD operations for BigQuery entities
- **BrandAgentService** (`src/services/brand-agent-service.ts`) - BigQuery extensions for brand agents
- **Scope3ApiClient** (`src/client/scope3-client.ts`) - GraphQL-primary with BigQuery enhancement

## Development Standards

### Code Quality

- Full TypeScript coverage - no `any` types
- Use `Record<string, unknown>` for flexible object types
- Zod schemas for parameter validation
- Consistent error handling patterns
- Human-readable response formatting

### Tool Patterns

All MCP tools should follow these patterns:

- Clear `verb_noun` naming (e.g., `create_brand_agent`)
- Comprehensive parameter validation
- Auth checking with environment fallback
- Rich text responses with formatting and insights
- Consistent error codes and messages

### API Integration

- Use existing GraphQL client patterns
- Separate brand agent queries in dedicated files
- Follow resource ownership model (brand agents own campaigns/creatives)
- Support both create/update patterns for assignments

### BigQuery Integration

- **Hybrid Routing**: Always try BigQuery first, fall back to GraphQL on failure
- **Type Safety**: Use proper TypeScript interfaces for BigQuery row structures
- **Error Handling**: Log BigQuery failures and gracefully fall back
- **Schema Changes**: Update both BigQuery tables and TypeScript interfaces
- **Setup Scripts**: Use `scripts/create-bigquery-tables.sql` for table creation
- **Testing**: Use `scripts/test-bigquery-integration.ts` for integration validation

### Caching Integration

- **Dependency Injection**: Services accept optional BigQuery instance for transparent caching
- **Fire-and-Forget Preloading**: Triggered on customer authentication, doesn't block responses
- **Cache Key Strategy**: Base64-encoded JSON with customer and query parameters
- **Invalidation Patterns**: Pattern-based cache clearing for updates (e.g., `brand_agent:123:*`)
- **Contract Compliance**: CachedBigQuery implements CacheService interface for testing
- **Environment Configuration**: TTL values configurable via environment variables

## Mintlify Documentation Standards

### Documentation Audience and Accuracy

- **Target audience**: Developers and coding agents
- **Tone**: Matter-of-fact, technical, precise
- **Accuracy requirement**: All information must be factual and verifiable
- Push back on ideas with reasoning - this leads to better documentation
- ALWAYS ask for clarification rather than making assumptions
- NEVER lie, guess, or make up information
- NEVER reference non-existent packages, tools, or features
- NEVER include inaccurate tool lists or capabilities

### Project Context

- Format: MDX files with YAML frontmatter
- Config: docs.json for navigation, theme, settings
- Components: Mintlify components (Note, Warning, Tip, CardGroup)
- **File Location**: All public documentation MUST be in the `mintlify/` directory

### Content Strategy

- Document just enough for user success - not too much, not too little
- Prioritize accuracy and usability of information
- Make content evergreen when possible
- Search for existing information before adding new content
- Check existing patterns for consistency
- Start by making the smallest reasonable changes

### docs.json Configuration

- Refer to the [docs.json schema](https://mintlify.com/docs.json) when building navigation
- Use tabs for major sections ("Guides", "API Reference")
- Organize content into logical groups within tabs
- Leverage OpenAPI auto-generation for API documentation - DON'T duplicate it

### Writing Standards

- Second-person voice ("you")
- Prerequisites at start of procedural content
- Test all code examples before publishing
- Match style and formatting of existing pages
- Include both basic and advanced use cases
- Language tags on all code blocks
- Alt text on all images
- Relative paths for internal links

### MCP Endpoint Guidelines

**CRITICAL: There are TWO different MCP endpoints with different purposes:**

1. **Documentation MCP Server**: `https://docs.agentic.scope3.com/mcp`
   - For interactive documentation and learning experiences
   - Use in tutorials, examples, and "try this out" scenarios
   - Provides demo tools and educational content
   - Safe for public examples and screenshots

2. **Production API MCP Server**: `https://api.agentic.scope3.com/mcp`
   - For actual campaign management and production use
   - Use in setup instructions, configuration examples
   - Requires proper authentication and API keys
   - Used for real campaign operations

**When to use which:**

- **Documentation endpoint**: Tutorial examples, demo scenarios, learning content
- **API endpoint**: Production setup guides, real configuration instructions, actual usage

### Documentation Don'ts

- Skip frontmatter on any MDX file
- Use absolute URLs for internal links
- Include untested code examples
- Make assumptions - always ask for clarification
- Duplicate API reference content (use OpenAPI auto-generation)
- Create excessive navigation depth
- **Confuse the two MCP endpoints** - always use the right one for the context
- Reference non-existent npm packages or dependencies
- Include inaccurate tool lists or feature claims
- Use marketing language or subjective claims without evidence

## Git Workflow

### Commit Standards

- NEVER use `--no-verify` when committing
- NEVER skip or disable pre-commit hooks
- Commit frequently throughout development
- Use descriptive commit messages explaining the "why"
- Include co-authoring for AI assistance

### Branch Management

- **NEVER push directly to main branch** - Always create feature branches
- Create new branches for feature work: `git checkout -b feature/description`
- Ask how to handle uncommitted changes before starting
- Use rebase for clean history when merging
- Test locally before pushing
- **Always create pull requests** for code review before merging to main
- **Production fixes require proper testing** before deployment

## Brand Agent Architecture

### Resource Hierarchy

```
BrandAgent (Advertiser Account)
├── Campaigns (multiple, owned by brand agent)
├── Creatives (shared across campaigns)
├── Audiences (targeting profiles)
├── Brand Standards (safety rules)
├── Measurement Sources (analytics)
└── Webhooks (notifications)
```

### Key Patterns

- **Advertiser-Centric**: Brand agents own all resources
- **Resource Sharing**: Creatives/audiences reused across campaigns
- **Create/Update Pattern**: Assignments via campaign creation/updates
- **Dual-Mode Reporting**: Conversational summaries + structured exports

## Testing & Validation

### Testing Strategy

**Backend-Independent Contract Testing (Current Approach)**

We use a contract testing pattern that ensures tests remain valid across backend technology changes (e.g., BigQuery → PostgreSQL). This approach provides:

- **Technology Independence**: Tests focus on service behavior, not implementation
- **Future-Proof**: Backend migrations don't require test rewrites
- **Fast Feedback**: In-memory test doubles enable rapid development cycles
- **Contract Validation**: Ensures all implementations adhere to the same behavioral contract

### Contract Testing Architecture

**1. Service Contracts (`src/contracts/`)**

Define interfaces that any backend implementation must satisfy:

```typescript
// src/contracts/campaign-repository.ts
export interface CampaignRepository {
  createCampaign(apiKey: string, data: CreateCampaignData): Promise<Campaign>;
  listCampaigns(apiKey: string, brandAgentId: string): Promise<Campaign[]>;
  getCampaign(apiKey: string, campaignId: string): Promise<Campaign>;
  updateCampaign(
    apiKey: string,
    campaignId: string,
    data: UpdateCampaignData,
  ): Promise<Campaign>;
  deleteCampaign(apiKey: string, campaignId: string): Promise<void>;
}
```

**2. Contract Test Suites (`src/__tests__/contracts/`)**

Generic test suites that validate any implementation against the contract:

```typescript
// Tests ANY implementation of CampaignRepository
export function testCampaignRepositoryContract(
  repositoryFactory: () => CampaignRepository,
) {
  describe("CampaignRepository Contract", () => {
    it("should create campaigns with valid data", async () => {
      const repo = repositoryFactory();
      const campaign = await repo.createCampaign(validApiKey, validData);
      expect(campaign.id).toBeDefined();
    });
    // ... more behavioral tests
  });
}
```

**3. Test Doubles (`src/test-doubles/`)**

In-memory implementations for fast, isolated testing:

```typescript
// src/test-doubles/campaign-repository-test-double.ts
export class CampaignRepositoryTestDouble implements CampaignRepository {
  private campaigns = new Map<string, Campaign>();

  async createCampaign(
    apiKey: string,
    data: CreateCampaignData,
  ): Promise<Campaign> {
    // In-memory implementation with validation and simulation
  }
}
```

### Why This Testing Strategy

**Problem Solved**: Traditional testing approaches couple tests to specific backend technologies, making backend migrations expensive and risky.

**Our Solution**:

1. **Define Contracts**: Explicit interfaces for all backend services
2. **Test Contracts**: Generic test suites that validate behavior, not implementation
3. **Use Test Doubles**: Fast, controlled implementations for development and CI
4. **Validate Real Services**: Run the same contract tests against actual backend services

**Benefits**:

- **Migration Safety**: When switching BigQuery → PostgreSQL, the same contract tests validate the new implementation
- **Development Speed**: Test doubles provide instant feedback without external dependencies
- **Behavioral Focus**: Tests validate what the service does, not how it does it
- **Regression Prevention**: Contract tests catch breaking changes in service behavior

### Test Levels

1. **Contract Tests** (`src/__tests__/contracts/*.contract.test.ts`) - Validate service interfaces and behavior
2. **Caching Tests** (`src/__tests__/caching/*.test.ts`) - Cache behavior, TTL handling, race conditions
3. **Tool-Level Tests** (`*-tool-level.test.ts`) - Test complete MCP tool execution
4. **Integration Tests** (`test-*.js`) - End-to-end validation with real backends (for verification)

### Running Contract Tests

```bash
# Run contract tests with test doubles (fast)
npm test -- contracts

# Run all tests
npm test

# Test with coverage
npm test -- --coverage
```

**Example Contract Test Usage:**

```typescript
// src/__tests__/examples/backend-independent.test.ts
import { testCampaignRepositoryContract } from "../contracts/campaign-repository.contract.test";
import { CampaignRepositoryTestDouble } from "../../test-doubles/campaign-repository-test-double";

describe("Campaign Repository Contract Validation", () => {
  testCampaignRepositoryContract(() => new CampaignRepositoryTestDouble());
});

// When we implement PostgreSQL backend:
// testCampaignRepositoryContract(() => new PostgreSQLCampaignRepository());
```

**Cache Testing Pattern:**

```typescript
// src/__tests__/caching/cached-bigquery.test.ts
import { CachedBigQuery } from "../../services/cache/cached-bigquery";
import { testCacheServiceContract } from "../contracts/cache-service.contract.test";

describe("CachedBigQuery Contract Compliance", () => {
  testCacheServiceContract(() => new CachedBigQuery(mockConfig, cacheConfig));
});

describe("Cache Behavior", () => {
  it("should prevent race conditions with identical queries", async () => {
    // Test Promise deduplication
  });

  it("should respect TTL for different data types", async () => {
    // Test TTL-based invalidation
  });
});
```

### Before Committing

- Run linters and formatters
- Ensure all TypeScript compiles
- Run contract tests: `npm test -- contracts`
- Test any code examples in documentation
- Validate docs.json structure if modified

### Test Commands

```bash
npm test                                    # Run all tests
npm test -- contracts                      # Contract tests with test doubles (fast)
npm test -- caching                        # Cache system tests (unit + integration)
npm test -- tool-level                     # Tool-level integration tests
npm test -- --coverage                     # With coverage report

# Cache-specific testing
npm run test:cache                         # Cache unit tests only
npm run test:integration                   # Integration tests with mocked BigQuery
```

### Documentation Testing

```bash
npm run docs:dev          # Start local docs server
npm run docs:validate     # Run full validation (requires Mintlify CLI)
```

## Common Pitfalls to Avoid

1. **Don't duplicate OpenAPI docs** - Use auto-generation instead
2. **Don't create excessive navigation depth** - Keep it simple
3. **Don't skip frontmatter** - Every MDX file needs title/description
4. **Don't use absolute URLs** - Use relative paths for internal links
5. **Don't bypass git hooks** - They exist for good reasons
6. **Don't make assumptions** - Ask for clarification when uncertain
7. **Don't assume GraphQL field names match code concepts** - Always verify actual schema field names

## Refactoring Best Practices

### Code-Documentation Alignment

When refactoring code to match updated documentation terminology:

1. **Plan Systematic Changes**: Break large refactoring into logical phases
   - Directory/file renames first
   - Update file contents systematically
   - Update tool registrations and exports
   - Fix type definitions across all files
   - Test compilation at each major step

2. **Update All References**: Terminology changes require updates across:
   - **File names and paths**: Directory names, file names
   - **Function/tool names**: Export names, tool registrations
   - **Content strings**: User-facing text, error messages, descriptions
   - **Type definitions**: Interface names, enum values, parameter types
   - **Documentation**: All references in docs and code comments

3. **Maintain Consistency**:
   - Use consistent naming patterns (e.g., `brand_stories` not `brandStories` for API endpoints)
   - Update both human-readable text AND programmatic references
   - Test that OpenAPI generation works with renamed tools
   - Verify all imports/exports resolve correctly

4. **Common Gotchas**:
   - **Enum values**: Update both definition and usage in switch statements
   - **Duplicate type definitions**: Check multiple files for same interface
   - **Tool registration**: Update both import and addTool() calls
   - **Export lists**: Long export lists at end of index files
   - **API client calls**: Backend API method names may still use old terminology

### Lessons Learned from "Synthetic Audience" → "Brand Story" Refactoring

- **MultiEdit is powerful** but fails if old_string and new_string are identical
- **Type definitions** may exist in multiple files (mcp.ts, reporting.ts)
- **Tool names** appear in 4+ places: file name, export name, tool registration, export list
- **Prettier formatting** should be run after bulk changes
- **Testing early and often** prevents cascade failures

### Lessons Learned from GraphQL Schema Mismatch Investigation

When troubleshooting "Request failed" errors that bypass authentication:

**The Problem**: Assumed GraphQL field names matched code concepts

- **Code**: `brandAgents`, `brandAgent`
- **Actual API**: `agents`, `agent`

**Root Cause**: GraphQL schema field names can differ from conceptual naming

- Authentication works (validates API key exists)
- Data queries fail (wrong field names = 400 Bad Request)

**Investigation Process**:

1. **Verify endpoint connectivity** - Test basic HTTP requests
2. **Test authentication separately** - Confirm API key works for simple queries
3. **Test actual GraphQL queries directly** - Use curl with real API key to test exact queries
4. **Verify field names with working queries** - Don't assume, test systematically

**Key Fixes Required**:

- **LIST**: `brandAgents` → `agents` (plural field)
- **GET**: `brandAgent(id)` → `agent(id)` (singular field)
- **CREATE/UPDATE**: Parameter structure (`input` object → direct parameters, `ID!` → `BigInt!`)
- **Type interfaces**: Update response data structures to match actual API fields

**Prevention**: Always test GraphQL queries directly against the API before implementing client code. Schema documentation may be outdated or incomplete.

## Resources

- [Mintlify Documentation](https://mintlify.com/docs)
- [docs.json Schema](https://mintlify.com/docs.json)
- [MCP Protocol Spec](https://modelcontextprotocol.io/docs)
- Project OpenAPI Spec: `openapi.yaml`
