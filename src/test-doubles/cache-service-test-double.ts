/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import type {
  CacheService,
  CacheEntry,
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
  private cache = new Map<string, CacheEntry<any> & { queryPattern: string }>();
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
      timestamp: Date.now(),
      ttl,
      queryPattern,
    });

    return result;
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
      size: this.cache.size,
      hitRate,
      memoryUsage: memoryUsage / (1024 * 1024), // Convert to MB
      hits: this.hits,
      misses: this.misses,
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

  clearCache(): void {
    this.cache.clear();
  }

  isCached(options: QueryOptions): boolean {
    const cacheKey = this.generateCacheKey(options);
    const entry = this.cache.get(cacheKey);

    if (!entry) return false;

    const age = Date.now() - entry.timestamp;
    return age <= entry.ttl;
  }

  // Test utilities
  public resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  public forceExpire(options: QueryOptions): void {
    const cacheKey = this.generateCacheKey(options);
    const entry = this.cache.get(cacheKey);
    if (entry) {
      entry.timestamp = Date.now() - entry.ttl - 1000; // Force expiration
    }
  }

  public setExecutionDelay(delayMs: number): void {
    this.queryExecutionDelay = delayMs;
  }

  private generateCacheKey(options: QueryOptions): string {
    const normalized = {
      query: options.query?.replace(/\s+/g, " ").trim(),
      params: options.params || {},
    };

    return Buffer.from(JSON.stringify(normalized)).toString("base64");
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

  private generateMockResult(options: QueryOptions): any {
    const query = options.query.toLowerCase();

    // Generate realistic mock data based on query type
    if (query.includes("brand_agents") || query.includes("public_agent")) {
      return [
        [
          { id: "brand-1", name: "Test Brand 1", customer_id: 123 },
          { id: "brand-2", name: "Test Brand 2", customer_id: 123 },
        ],
      ];
    }

    if (query.includes("campaigns")) {
      return [
        [
          {
            id: "campaign-1",
            name: "Test Campaign 1",
            brand_agent_id: "brand-1",
            status: "active",
            created_at: new Date().toISOString(),
          },
          {
            id: "campaign-2",
            name: "Test Campaign 2",
            brand_agent_id: "brand-1",
            status: "paused",
            created_at: new Date().toISOString(),
          },
        ],
      ];
    }

    if (query.includes("creatives")) {
      return [
        [
          { id: "creative-1", name: "Test Creative 1", format: "banner" },
          { id: "creative-2", name: "Test Creative 2", format: "video" },
        ],
      ];
    }

    // Default mock result
    return [
      [
        {
          id: Date.now().toString(),
          data: "mock-result",
          timestamp: new Date().toISOString(),
        },
      ],
    ];
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
}
