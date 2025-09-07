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
- **API**: GraphQL backend integration

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

## Mintlify Documentation Standards

### Working Relationship

- Push back on ideas with reasoning - this leads to better documentation
- ALWAYS ask for clarification rather than making assumptions
- NEVER lie, guess, or make up information

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

### Documentation Don'ts

- Skip frontmatter on any MDX file
- Use absolute URLs for internal links
- Include untested code examples
- Make assumptions - always ask for clarification
- Duplicate API reference content (use OpenAPI auto-generation)
- Create excessive navigation depth

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

## Resources

- [Mintlify Documentation](https://mintlify.com/docs)
- [docs.json Schema](https://mintlify.com/docs.json)
- [MCP Protocol Spec](https://modelcontextprotocol.io/docs)
- Project OpenAPI Spec: `openapi.yaml`
