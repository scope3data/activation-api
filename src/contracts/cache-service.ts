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

export interface CacheStats {
  size: number;
  hitRate: number;
  memoryUsage: number;
  hits?: number;
  misses?: number;
}

export interface CacheService {
  /**
   * Execute a query with caching
   */
  query(options: QueryOptions): Promise<any>;
  
  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats;
  
  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern(pattern: string): void;
  
  /**
   * Clear all cache entries
   */
  clearCache(): void;
  
  /**
   * Check if a query result is cached
   */
  isCached(options: QueryOptions): boolean;
}

export interface QueryOptions {
  query: string;
  params?: Record<string, any>;
}

export interface PreloadService {
  /**
   * Trigger background preload for an API key
   */
  triggerPreload(apiKey: string): void;
  
  /**
   * Get current preload status
   */
  getPreloadStatus(): {
    activePreloads: number;
    customerIds: number[];
  };
  
  /**
   * Wait for preload completion (for testing)
   */
  waitForPreload(customerId: number, timeoutMs?: number): Promise<void>;
  
  /**
   * Wait for all active preloads to complete (for testing)
   */
  waitForAllPreloads?(): Promise<void>;
}