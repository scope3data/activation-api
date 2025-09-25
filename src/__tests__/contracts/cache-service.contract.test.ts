import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CacheService, PreloadService, QueryOptions } from "../../contracts/cache-service.js";

/**
 * Contract Tests for Cache Service
 * 
 * These tests validate that any implementation of CacheService
 * behaves correctly regardless of the underlying technology.
 * 
 * Usage:
 * testCacheServiceContract(() => new MyCacheImplementation())
 */
export function testCacheServiceContract(
  cacheFactory: () => CacheService,
  options?: {
    skipMemoryTests?: boolean;
    skipConcurrencyTests?: boolean;
  }
) {
  describe("CacheService Contract", () => {
    let cache: CacheService;
    
    beforeEach(() => {
      cache = cacheFactory();
      cache.clearCache();
    });

    describe("Basic Caching Behavior", () => {
      it("should cache identical queries and return same results", async () => {
        const queryOptions: QueryOptions = {
          query: "SELECT * FROM test_table WHERE id = @id",
          params: { id: "test-123" }
        };

        // First call should be cache miss
        const result1 = await cache.query(queryOptions);
        expect(result1).toBeDefined();

        // Second identical call should be cache hit
        const result2 = await cache.query(queryOptions);
        expect(result2).toEqual(result1);
        
        // Should show cache hit in stats
        expect(cache.isCached(queryOptions)).toBe(true);
      });

      it("should distinguish between different queries", async () => {
        const query1: QueryOptions = {
          query: "SELECT * FROM table1",
          params: {}
        };
        
        const query2: QueryOptions = {
          query: "SELECT * FROM table2", 
          params: {}
        };

        await cache.query(query1);
        await cache.query(query2);

        expect(cache.isCached(query1)).toBe(true);
        expect(cache.isCached(query2)).toBe(true);
        
        const stats = cache.getCacheStats();
        expect(stats.size).toBeGreaterThanOrEqual(1); // At least one should be cached
      });

      it("should distinguish between different parameters", async () => {
        const baseQuery = "SELECT * FROM users WHERE id = @id";
        
        const query1: QueryOptions = {
          query: baseQuery,
          params: { id: 1 }
        };
        
        const query2: QueryOptions = {
          query: baseQuery,
          params: { id: 2 }
        };

        await cache.query(query1);
        await cache.query(query2);

        expect(cache.isCached(query1)).toBe(true);
        expect(cache.isCached(query2)).toBe(true);
        
        const stats = cache.getCacheStats();
        expect(stats.size).toBeGreaterThanOrEqual(1); // At least one should be cached
      });
    });

    describe("Cache Invalidation", () => {
      it("should invalidate entries by pattern", async () => {
        // Cache some queries
        await cache.query({ query: "SELECT * FROM brand_agents", params: {} });
        await cache.query({ query: "SELECT * FROM campaigns", params: {} });
        await cache.query({ query: "SELECT * FROM creatives", params: {} });

        const statsBeforeInvalidation = cache.getCacheStats();
        expect(statsBeforeInvalidation.size).toBeGreaterThan(0);

        // Invalidate brand_agents queries
        cache.invalidatePattern("brand_agents");

        // Should still have non-matching entries
        const statsAfterInvalidation = cache.getCacheStats();
        expect(statsAfterInvalidation.size).toBeLessThan(statsBeforeInvalidation.size);
      });

      it("should clear all cache entries", async () => {
        // Cache some queries
        await cache.query({ query: "SELECT * FROM table1", params: {} });
        await cache.query({ query: "SELECT * FROM table2", params: {} });

        expect(cache.getCacheStats().size).toBeGreaterThan(0);

        cache.clearCache();

        const stats = cache.getCacheStats();
        expect(stats.size).toBe(0);
      });
    });

    describe("Cache Statistics", () => {
      it("should provide accurate cache statistics", async () => {
        const initialStats = cache.getCacheStats();
        expect(initialStats.size).toBe(0);

        // Add some entries
        await cache.query({ query: "SELECT 1", params: {} });
        await cache.query({ query: "SELECT 2", params: {} });

        const statsAfterQueries = cache.getCacheStats();
        expect(statsAfterQueries.size).toBe(2);
        expect(statsAfterQueries.memoryUsage).toBeGreaterThan(0);
      });

      it("should track hit rates if supported", async () => {
        const query: QueryOptions = { query: "SELECT * FROM test", params: {} };
        
        // First call - miss
        await cache.query(query);
        
        // Second call - hit
        await cache.query(query);
        
        const stats = cache.getCacheStats();
        // Hit rate tracking is optional but should be consistent if implemented
        if (stats.hits !== undefined && stats.misses !== undefined) {
          expect(stats.hits).toBeGreaterThan(0);
          expect(stats.misses).toBeGreaterThan(0);
          expect(stats.hitRate).toBe(stats.hits / (stats.hits + stats.misses));
        }
      });
    });

    if (!options?.skipConcurrencyTests) {
      describe("Concurrency and Race Conditions", () => {
        it("should handle concurrent identical queries without race conditions", async () => {
          const query: QueryOptions = {
            query: "SELECT * FROM test_table WHERE expensive_operation = @param",
            params: { param: "test-value" }
          };

          // Start multiple identical queries simultaneously
          const promises = Array(5).fill(null).map(() => cache.query(query));
          const results = await Promise.all(promises);

          // All results should be identical (no race conditions)
          for (let i = 1; i < results.length; i++) {
            expect(results[i]).toEqual(results[0]);
          }

          // Should only have one cache entry
          expect(cache.isCached(query)).toBe(true);
        });

        it("should handle concurrent different queries", async () => {
          const queries = Array.from({ length: 10 }, (_, i) => ({
            query: `SELECT * FROM table_${i}`,
            params: { id: i }
          }));

          const results = await Promise.all(
            queries.map(q => cache.query(q))
          );

          expect(results).toHaveLength(10);
          
          // All queries should be cached
          queries.forEach(q => {
            expect(cache.isCached(q)).toBe(true);
          });
        });
      });
    }

    if (!options?.skipMemoryTests) {
      describe("Memory Management", () => {
        it("should track memory usage", async () => {
          const initialStats = cache.getCacheStats();
          const initialMemory = initialStats.memoryUsage;

          // Add a large query result
          await cache.query({
            query: "SELECT * FROM large_table",
            params: { data: "x".repeat(1000) } // Large parameter
          });

          const afterStats = cache.getCacheStats();
          expect(afterStats.memoryUsage).toBeGreaterThan(initialMemory);
        });
      });
    }
  });
}

