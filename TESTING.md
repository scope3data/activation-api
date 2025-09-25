# Cache System Testing Guide

This document describes the comprehensive testing strategy for the BigQuery caching system.

## Test Architecture

### Contract Testing Pattern

The caching system uses a **backend-independent contract testing pattern** that ensures tests remain valid across technology changes:

```
contracts/                  # Interface definitions
├── cache-service.ts        # CacheService interface

__tests__/contracts/        # Contract test suites
├── cache-service.contract.test.ts

test-doubles/               # In-memory implementations
├── cache-service-test-double.ts
├── preload-service-test-double.ts

__tests__/caching/          # Implementation-specific tests
├── cache-system.test.ts
├── cached-bigquery.test.ts
├── preload-service.test.ts
```

### Benefits of This Approach

1. **Technology Independence**: Tests focus on behavior, not implementation
2. **Future-Proof**: Backend migrations don't require test rewrites
3. **Fast Feedback**: Test doubles enable rapid development cycles
4. **Contract Validation**: Ensures all implementations adhere to the same contract

## Test Types

### 1. Contract Tests
**Location**: `src/__tests__/contracts/`
**Purpose**: Validate that any implementation satisfies the behavioral contract
**Speed**: Fast (use test doubles)
**Coverage**: Interface compliance, basic behavior

```bash
npm run test:contracts
```

### 2. Unit Tests
**Location**: `src/__tests__/caching/`
**Purpose**: Test specific implementation details of CachedBigQuery and PreloadService
**Speed**: Fast (mocked dependencies)
**Coverage**: Implementation-specific logic, edge cases, error handling

```bash
npm run test:cache
```

### 3. Integration Tests
**Location**: Root directory (`test-*.js`)
**Purpose**: End-to-end validation with real MCP tools
**Speed**: Slow (requires build, may use real APIs)
**Coverage**: Full system integration, real-world scenarios

```bash
npm run test:integration
```

## Running Tests

### Development Workflow

```bash
# Quick feedback loop during development
npm run test:watch

# Run only caching tests
npm run test:cache

# Run all tests with coverage
npm run test:coverage

# Full integration test (requires build)
npm run test:integration
```

### CI/CD Pipeline

```bash
# Fast contract validation (always runs)
npm run test:contracts

# Unit tests with coverage
npm run test:cache

# Integration tests (only with real credentials)
npm run test:integration  # Skipped in CI if no real API key
```

## Test Scenarios Covered

### Core Caching Behavior
- ✅ Cache hits/misses
- ✅ TTL expiration
- ✅ Different TTL for different query types
- ✅ Cache key generation and normalization
- ✅ Memory usage tracking

### Race Condition Prevention
- ✅ Concurrent identical queries (deduplication)
- ✅ Mixed concurrent workloads
- ✅ In-flight request tracking

### Error Handling
- ✅ Database errors don't get cached
- ✅ Graceful degradation when cache fails
- ✅ Service errors during preload

### Performance Validation
- ✅ Speed improvement measurement (>70% improvement expected)
- ✅ Burst traffic handling
- ✅ Memory pressure testing

### Preload System
- ✅ Background preload triggering
- ✅ Duplicate preload prevention
- ✅ Concurrent preload limits
- ✅ Status tracking and cleanup

### Memory Management
- ✅ Memory usage calculation
- ✅ Cache invalidation by pattern
- ✅ Automatic cleanup of expired entries

## Coverage Thresholds

The project enforces high coverage standards for caching components:

```typescript
// vitest.config.ts coverage thresholds
"src/services/cache/cached-bigquery.ts": {
  branches: 85,
  functions: 90,
  lines: 85,
  statements: 85,
},
"src/services/cache/preload-service.ts": {
  branches: 80,
  functions: 85,
  lines: 80,
  statements: 80,
}
```

## CI/CD Integration

### GitHub Actions Workflows

The caching system has dedicated CI workflows:

**`.github/workflows/cache-tests.yml`**
- Contract and unit tests (always runs)
- Integration tests (only with credentials)
- Performance benchmarks
- Stress testing
- Coverage reporting

### Performance Benchmarks

Automated benchmarks ensure cache performance standards:

- **Cache Hit Speed**: < 10ms per query
- **Cache Hit Rate**: > 99% for repeated queries
- **Memory Efficiency**: < 50MB for stress test workload
- **Concurrency**: Handle 100+ concurrent identical queries

### Stress Testing

Automated stress tests validate system resilience:

1. **High Concurrency**: 100 concurrent identical queries
2. **Memory Pressure**: 1000 unique queries
3. **Mixed Workload**: Combination of cached and uncached queries

## Environment Configuration

### Test Environment Variables

```bash
# Required for integration tests
SCOPE3_API_KEY=your-api-key-here

# Test configuration
NODE_ENV=test
CI=true  # Enables CI-specific behavior
```

### CI-Specific Behavior

When `CI=true`:
- Shorter timeouts (30s vs 60s)
- Reduced wait times for preload
- Integration tests skip if no real API key
- Simplified error output

## Best Practices

### Writing Cache Tests

1. **Use Contract Tests First**: Validate behavior against the interface
2. **Mock External Dependencies**: Don't test BigQuery, test your cache logic
3. **Test Race Conditions**: Use Promise.all() with identical queries
4. **Measure Performance**: Assert speed improvements from caching
5. **Test Memory Management**: Verify cache cleanup and invalidation

### Example Test Pattern

```typescript
describe("Cache Behavior", () => {
  let cache: CacheService;
  
  beforeEach(() => {
    cache = new CacheServiceTestDouble();
  });

  it("should demonstrate speed improvement from caching", async () => {
    const query = { query: "SELECT expensive_operation()", params: {} };
    
    // First call - cache miss
    const start1 = Date.now();
    await cache.query(query);
    const duration1 = Date.now() - start1;
    
    // Second call - cache hit
    const start2 = Date.now();
    await cache.query(query);
    const duration2 = Date.now() - start2;
    
    const improvement = ((duration1 - duration2) / duration1) * 100;
    expect(improvement).toBeGreaterThan(70);
  });
});
```

## Troubleshooting

### Common Issues

**Integration Tests Failing**
- Check that `npm run build` completes successfully
- Verify API key is set correctly
- Ensure BigQuery mock is working in unit tests

**Coverage Below Threshold**
- Add tests for uncovered branches
- Test error scenarios and edge cases
- Use `npm run test:coverage` to see detailed coverage report

**Performance Tests Failing**
- Check if test doubles have realistic delays configured
- Verify cache hit rates are being calculated correctly
- Ensure stress tests aren't hitting memory limits

**CI Tests Timing Out**
- Reduce timeout values for CI environment
- Skip expensive operations in CI
- Use test doubles instead of real services

## Future Enhancements

### Potential Test Improvements

1. **Mutation Testing**: Verify test quality by introducing code mutations
2. **Load Testing**: Simulate realistic production traffic patterns
3. **Cache Coherence Testing**: Test distributed cache scenarios
4. **Monitoring Integration**: Test cache metrics collection and alerting

### Metrics to Track

- Cache hit rate trends
- Memory usage patterns
- Query performance distributions
- Error rates and types
- Preload success rates

This comprehensive testing strategy ensures the caching system is reliable, performant, and maintainable for production use.