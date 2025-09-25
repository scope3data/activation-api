/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import type {
  CacheEntry,
  CacheService,
  CacheStats,
  QueryOptions,
} from "../contracts/cache-service.js";

/**
 * Test Double for Cache Service
 *
 * Provides a fast, in-memory implementation of CacheService for testing.
 * Simulates realistic caching behavior without external dependencies.
 */
export class CacheServiceTestDouble implements CacheService {
  private cache = new Map<string, { queryPattern: string } & CacheEntry<any>>();
  private hits = 0;
  private misses = 0;
  private queryExecutionDelay = 50; // Simulate network delay

  constructor(
    private config?: {
      defaultTTL?: number;
      executionDelay?: number;
      simulateErrors?: boolean;
    },
  ) {
    this.queryExecutionDelay = config?.executionDelay ?? 50;
  }

  clearCache(): void {
    this.cache.clear();
  }

  public forceExpire(options: QueryOptions): void {
    const cacheKey = this.generateCacheKey(options);
    const entry = this.cache.get(cacheKey);
    if (entry) {
      entry.timestamp = Date.now() - entry.ttl - 1000; // Force expiration
    }
  }

  getCacheStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    // Calculate memory usage
    let memoryUsage = 0;
    for (const entry of this.cache.values()) {
      memoryUsage += JSON.stringify(entry.data).length;
    }

    return {
      hitRate,
      hits: this.hits,
      memoryUsage: memoryUsage / (1024 * 1024), // Convert to MB
      misses: this.misses,
      size: this.cache.size,
    };
  }

  invalidatePattern(pattern: string): void {
    let invalidated = 0;
    const keysToDelete: string[] = [];

    // Collect keys to delete first to avoid mutation during iteration
    for (const [key, entry] of this.cache) {
      if (
        entry.queryPattern &&
        entry.queryPattern.toLowerCase().includes(pattern.toLowerCase())
      ) {
        keysToDelete.push(key);
        invalidated++;
      }
    }

    // Delete the collected keys
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  isCached(options: QueryOptions): boolean {
    const cacheKey = this.generateCacheKey(options);
    const entry = this.cache.get(cacheKey);

    if (!entry) return false;

    const age = Date.now() - entry.timestamp;
    return age <= entry.ttl;
  }

  async query(options: QueryOptions): Promise<any> {
    const cacheKey = this.generateCacheKey(options);

    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.hits++;
      return cached;
    }

    // Cache miss - simulate query execution
    this.misses++;
    await this.simulateQueryExecution(options);

    // Generate mock result based on query
    const result = this.generateMockResult(options);

    // Cache the result
    const ttl = this.determineTTL(options.query);
    const queryPattern = this.extractQueryPattern(options.query);
    this.cache.set(cacheKey, {
      data: result,
      queryPattern,
      timestamp: Date.now(),
      ttl,
    });

    return result;
  }

  // Test utilities
  public resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  public setExecutionDelay(delayMs: number): void {
    this.queryExecutionDelay = delayMs;
  }

  private determineTTL(query: string): number {
    const queryLower = query.toLowerCase();

    if (
      queryLower.includes("brand_agent") ||
      queryLower.includes("public_agent")
    ) {
      return 5 * 60 * 1000; // 5 minutes
    }

    if (queryLower.includes("campaigns")) {
      return 2 * 60 * 1000; // 2 minutes
    }

    if (queryLower.includes("creatives")) {
      return 5 * 60 * 1000; // 5 minutes
    }

    return 1 * 60 * 1000; // 1 minute default
  }

  private extractQueryPattern(query: string): string {
    const queryLower = query.toLowerCase();

    // Extract table names for safe pattern matching during invalidation
    const tables = [];
    const tablePatterns = [
      /from\s+[`"']?(\w+)[`"']?/g,
      /join\s+[`"']?(\w+)[`"']?/g,
      /update\s+[`"']?(\w+)[`"']?/g,
      /insert\s+into\s+[`"']?(\w+)[`"']?/g,
    ];

    for (const pattern of tablePatterns) {
      let match;
      while ((match = pattern.exec(queryLower)) !== null) {
        tables.push(match[1]);
      }
    }

    // Include operation type for more specific invalidation
    let operation = "select";
    if (queryLower.includes("insert")) operation = "insert";
    else if (queryLower.includes("update")) operation = "update";
    else if (queryLower.includes("delete")) operation = "delete";

    return `${operation}:${tables.join(",")}`;
  }

  private generateCacheKey(options: QueryOptions): string {
    const normalized = {
      params: options.params || {},
      query: options.query?.replace(/\s+/g, " ").trim(),
    };

    return Buffer.from(JSON.stringify(normalized)).toString("base64");
  }

  private generateMockResult(options: QueryOptions): any {
    const query = options.query.toLowerCase();

    // Generate realistic mock data based on query type
    if (query.includes("brand_agents") || query.includes("public_agent")) {
      return [
        [
          { customer_id: 123, id: "brand-1", name: "Test Brand 1" },
          { customer_id: 123, id: "brand-2", name: "Test Brand 2" },
        ],
      ];
    }

    if (query.includes("campaigns")) {
      return [
        [
          {
            brand_agent_id: "brand-1",
            created_at: new Date().toISOString(),
            id: "campaign-1",
            name: "Test Campaign 1",
            status: "active",
          },
          {
            brand_agent_id: "brand-1",
            created_at: new Date().toISOString(),
            id: "campaign-2",
            name: "Test Campaign 2",
            status: "paused",
          },
        ],
      ];
    }

    if (query.includes("creatives")) {
      return [
        [
          { format: "banner", id: "creative-1", name: "Test Creative 1" },
          { format: "video", id: "creative-2", name: "Test Creative 2" },
        ],
      ];
    }

    // Default mock result
    return [
      [
        {
          data: "mock-result",
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
        },
      ],
    ];
  }

  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private async simulateQueryExecution(options: QueryOptions): Promise<void> {
    if (this.config?.simulateErrors && Math.random() < 0.1) {
      throw new Error(
        `Simulated database error for query: ${options.query.substring(0, 50)}`,
      );
    }

    // Simulate network/database delay
    await new Promise((resolve) =>
      setTimeout(resolve, this.queryExecutionDelay),
    );
  }
}