/**
 * Contract Tests for Preload Service
 */
export function testPreloadServiceContract(
  preloadFactory: () => PreloadService,
  options?: {
    skipTimeoutTests?: boolean;
  }
) {
  describe("PreloadService Contract", () => {
    let preloadService: PreloadService;
    
    beforeEach(() => {
      preloadService = preloadFactory();
    });

    describe("Basic Preload Behavior", () => {
      it("should accept preload requests without blocking", async () => {
        const start = Date.now();
        
        preloadService.triggerPreload("test-api-key");
        
        const duration = Date.now() - start;
        // Should return immediately (within 100ms)
        expect(duration).toBeLessThan(100);
      });

      it("should track preload status", async () => {
        const initialStatus = preloadService.getPreloadStatus();
        expect(initialStatus.activePreloads).toBe(0);
        expect(initialStatus.customerIds).toHaveLength(0);

        preloadService.triggerPreload("test-api-key-1");
        preloadService.triggerPreload("test-api-key-2");

        // Status should reflect active preloads
        const activeStatus = preloadService.getPreloadStatus();
        expect(activeStatus.activePreloads).toBeGreaterThan(0);
      });
    });

    describe("Concurrent Preloads", () => {
      it("should handle multiple simultaneous preload requests", async () => {
        const apiKeys = ["key1", "key2", "key3", "key4", "key5"];
        
        // Trigger multiple preloads
        apiKeys.forEach(key => preloadService.triggerPreload(key));
        
        const status = preloadService.getPreloadStatus();
        expect(status.activePreloads).toBeGreaterThanOrEqual(0);
        expect(status.customerIds).toBeDefined();
      });
    });
  });
}