# Scope3 Agentic Campaign API Documentation

This directory contains the Mintlify documentation for the Scope3 Agentic Campaign API, designed to make migration from traditional DSPs seamless and provide an extraordinary documentation experience.

## 🚀 Key Features

- **Migration-First Design**: Detailed guides for migrating from The Trade Desk, DV360, and other DSPs
- **Interactive API Playground**: Test API endpoints directly in the documentation
- **Natural Language Focus**: Emphasizes agentic campaign management with AI
- **Auto-Generated OpenAPI**: Specification generated from MCP tool definitions
- **LLM-Optimized**: Includes x-llm-hints and structured data for AI tools

## 📁 Documentation Structure

```
mintlify/
├── mint.json                    # Main configuration
├── introduction.mdx             # Landing page with platform comparisons
├── quickstart/
│   ├── authentication.mdx      # API key setup and security
│   ├── first-campaign.mdx      # 5-minute tutorial
│   └── mcp-setup.mdx           # Claude Desktop integration
├── concepts/
│   ├── brand-agents.mdx        # Core concept with TTD/DV360 mapping
│   ├── campaigns.mdx           # Natural language campaign creation
│   ├── creatives.mdx           # Shared creative library
│   └── targeting.mdx           # Synthetic audiences and AI targeting
├── migration/
│   ├── overview.mdx            # Migration process and benefits
│   ├── concept-mapping.mdx     # Detailed platform comparisons
│   ├── from-ttd.mdx           # The Trade Desk migration guide
│   ├── from-dv360.mdx         # DV360 migration guide
│   └── wizard.mdx             # Interactive migration tool
├── api-reference/              # Auto-generated from OpenAPI
└── resources/
    ├── glossary.mdx           # Terminology with platform mappings
    ├── best-practices.mdx     # Implementation guidelines
    └── troubleshooting.mdx    # Common issues and solutions
```

## 🛠 Development Commands

```bash
# Generate OpenAPI spec from MCP tools
npm run generate:openapi

# Start documentation dev server
npm run docs:dev

# Build documentation for production
npm run docs:build

# Validate OpenAPI specification
npm run validate:openapi

# Build project (includes OpenAPI generation)
npm run build
```

## 🔧 Configuration

### API Settings
- **Base URL**: `https://api.agentic.scope3.com`
- **Authentication**: `x-scope3-api-key` header or Bearer token
- **OpenAPI**: Auto-generated from `src/tools/` MCP definitions

### Navigation
The navigation is organized with migration users in mind:
1. **Get Started** - Quick setup for new users
2. **Platform Migration** - TTD/DV360 migration guides
3. **Core Concepts** - Deep dive into Scope3 concepts
4. **API Reference** - Interactive API documentation

### Features Enabled
- ✅ Interactive API playground
- ✅ AI-powered search and chat
- ✅ Automatic /llms.txt generation
- ✅ Code generation in multiple languages
- ✅ Migration concept mapping
- ✅ Platform comparison tables

## 🎯 Design Philosophy

### Migration-First Approach
Every concept page includes:
- Platform equivalents (TTD/DV360/Amazon DSP)
- Side-by-side comparisons
- Migration code examples
- "What's different and better" explanations

### Natural Language Focus
Documentation emphasizes:
- Business goals over technical parameters
- Conversational campaign creation
- AI-powered optimization benefits
- Simplified operations workflow

### Developer Experience
- Interactive code examples in Python, JavaScript, cURL
- Copy-paste ready examples
- Real-world use cases
- Comprehensive troubleshooting

## 📖 Content Guidelines

### Writing Style
- **Familiar → New**: Start with familiar concepts, introduce Scope3 equivalents
- **Why → How**: Explain benefits before implementation details
- **Progressive Disclosure**: Basic → Advanced information flow
- **Migration Context**: Always relate back to traditional DSP workflows

### Code Examples
Every endpoint should include:
1. **Conceptual explanation** (what it does in ad tech terms)
2. **Migration context** (how it relates to TTD/DV360)
3. **Basic example** (simple use case)
4. **Advanced example** (production scenario)
5. **Common pitfalls** (what to avoid)

### Platform Comparisons
Use consistent format:
```markdown
| Traditional DSP | Scope3 Equivalent | Notes |
|----------------|------------------|-------|
| Advertiser | Brand Agent | Top-level container |
```

## 🔄 OpenAPI Generation

The OpenAPI specification is automatically generated from MCP tool definitions:

```typescript
// scripts/generate-openapi.ts extracts from:
src/tools/
├── brand-agents/     # Brand agent management
├── campaigns/        # Campaign operations  
├── creatives/        # Creative asset management
├── audiences/        # Synthetic audience tools
├── standards/        # Brand safety configuration
└── measurement/      # Analytics integration
```

### Custom Enhancements
- **x-llm-hints**: AI assistant guidance
- **x-migration-notes**: Platform mapping information
- **Examples**: Real-world use cases
- **Descriptions**: Business-focused explanations

## 🚢 Deployment

Documentation is configured for automatic deployment:

1. **GitHub Integration**: Auto-deploys on push to main
2. **Preview Deployments**: Available for pull requests
3. **Custom Domain**: docs.scope3.com (configure in Mintlify dashboard)
4. **Analytics**: Configured for usage tracking

## 📊 Success Metrics

### Documentation Goals
- ⏱ **Time to First API Call**: < 5 minutes
- 🎯 **Migration Completion**: 80% fewer support tickets
- 📈 **User Satisfaction**: 90%+ helpful ratings
- 🔍 **Search Success**: 95% query resolution

### Key Performance Indicators
- Search queries without results
- Page bounce rates
- Migration guide completion rates
- API playground usage
- Support ticket volume reduction

## 🆘 Troubleshooting

### Common Issues
- **OpenAPI Generation Fails**: Check MCP tool definitions for errors
- **Dev Server Won't Start**: Ensure Node.js 18+ and dependencies installed
- **Navigation Not Updating**: Verify mint.json syntax and page paths
- **Examples Not Working**: Check API key configuration and endpoints

### Getting Help
- **Documentation Issues**: [GitHub Issues](https://github.com/conductor/activation-api/issues)
- **API Problems**: [API Support](mailto:api-support@scope3.com)
- **Migration Help**: [Migration Team](mailto:migration@scope3.com)

## 🔮 Future Enhancements

### Planned Features
- **Interactive Migration Wizard**: Step-by-step platform migration
- **Campaign Builder**: Visual campaign creation tool
- **Performance Dashboard**: Embedded analytics and reporting
- **Video Tutorials**: Walkthrough videos for complex workflows
- **Multi-language Support**: Localization for global users

### Community Features
- **Community Forum**: User discussion and support
- **Best Practices Library**: Community-contributed examples
- **Integration Showcase**: Partner and customer implementations
- **Office Hours**: Regular developer Q&A sessions

---

This documentation is designed to make the transition to agentic campaign management as smooth as possible while showcasing the power and simplicity of the Scope3 platform.

**Questions?** Contact the team at [docs@scope3.com](mailto:docs@scope3.com)