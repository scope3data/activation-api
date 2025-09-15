# Brand Agent Testing Strategy

## Overview

This testing suite validates the **GraphQL-primary with BigQuery enhancement** architectural pattern used in the brand agent CRUD operations. The tests ensure that:

1. **GraphQL is the primary data source** - all operations depend on GraphQL success
2. **BigQuery enhancement is non-blocking** - operations succeed even when BigQuery fails
3. **Data consistency is maintained** across both systems
4. **Performance characteristics** meet requirements under various conditions
5. **Resilience patterns** work correctly during system failures

## Architecture Pattern Validation

### Core Principles Tested

1. **GraphQL-Primary**: All operations query GraphQL first. If GraphQL fails, the entire operation fails.
2. **Enhancement Non-Blocking**: BigQuery enhancement failures do not fail the operation.
3. **Data Consistency**: Enhanced data maintains consistency with GraphQL core data.
4. **Graceful Degradation**: System continues to function with GraphQL-only data when BigQuery is unavailable.

## Test Structure

```
src/__tests__/
├── setup/                          # Test configuration and mocks
│   ├── test-setup.ts               # Global test setup and MSW server
│   ├── graphql-mocks.ts            # GraphQL API mocking with MSW
│   └── bigquery-mocks.ts           # BigQuery service mocking utilities
├── fixtures/                       # Test data factories
│   └── brand-agent-fixtures.ts     # Brand agent test data and builders
└── integration/                    # Integration tests
    ├── brand-agent-performance.test.ts  # Performance and stress tests
    └── brand-agent-end-to-end.test.ts   # End-to-end workflow tests

src/services/
└── brand-agent-service.test.ts     # BigQuery service unit tests

src/client/
└── scope3-client-brand-agents.test.ts  # Client integration tests
```

## Test Categories

### 1. Unit Tests (`*.test.ts` files alongside source)

**Purpose**: Test individual components in isolation
**Coverage**:

- `BrandAgentService` methods
- Data transformations and validations
- Error handling at service boundaries

**Key Scenarios**:

- BigQuery query construction and parameter binding
- Data type conversions (strings, numbers, dates, arrays)
- NULL/undefined handling
- Error propagation

### 2. Integration Tests (`src/client/scope3-client-brand-agents.test.ts`)

**Purpose**: Test the GraphQL + BigQuery integration pattern
**Coverage**:

- All CRUD operations (`getBrandAgent`, `listBrandAgents`, `createBrandAgent`, `updateBrandAgent`)
- Enhancement pattern validation
- Error handling and graceful degradation

**Key Scenarios**:

- GraphQL success + BigQuery success (full enhancement)
- GraphQL success + BigQuery failure (graceful degradation)
- GraphQL failure (operation failure regardless of BigQuery state)
- Authentication and authorization errors
- Data consistency validation

### 3. Performance Tests (`src/__tests__/integration/brand-agent-performance.test.ts`)

**Purpose**: Validate performance characteristics and resource usage
**Coverage**:

- Response time requirements
- Memory usage patterns
- Concurrent operation handling
- Large dataset processing

**Key Scenarios**:

- Single agent retrieval < 500ms
- List of 10 agents < 2 seconds
- Concurrent operations efficiency
- Memory leak detection
- Resource cleanup validation

### 4. Resilience Tests (`src/__tests__/integration/brand-agent-performance.test.ts`)

**Purpose**: Test system behavior under failure conditions
**Coverage**:

- Network failures and timeouts
- Service unavailability
- Partial system degradation
- Recovery scenarios

**Key Scenarios**:

- Complete BigQuery outage
- Intermittent BigQuery failures
- GraphQL rate limiting
- Mixed failure scenarios
- System recovery patterns

### 5. End-to-End Tests (`src/__tests__/integration/brand-agent-end-to-end.test.ts`)

**Purpose**: Test complete real-world workflows
**Coverage**:

- Full CRUD lifecycle
- Multi-brand enterprise scenarios
- System migration workflows
- Complex business scenarios

**Key Scenarios**:

- Brand onboarding workflow
- Enterprise customer with multiple brands
- Legacy system migration
- Partial enhancement scenarios

## Mocking Strategy

### GraphQL Mocking (MSW)

**Tool**: Mock Service Worker (MSW)
**Approach**: Network-level interception
**Benefits**:

- Realistic HTTP request/response simulation
- GraphQL schema compliance
- Support for various error scenarios

**Mock Types**:

- Successful operations with realistic data
- GraphQL errors (validation, syntax, etc.)
- HTTP errors (401, 403, 500, 429)
- Network timeouts and delays
- Rate limiting simulation

### BigQuery Mocking

**Tool**: Vitest mocks with `@google-cloud/bigquery`
**Approach**: Service boundary mocking
**Benefits**:

- Controlled query response simulation
- Error scenario testing
- Performance characteristic simulation

**Mock Types**:

- Successful query responses with realistic data
- BigQuery-specific errors (table not found, quota exceeded, etc.)
- Network errors and timeouts
- Authentication failures
- Intermittent failure patterns

