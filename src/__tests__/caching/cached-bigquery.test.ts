/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  MockedFunction,
  vi,
} from "vitest";

import type {
  CacheService,
  QueryOptions,
} from "../../contracts/cache-service.js";

import {
  CachedBigQuery,
  DEFAULT_CACHE_CONFIG,
} from "../../services/cache/cached-bigquery.js";
import { testCacheServiceContract } from "../contracts/cache-service.contract.test.js";

// Mock the Google Cloud BigQuery
vi.mock("@google-cloud/bigquery", () => {
  const mockBigQuery = vi.fn();
  mockBigQuery.prototype.query = vi.fn();

  return {
    BigQuery: mockBigQuery,
  };
});

// Mock process event handlers to prevent MaxListenersExceededWarning
const originalProcessOn = process.on;
const originalProcessOff = process.off;
vi.spyOn(process, "on").mockImplementation(() => process);
vi.spyOn(process, "off").mockImplementation(() => process);

/**
 * Adapter to make CachedBigQuery compatible with CacheService contract
 */
class CachedBigQueryAdapter implements CacheService {
  constructor(private cachedBigQuery: CachedBigQuery) {}

  clearCache(): void {
    this.cachedBigQuery.clearCache();
  }

  getCacheStats() {
    return this.cachedBigQuery.getCacheStats();
  }

  invalidatePattern(pattern: string): void {
    this.cachedBigQuery.invalidatePattern(pattern);
  }

  isCached(options: QueryOptions): boolean {
    const cacheKey = (this.cachedBigQuery as any).generateCacheKey(options);
    const entry = (this.cachedBigQuery as any).cache.get(cacheKey);

    if (!entry) return false;

    const age = Date.now() - entry.timestamp;
    return age <= entry.ttl;
  }

  async query(options: QueryOptions): Promise<any> {
    return this.cachedBigQuery.query(options);
  }
}

