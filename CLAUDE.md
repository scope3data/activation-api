For documenting an MCP (Model Context Protocol) API to serve both humans and LLMs effectively, you should create a multi-layered documentation approach that combines structured schemas with natural language explanations:

## Core Documentation Strategy

**1. OpenAPI/JSON Schema as the Foundation**
Start with a machine-readable OpenAPI specification or JSON Schema that defines your API precisely. This gives LLMs unambiguous structure while serving as the source of truth:

```yaml
openapi: 3.0.0
info:
  title: MCP Tool API
  description: |
    This API enables context-aware tool execution.
    LLMs should use the search_documents tool when users ask about finding information.
paths:
  /tools/search_documents:
    post:
      operationId: searchDocuments
      description: Searches through available documents using semantic search
      x-llm-hints:
        - "Use this when users ask to 'find', 'search', or 'look for' information"
        - "Returns up to 10 results by default"
```

**2. Structured Tool Descriptions**
For MCP specifically, follow the protocol's tool description format but enhance it with examples:

```json
{
  "name": "search_documents",
  "description": "Search through documents using natural language queries",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Natural language search query",
        "examples": ["latest sales figures", "customer feedback from Q3"]
      }
    }
  },
  "usage_examples": [
    {
      "user_says": "Find our recent performance metrics",
      "tool_call": {"query": "performance metrics recent"}
    }
  ]
}
```

**3. Dual-Purpose Markdown Documentation**
Create markdown files that work for both audiences:

```markdown
# Document Search Tool

## Overview
Searches through available documents using semantic search to find relevant content.

## When to Use
- User asks to "find", "search for", or "look up" information
- User references documents they don't have direct access to
- User needs information that might be in stored documents

## Parameters
- `query` (string, required): Natural language description of what to search for
  - Keep queries concise (3-7 words optimal)
  - Use key terms from the user's request
  - Avoid filler words like "please find"

## Examples
User: "What did we discuss about the product roadmap?"
Call: search_documents(query="product roadmap discussion")
```

**4. Include Behavioral Hints**
Add sections specifically for LLM behavior:

```markdown
## LLM Usage Guidelines
- Always search before claiming information is unavailable
- If initial search returns no results, try broadening the query
- Combine multiple tool calls for complex research questions
- Cite specific documents when referencing search results
```

**5. Provide a Quick Reference Card**
Create a condensed version for quick parsing:

```yaml
tool_matrix:
  search_documents:
    triggers: ["find", "search", "look for", "what about"]
    avoid_when: ["user provides specific document ID"]
    combines_well_with: ["get_document", "summarize"]
    rate_limits: "100/minute"
```

## Best Practices

**Structure for Scanning**: Use consistent headers and formatting. LLMs can quickly parse well-structured documents, while humans can navigate visually.

**Progressive Disclosure**: Start with essential information, then provide detailed specifications. Both audiences can stop reading when they have enough.

**Concrete Examples**: Show actual request/response pairs. LLMs learn patterns from examples, and humans understand through demonstration.

**Version Everything**: Include version numbers in your schemas and documentation. Both LLMs and developers need to know which version they're working with.

**Test Your Documentation**: Regularly test whether LLMs can correctly use your API based solely on the documentation. If an LLM struggles, a human developer likely will too.

The key is creating documentation that's simultaneously precise enough for machine interpretation and clear enough for human understanding—structured data with natural language context achieves both goals effectively.