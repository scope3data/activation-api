# Scope3 Campaign API MCP Server

An MCP (Model Context Protocol) server for comprehensive advertising campaign management through the Scope3 API.

## Development Environment Setup

### Prerequisites

This project requires **Node.js 22+** for consistency with CI environments.

#### Using nvm (recommended):

```bash
# Install/use the correct Node version
nvm use

# Or install if you don't have Node 22
nvm install 22
nvm use 22
```

#### Manual setup:

- Ensure you have Node.js 22+ installed
- Check your version: `node --version`

### Local CI Checking

Before pushing changes, run our local CI simulation:

```bash
npm run ci:local
```

This runs the same checks as our CI pipeline and catches issues early.

## Development

To get started, clone the repository and install the dependencies.

```bash
git clone https://github.com/punkpeye/fastmcp-boilerplate.git
cd fastmcp-boilerplate
npm install
npm run dev
```

> [!NOTE]
> If you are starting a new project, you may want to fork [fastmcp-boilerplate](https://github.com/punkpeye/fastmcp-boilerplate) and start from there.

### Start the server

If you simply want to start the server, you can use the `start` script.

```bash
npm run start
```

However, you can also interact with the server using the `dev` script.

```bash
npm run dev
```

This will start the server and allow you to interact with it using CLI.

### Testing

A good MCP server should have tests. However, you don't need to test the MCP server itself, but rather the tools you implement.

```bash
npm run test
```

In the case of this boilerplate, we only test the implementation of the `add` tool.

### Linting

Having a good linting setup reduces the friction for other developers to contribute to your project.

```bash
npm run lint
```

This boilerplate uses [Prettier](https://prettier.io/), [ESLint](https://eslint.org/) and [TypeScript ESLint](https://typescript-eslint.io/) to lint the code.

### Formatting

Use `npm run format` to format the code.

```bash
npm run format
```

### Documentation

The project includes comprehensive documentation built with [Mintlify](https://mintlify.com).

#### Local Documentation Development

Start the documentation server locally:

```bash
npm run docs:dev
```

This will start a local Mintlify server, typically at http://localhost:3000.

#### Documentation Validation

Validate documentation before committing:

```bash
# Validate OpenAPI spec used in docs
npm run docs:validate:openapi

# Check for broken internal links (informational)
npm run docs:validate:links

# Run all documentation validation
npm run docs:validate
```

#### Documentation Guidelines

- All documentation files are in the `mintlify/` directory
- The `mint.json` file contains navigation and configuration
- OpenAPI spec is automatically validated against documentation
- Broken links are checked but don't fail CI (since docs may be incomplete)
- Run `npm run docs:validate:openapi` before committing to ensure OpenAPI compatibility

### CI/Local Environment Parity

To ensure your local environment matches CI and prevent "works on my machine" issues:

```bash
# Setup correct Node version
nvm use

# Run local CI simulation before pushing
npm run ci:local
```

See [CI/Local Parity Guide](docs/CI_LOCAL_PARITY.md) for detailed information.

### GitHub Actions

This repository has a GitHub Actions workflow that runs linting, formatting, tests, and publishes package updates to NPM using [semantic-release](https://semantic-release.gitbook.io/semantic-release/).

In order to use this workflow, you need to:

1. Add `NPM_TOKEN` to the repository secrets
   1. [Create a new automation token](https://www.npmjs.com/settings/punkpeye/tokens/new)
   2. Add token as `NPM_TOKEN` environment secret (Settings → Secrets and Variables → Actions → "Manage environment secrets" → "release" → Add environment secret)
1. Grant write access to the workflow (Settings → Actions → General → Workflow permissions → "Read and write permissions")