describe("CachedBigQuery Implementation", () => {
  let mockQuery: MockedFunction<any>;
  let cachedBigQuery: CachedBigQuery;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup BigQuery mock
    const { BigQuery } = await import("@google-cloud/bigquery");
    mockQuery = vi.fn();
    (BigQuery as any).prototype.query = mockQuery;

    // Create CachedBigQuery instance
    cachedBigQuery = new CachedBigQuery(
      { location: "us-central1", projectId: "test-project" },
      {
        ...DEFAULT_CACHE_CONFIG,
        ttl: {
          brandAgents: 1000, // 1 second for testing
          campaigns: 800, // 0.8 seconds for testing
          creatives: 1200, // 1.2 seconds for testing
          default: 500, // 0.5 seconds for testing
        },
      },
    );

    // Setup default mock response
    mockQuery.mockResolvedValue([
      [{ id: "1", name: "Test Result", timestamp: new Date().toISOString() }],
    ]);
  });

  // Clean up after each test to prevent resource leaks
  afterEach(() => {
    // Clear cache but don't destroy the main instance (needed for other tests)
    if (cachedBigQuery && typeof cachedBigQuery.clearCache === "function") {
      cachedBigQuery.clearCache();
    }
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  // Only destroy after all tests complete
  afterAll(() => {
    if (cachedBigQuery && typeof cachedBigQuery.destroy === "function") {
      cachedBigQuery.destroy();
    }
  });

  // Run contract tests against the real implementation
  describe("Contract Compliance", () => {
    testCacheServiceContract(() => new CachedBigQueryAdapter(cachedBigQuery), {
      skipConcurrencyTests: false, // CachedBigQuery supports concurrency
      skipMemoryTests: false, // CachedBigQuery supports memory tracking
    });
  });

  // Implementation-specific tests
  describe("CachedBigQuery Specific Behavior", () => {
    it("should call underlying BigQuery only once for identical queries", async () => {
      const queryOptions = {
        params: { id: "test-123" },
        query: "SELECT * FROM test_table WHERE id = @id",
      };

      // First call
      await cachedBigQuery.query(queryOptions);
      expect(mockQuery).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await cachedBigQuery.query(queryOptions);
      expect(mockQuery).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it("should handle BigQuery errors appropriately", async () => {
      const queryOptions = {
        params: {},
        query: "SELECT * FROM invalid_table",
      };

      // Mock BigQuery to throw an error
      mockQuery.mockRejectedValueOnce(new Error("BigQuery connection failed"));

      await expect(cachedBigQuery.query(queryOptions)).rejects.toThrow(
        "BigQuery connection failed",
      );

      // Error should not be cached - next call should try BigQuery again
      mockQuery.mockResolvedValueOnce([[]]);
      await expect(cachedBigQuery.query(queryOptions)).resolves.toBeDefined();
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it("should apply correct TTL based on query type", async () => {
      const brandAgentQuery = {
        params: { id: 123 },
        query: "SELECT * FROM brand_agents WHERE customer_id = @id",
      };

      const campaignQuery = {
        params: { id: "brand-1" },
        query: "SELECT * FROM campaigns WHERE brand_agent_id = @id",
      };

      // Execute both queries
      await cachedBigQuery.query(brandAgentQuery);
      await cachedBigQuery.query(campaignQuery);

      // Both should be cached initially
      const adapter = new CachedBigQueryAdapter(cachedBigQuery);
      expect(adapter.isCached(brandAgentQuery)).toBe(true);
      expect(adapter.isCached(campaignQuery)).toBe(true);

      // Wait for campaign TTL to expire (800ms) but keep brand agent cached (1000ms)
      await new Promise((resolve) => setTimeout(resolve, 900)); // Wait 900ms, longer than campaign TTL but shorter than brand agent TTL

      // Campaign should be expired, brand agent should still be cached
      expect(adapter.isCached(campaignQuery)).toBe(false);
      expect(adapter.isCached(brandAgentQuery)).toBe(true);
    });

    it("should prevent race conditions with concurrent identical queries", async () => {
      const queryOptions = {
        params: { param: "race-test" },
        query: "SELECT * FROM expensive_table WHERE complex_operation = @param",
      };

      // Start 5 identical queries concurrently
      const promises = Array(5)
        .fill(null)
        .map(() => cachedBigQuery.query(queryOptions));
      const results = await Promise.all(promises);

      // Should only call BigQuery once despite 5 concurrent requests
      expect(mockQuery).toHaveBeenCalledTimes(1);

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(results[0]);
      }
    });

    it("should generate different cache keys for different queries", async () => {
      const query1 = {
        params: { id: 1 },
        query: "SELECT * FROM table1 WHERE id = @id",
      };

      const query2 = {
        params: { id: 2 },
        query: "SELECT * FROM table1 WHERE id = @id",
      };

      const query3 = {
        params: { id: 1 },
        query: "SELECT * FROM table2 WHERE id = @id",
      };

      // Clear the cache and mock to start fresh
      cachedBigQuery.clearCache();
      mockQuery.mockClear();

      // Generate cache keys to verify they're different
      const key1 = (cachedBigQuery as any).generateCacheKey(query1);
      const key2 = (cachedBigQuery as any).generateCacheKey(query2);
      const key3 = (cachedBigQuery as any).generateCacheKey(query3);
      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key2).not.toBe(key3);

      // Execute queries sequentially to avoid race conditions
      await cachedBigQuery.query(query1);
      await cachedBigQuery.query(query2);
      await cachedBigQuery.query(query3);

      // Should have made 3 separate BigQuery calls (no cache hits)
      expect(mockQuery).toHaveBeenCalledTimes(3);

      // All should be cached as separate entries
      const adapter = new CachedBigQueryAdapter(cachedBigQuery);
      expect(adapter.isCached(query1)).toBe(true);
      expect(adapter.isCached(query2)).toBe(true);
      expect(adapter.isCached(query3)).toBe(true);
    });

    it("should normalize whitespace in queries for consistent caching", async () => {
      const query1 = {
        params: { id: "test" },
        query: "SELECT * FROM table WHERE id = @id",
      };

      const query2 = {
        params: { id: "test" },
        query: "SELECT   *   FROM   table   WHERE   id   =   @id", // Extra spaces
      };

      const query3 = {
        params: { id: "test" },
        query: `SELECT * 
                FROM table 
                WHERE id = @id`, // Multiple lines
      };

      // Clear cache and mock to start fresh
      cachedBigQuery.clearCache();
      mockQuery.mockClear();

      await cachedBigQuery.query(query1);
      await cachedBigQuery.query(query2);
      await cachedBigQuery.query(query3);

      // Should only make one BigQuery call due to query normalization
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it("should cleanup expired entries periodically", async () => {
      // Add entries with short TTL
      const shortTtlCache = new CachedBigQuery(
        { location: "us-central1", projectId: "test-project" },
        {
          ...DEFAULT_CACHE_CONFIG,
          ttl: { brandAgents: 50, campaigns: 50, creatives: 50, default: 50 },
        },
      );

      // Add some entries
      await shortTtlCache.query({ params: {}, query: "SELECT 1" });
      await shortTtlCache.query({ params: {}, query: "SELECT 2" });

      let stats = shortTtlCache.getCacheStats();
      expect(stats.size).toBe(2);

      // Wait for entries to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Manually trigger cleanup
      (shortTtlCache as any).cleanupExpired();

      stats = shortTtlCache.getCacheStats();
      expect(stats.size).toBe(0); // Expired entries should be cleaned up

      // Clean up
      shortTtlCache.destroy();
    });

    it("should invalidate cache entries by pattern correctly", async () => {
      // Clear cache to start fresh
      cachedBigQuery.clearCache();

      await cachedBigQuery.query({
        params: {},
        query: "SELECT * FROM brand_agents",
      });
      await cachedBigQuery.query({
        params: {},
        query: "SELECT * FROM campaigns",
      });
      await cachedBigQuery.query({
        params: {},
        query: "SELECT * FROM creatives",
      });

      let stats = cachedBigQuery.getCacheStats();
      expect(stats.size).toBe(3);

      // Invalidate brand_agents queries
      cachedBigQuery.invalidatePattern("brand_agents");

      stats = cachedBigQuery.getCacheStats();
      expect(stats.size).toBe(2); // Should have removed 1 entry

      // Verify specific entries are gone/remaining
      const adapter = new CachedBigQueryAdapter(cachedBigQuery);
      expect(
        adapter.isCached({ params: {}, query: "SELECT * FROM brand_agents" }),
      ).toBe(false);
      expect(
        adapter.isCached({ params: {}, query: "SELECT * FROM campaigns" }),
      ).toBe(true);
      expect(
        adapter.isCached({ params: {}, query: "SELECT * FROM creatives" }),
      ).toBe(true);
    });
  });

  describe("Cache Statistics", () => {
    it("should provide accurate cache statistics", async () => {
      // Clear cache to start fresh
      cachedBigQuery.clearCache();

      const initialStats = cachedBigQuery.getCacheStats();
      expect(initialStats.size).toBe(0);
      expect(initialStats.memoryUsage).toBe(0);

      // Add some queries
      await cachedBigQuery.query({ params: {}, query: "SELECT * FROM table1" });
      await cachedBigQuery.query({ params: {}, query: "SELECT * FROM table2" });

      const afterStats = cachedBigQuery.getCacheStats();
      expect(afterStats.size).toBe(2);
      expect(afterStats.memoryUsage).toBeGreaterThan(0);
    });

    it("should calculate memory usage based on cached data size", async () => {
      // Clear cache to start fresh
      cachedBigQuery.clearCache();

      // Mock a large result
      mockQuery.mockResolvedValueOnce([
        Array.from({ length: 1000 }, (_, i) => ({
          data: "x".repeat(100),
          id: i,
          name: `Large Entry ${i}`,
        })),
      ]);

      const initialStats = cachedBigQuery.getCacheStats();

      await cachedBigQuery.query({
        params: {},
        query: "SELECT * FROM large_table",
      });

      const finalStats = cachedBigQuery.getCacheStats();
      expect(finalStats.memoryUsage).toBeGreaterThan(initialStats.memoryUsage);
      expect(finalStats.memoryUsage).toBeGreaterThan(0.01); // Should be measurable in MB
    });
  });
});