## Running Tests

### All Tests

```bash
npm test
```

### Specific Test Categories

```bash
# Unit tests only
npm test src/services/

# Integration tests only
npm test src/client/

# Performance tests
npm test src/__tests__/integration/brand-agent-performance.test.ts

# End-to-end tests
npm test src/__tests__/integration/brand-agent-end-to-end.test.ts
```

### With Coverage

```bash
npm test -- --coverage
```

### Watch Mode

```bash
npm test -- --watch
```

### Debug Mode

```bash
npm test -- --reporter=verbose
```

## Test Data Management

### Fixtures

Test data is managed through factory functions in `/fixtures/brand-agent-fixtures.ts`:

```typescript
// Create standard test data
const agent = brandAgentFixtures.enhancedBrandAgent();

// Create with overrides
const customAgent = brandAgentFactory.create({
  name: "Custom Brand",
  externalId: "custom_123",
});

// Create multiple agents
const agents = brandAgentFactory.createList(10, customerId);
```

### Mock Scenarios

Common scenarios are pre-configured in the mock setup files:

```typescript
// GraphQL success + BigQuery enhancement
bigQueryTestScenarios.fullyEnhanced();

// GraphQL success + BigQuery unavailable
bigQueryTestScenarios.bigQueryUnavailable();

// Mixed enhancement states for lists
bigQueryTestScenarios.mixedEnhancementList();
```

## Coverage Requirements

### Global Thresholds

- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Statements**: 80%

### Critical Component Thresholds

- **scope3-client.ts**: 90% (core integration logic)
- **brand-agent-service.ts**: 85% (BigQuery service layer)

### Coverage Exclusions

- Test files themselves
- Configuration files
- Type definition files
- Node modules

## Performance Benchmarks

### Response Time Requirements

- **Single agent retrieval**: < 500ms under normal conditions
- **List of 10 agents**: < 2 seconds with full enhancement
- **Concurrent operations**: Should scale efficiently
- **Large datasets**: < 5 seconds for 100 agents

### Resource Usage Limits

- **Memory increase**: < 50MB for 100 agent operations
- **Memory leaks**: < 10MB increase after 20 repeated operations
- **Concurrent limit**: Support at least 10 concurrent operations

## Error Scenarios Tested

### GraphQL Errors

- Authentication failures (401, 403)
- Rate limiting (429)
- Server errors (500)
- Invalid queries (400)
- Network timeouts

### BigQuery Errors

- Table not found (404)
- Authentication failed (401)
- Quota exceeded (403)
- Query timeout (408)
- Network connectivity issues

### Mixed Scenarios

- Partial system outages
- Recovery patterns
- Intermittent failures
- Performance degradation

## Continuous Integration

### Pre-commit Hooks

Tests are automatically run on:

- All TypeScript file changes
- Test file modifications
- Configuration changes

### Pipeline Integration

```bash
# Full test suite with coverage
npm run test

# Lint + Test + Build validation
npm run lint && npm test && npm run build
```

## Troubleshooting

### Common Issues

1. **MSW Handler Conflicts**
   - Ensure `server.resetHandlers()` in `beforeEach`
   - Check handler order and specificity

2. **BigQuery Mock Cleanup**
   - Use `setupBigQueryMocks.reset()` between tests
   - Verify mock call counts with assertions

3. **Timeout Issues**
   - Increase `testTimeout` for integration tests
   - Check for unresolved promises in mocks

4. **Memory Leaks**
   - Ensure proper cleanup in `afterEach`
   - Reset global state between tests

### Debug Tips

1. **Enable Verbose Logging**

   ```bash
   npm test -- --reporter=verbose
   ```

2. **Isolate Failing Tests**

   ```bash
   npm test -- --run --reporter=verbose src/path/to/test.ts
   ```

3. **Check Mock Call History**

   ```typescript
   console.log(mockBigQueryMethods.query.mock.calls);
   ```

4. **Verify Network Requests**
   ```typescript
   // MSW has built-in request logging
   server.use(
     rest.all("*", (req, res, ctx) => {
       console.log("Request:", req.method, req.url);
       return req.passthrough();
     }),
   );
   ```

## Contributing

### Adding New Tests

1. **Follow the Established Pattern**
   - Use appropriate test category
   - Include proper setup/teardown
   - Use existing fixtures and mocks

2. **Update Coverage Thresholds**
   - Maintain or improve coverage percentages
   - Add specific thresholds for new critical components

3. **Document New Scenarios**
   - Add comments explaining test purpose
   - Update this README for new patterns

4. **Validate Performance Impact**
   - Ensure new tests don't significantly slow the suite
   - Consider timeout requirements

### Test Naming Conventions

```typescript
describe("ComponentName", () => {
  describe("methodName", () => {
    describe("when condition", () => {
      it("should expected behavior", async () => {
        // Arrange
        // Act
        // Assert
      });
    });
  });
});
```

This testing strategy ensures comprehensive validation of the brand agent enhancement pattern while maintaining clear separation of concerns and realistic failure simulation.
