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

The server uses a **hybrid backend approach**:

- **BigQuery** (`bok-playground.agenticapi`): Core entities (campaigns, creatives, brand agent extensions)
- **GraphQL** (`https://api.scope3.com/graphql`): Brand stories, brand standards, PMPs, measurement sources
- **Automatic Fallback**: BigQuery methods fall back to GraphQL where available

#### BigQuery Tables

- `brand_agent_extensions` - Extends existing `public_agent` table
- `campaigns` - Campaign management with budget tracking
- `creatives` - Creative assets with format/content metadata
- `campaign_creatives` - Campaign-creative assignment mapping
- `campaign_brand_stories` - Campaign-brand story assignment mapping

#### Key Services

- **CampaignBigQueryService** (`src/services/campaign-bigquery-service.ts`) - CRUD operations for BigQuery entities
- **Scope3ApiClient** (`src/client/scope3-client.ts`) - Hybrid routing with transparent fallbacks

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

- Create new branches for feature work
- Ask how to handle uncommitted changes before starting
- Use rebase for clean history when merging
- Test locally before pushing

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

### Before Committing

- Run linters and formatters
- Ensure all TypeScript compiles
- Test any code examples in documentation
- Validate docs.json structure if modified

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

## Resources

- [Mintlify Documentation](https://mintlify.com/docs)
- [docs.json Schema](https://mintlify.com/docs.json)
- [MCP Protocol Spec](https://modelcontextprotocol.io/docs)
- Project OpenAPI Spec: `openapi.yaml`
