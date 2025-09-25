/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Cache Service Contract
 *
 * Defines the interface that any cache implementation must satisfy.
 * This enables backend-independent testing where caching behavior
 * is validated regardless of the underlying storage technology.
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheService {
  /**
   * Clear all cache entries
   */
  clearCache(): void;

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats;

  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern(pattern: string): void;

  /**
   * Check if a query result is cached
   */
  isCached(options: QueryOptions): boolean;

  /**
   * Execute a query with caching
   */
  query(options: QueryOptions): Promise<any>;
}

export interface CacheStats {
  hitRate: number;
  hits?: number;
  memoryUsage: number;
  misses?: number;
  size: number;
}

export interface PreloadService {
  /**
   * Get current preload status
   */
  getPreloadStatus(): {
    activePreloads: number;
    customerIds: number[];
  };

  /**
   * Trigger background preload for an API key
   */
  triggerPreload(apiKey: string): void;

  /**
   * Wait for all active preloads to complete (for testing)
   */
  waitForAllPreloads?(): Promise<void>;

  /**
   * Wait for preload completion (for testing)
   */
  waitForPreload(customerId: number, timeoutMs?: number): Promise<void>;
}

export interface QueryOptions {
  params?: Record<string, any>;
  query: string;
}
