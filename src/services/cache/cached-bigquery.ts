import { BigQuery } from "@google-cloud/bigquery";
import { createHash } from "crypto";
import type { QueryRowsResponse } from "@google-cloud/bigquery";
import type { CacheService, CacheStats, QueryOptions } from "../../contracts/cache-service.js";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  size: number; // Estimated memory size in bytes
  queryPattern: string; // Store query pattern for invalidation (not the full query for security)
}

interface CacheConfig {
  ttl: {
    brandAgents: number;
    campaigns: number;
    creatives: number;
    default: number;
  };
  maxMemoryMB: number;
  preloadOnConnect: boolean;
}

export class CachedBigQuery extends BigQuery implements CacheService {
  private cache = new Map<string, CacheEntry<QueryRowsResponse>>();
  private accessOrder = new Map<string, number>(); // Track access order for LRU
  private inFlightRequests = new Map<string, Promise<QueryRowsResponse>>();
  private hits = 0;
  private misses = 0;
  private currentMemoryBytes = 0;
  private accessCounter = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private cleanupHandler: (() => void) | null = null;
  
  constructor(
    options: unknown,
    private cacheConfig: CacheConfig
  ) {
    super(options as ConstructorParameters<typeof BigQuery>[0]);
    console.log('[Cache] CachedBigQuery initialized with config:', cacheConfig);
    
    // Cleanup old entries every 5 minutes - store reference for cleanup
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 5 * 60 * 1000);
    
    // Add process exit handlers for cleanup - store reference to remove later
    this.cleanupHandler = () => this.destroy();
    
    // In test environment, reduce cleanup interval and avoid adding too many listeners
    if (process.env.NODE_ENV === 'test') {
      // Use shorter interval for tests and don't add process listeners to prevent accumulation
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = setInterval(() => this.cleanupExpired(), 10 * 1000); // 10 seconds in tests
      }
    } else {
      process.on('exit', this.cleanupHandler);
      process.on('SIGINT', this.cleanupHandler);
      process.on('SIGTERM', this.cleanupHandler);
      process.on('uncaughtException', this.cleanupHandler);
    }
  }

  // Override the query method to add caching - need to support all BigQuery overloads
  async query(...args: Parameters<BigQuery['query']>): Promise<QueryRowsResponse> {
    // Extract the main query parameter for caching key generation
    const options = args[0];
    const cacheKey = this.generateCacheKey(options);
    
    // Check if we're already fetching this exact query
    if (this.inFlightRequests.has(cacheKey)) {
      console.log(`[Cache] Waiting for in-flight request: ${cacheKey.substring(0, 50)}...`);
      return this.inFlightRequests.get(cacheKey);
    }
    
    // Check cache
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log(`[Cache] Hit: ${cacheKey.substring(0, 50)}...`);
      this.hits++;
      return cached;
    }
    
    // Cache miss - increment counter
    this.misses++;
    
    // Create promise for this request to prevent races
    const requestPromise = this.fetchAndCache(args, cacheKey);
    this.inFlightRequests.set(cacheKey, requestPromise);
    
    try {
      const result = await requestPromise;
      // Move cleanup inside try block to prevent race conditions
      this.inFlightRequests.delete(cacheKey);
      return result;
    } catch (error) {
      this.inFlightRequests.delete(cacheKey);
      throw error;
    }
  }
  
  private async fetchAndCache(args: Parameters<BigQuery['query']>, cacheKey: string): Promise<QueryRowsResponse> {
    console.log(`[Cache] Miss, fetching: ${cacheKey.substring(0, 50)}...`);
    const startTime = Date.now();
    
    try {
      const result = await (super.query as any)(...args);
      const queryTime = Date.now() - startTime;
      
      // Calculate entry size for memory tracking
      const entrySize = this.calculateEntrySize(result);
      
      // Determine TTL based on query type
      const options = args[0];
      const queryString = typeof options === 'string' ? options : (options as any)?.query || '';
      const ttl = this.determineTTL(queryString);
      
      // Check memory limits and evict if necessary before adding
      this.enforceMemoryLimit(entrySize);
      
      // Extract query pattern for safe invalidation (table names only, not full query)
      const queryPattern = this.extractQueryPattern(queryString);
      
      // Add to cache with memory tracking and LRU ordering
      const entry: CacheEntry<QueryRowsResponse> = {
        data: result,
        timestamp: Date.now(),
        ttl,
        size: entrySize,
        queryPattern
      };
      
      this.cache.set(cacheKey, entry);
      this.accessOrder.set(cacheKey, ++this.accessCounter);
      this.currentMemoryBytes += entrySize;
      
      console.log(`[Cache] Cached result (${queryTime}ms, TTL: ${ttl}ms, Size: ${(entrySize/1024).toFixed(1)}KB): ${cacheKey.substring(0, 50)}...`);
      return result;
    } catch (error) {
      console.error(`[Cache] Query failed (${Date.now() - startTime}ms): ${cacheKey.substring(0, 50)}...`, error);
      throw error;
    }
  }
  
  private getFromCache(key: string): QueryRowsResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.removeFromCache(key);
      console.log(`[Cache] Expired entry removed: ${key.substring(0, 50)}...`);
      return null;
    }
    
    // Update access order for LRU tracking
    this.accessOrder.set(key, ++this.accessCounter);
    
    return entry.data;
  }
  
  private calculateEntrySize(data: unknown): number {
    try {
      return JSON.stringify(data).length * 2; // Rough estimate: 2 bytes per character (UTF-16)
    } catch {
      return 1024; // Default size if can't stringify
    }
  }
  
  private enforceMemoryLimit(newEntrySize: number): void {
    const maxBytes = this.cacheConfig.maxMemoryMB * 1024 * 1024;
    const targetBytes = maxBytes * 0.8; // Target 80% of max to avoid constant eviction
    
    // If adding this entry would exceed the limit, evict LRU entries
    while (this.currentMemoryBytes + newEntrySize > maxBytes && this.cache.size > 0) {
      this.evictLRUEntry();
    }
    
    // If we're over target utilization, proactively evict some entries
    while (this.currentMemoryBytes > targetBytes && this.cache.size > 0) {
      this.evictLRUEntry();
    }
  }
  
  private evictLRUEntry(): void {
    // Find the least recently used entry (lowest access counter)
    let lruKey: string | null = null;
    let minAccessTime = Infinity;
    
    for (const [key, accessTime] of this.accessOrder.entries()) {
      if (accessTime < minAccessTime) {
        minAccessTime = accessTime;
        lruKey = key;
      }
    }
    
    if (lruKey) {
      this.removeFromCache(lruKey);
      console.log(`[Cache] Evicted LRU entry for memory limit: ${lruKey.substring(0, 50)}...`);
    }
  }
  
  private removeFromCache(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentMemoryBytes -= entry.size;
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }
  }
  
  private generateCacheKey(options: Parameters<BigQuery['query']>[0]): string {
    let query = '';
    let params: Record<string, unknown> = {};
    
    if (typeof options === 'string') {
      query = options;
    } else if (options && typeof options === 'object') {
      const optionsObj = options as any;
      query = optionsObj.query || '';
      params = optionsObj.params || optionsObj.values || {};
    }
    
    // Extract customer context from query parameters for cache partitioning
    const customerContext = this.extractCustomerContext(params);
    
    // Create a deterministic cache key with customer scoping
    const queryData = {
      query: query.replace(/\s+/g, ' ').trim(),
      params: this.sortObjectRecursively(params)
    };
    
    // Use SHA-256 for secure hashing instead of Base64 encoding
    // Don't use key filtering since sortObjectRecursively already ensures deterministic ordering
    const queryJson = JSON.stringify(queryData);
    const queryHash = createHash('sha256').update(queryJson).digest('hex').substring(0, 16);
    
    // Multi-tenant cache key format: customer:query_type:hash
    const keyPrefix = customerContext ? `customer:${customerContext}` : 'global';
    return `bq:${keyPrefix}:${queryHash}`;
  }
  
  /**
   * Recursively sort object properties for deterministic JSON serialization
   * Ensures consistent cache keys regardless of property order
   */
  private sortObjectRecursively(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectRecursively(item));
    }
    
    const sortedObj: Record<string, any> = {};
    const sortedKeys = Object.keys(obj).sort();
    
    for (const key of sortedKeys) {
      sortedObj[key] = this.sortObjectRecursively(obj[key]);
    }
    
    return sortedObj;
  }

  /**
   * Extract customer context from query parameters for cache partitioning
   * Critical for multi-tenant ad tech systems to prevent data leakage
   */
  private extractCustomerContext(params: Record<string, unknown>): string | null {
    // Look for customer identifiers in common parameter patterns
    const customerKeys = ['customerId', 'customer_id', 'apiKey', 'brandAgentId', 'brand_agent_id'];
    
    for (const key of customerKeys) {
      if (params[key]) {
        // Use SHA-256 hash for secure customer identifier hashing
        const customerValue = String(params[key]);
        return createHash('sha256').update(customerValue).digest('hex').substring(0, 8);
      }
    }
    
    // Check for customer context in query string itself
    // This is a fallback for queries that embed customer IDs directly
    return null;
  }
  
  /**
   * Extract safe query pattern for cache invalidation
   * Only extracts table names, not sensitive data
   */
  private extractQueryPattern(query: string): string {
    const queryLower = query.toLowerCase();
    
    // Extract table names for safe pattern matching during invalidation
    const tables = [];
    const tablePatterns = [
      /from\s+[`"']?(\w+)[`"']?/g,
      /join\s+[`"']?(\w+)[`"']?/g,
      /update\s+[`"']?(\w+)[`"']?/g,
      /insert\s+into\s+[`"']?(\w+)[`"']?/g
    ];
    
    for (const pattern of tablePatterns) {
      let match;
      while ((match = pattern.exec(queryLower)) !== null) {
        tables.push(match[1]);
      }
    }
    
    // Include operation type for more specific invalidation
    let operation = 'select';
    if (queryLower.includes('insert')) operation = 'insert';
    else if (queryLower.includes('update')) operation = 'update';
    else if (queryLower.includes('delete')) operation = 'delete';
    
    return `${operation}:${tables.join(',')}`;
  }
  
  private determineTTL(query: string): number {
    const queryLower = query.toLowerCase();
    
    // CRITICAL: Budget and spend tracking - shortest TTL for financial data
    if (this.isSpendTrackingQuery(queryLower)) {
      return 10 * 1000; // 10 seconds - critical for budget protection
    }
    
    if (this.isBudgetStatusQuery(queryLower)) {
      return 15 * 1000; // 15 seconds - budget exhaustion checks
    }
    
    // Campaign status changes (active/paused) - high priority
    if (this.isCampaignStatusQuery(queryLower)) {
      return 30 * 1000; // 30 seconds - campaign state changes
    }
    
    // Creative assignments - medium-high priority
    if (this.isCreativeAssignmentQuery(queryLower)) {
      return 45 * 1000; // 45 seconds - creative rotations
    }
    
    // Check for specific table references in FROM clauses first (most specific)
    if (this.isQueryForTable(queryLower, 'campaigns')) {
      return this.cacheConfig.ttl.campaigns;
    }
    
    if (this.isQueryForTable(queryLower, 'brand_agents') || this.isQueryForTable(queryLower, 'public_agent')) {
      return this.cacheConfig.ttl.brandAgents;
    }
    
    if (this.isQueryForTable(queryLower, 'creatives')) {
      return this.cacheConfig.ttl.creatives;
    }
    
    // Default TTL for other queries
    return this.cacheConfig.ttl.default;
  }
  
  /**
   * Identify spend tracking queries - CRITICAL for ad tech budget management
   */
  private isSpendTrackingQuery(query: string): boolean {
    const spendKeywords = [
      'spend', 'cost', 'budget_spent', 'daily_spend', 'hourly_spend',
      'impressions', 'clicks', 'conversions', 'cpm', 'cpc', 'cpa'
    ];
    
    return spendKeywords.some(keyword => query.includes(keyword));
  }
  
  /**
   * Identify budget status queries - HIGH priority for budget protection
   */
  private isBudgetStatusQuery(query: string): boolean {
    const budgetKeywords = [
      'budget_remaining', 'budget_total', 'budget_daily', 'budget_status',
      'pacing', 'allocation', 'budget_utilization'
    ];
    
    return budgetKeywords.some(keyword => query.includes(keyword));
  }
  
  /**
   * Identify campaign status queries - affects campaign delivery
   */
  private isCampaignStatusQuery(query: string): boolean {
    return query.includes('status') && query.includes('campaign');
  }
  
  /**
   * Identify creative assignment queries - affects ad serving
   */
  private isCreativeAssignmentQuery(query: string): boolean {
    return (query.includes('campaign_creatives') || 
            query.includes('creative_assignments') ||
            (query.includes('creative') && query.includes('campaign')));
  }
  
  /**
   * Check if query is specifically targeting a table (more precise than substring matching)
   * Looks for "FROM table_name" patterns to avoid false positives
   */
  private isQueryForTable(query: string, tableName: string): boolean {
    // Match patterns like "FROM table_name" or "from table_name" with word boundaries
    const fromPattern = new RegExp(`\\bfrom\\s+[\`"']?${tableName}[\`"']?\\b`, 'i');
    // Also match patterns like "JOIN table_name" 
    const joinPattern = new RegExp(`\\bjoin\\s+[\`"']?${tableName}[\`"']?\\b`, 'i');
    // Match UPDATE or INSERT INTO patterns
    const updatePattern = new RegExp(`\\bupdate\\s+[\`"']?${tableName}[\`"']?\\b`, 'i');
    const insertPattern = new RegExp(`\\binsert\\s+into\\s+[\`"']?${tableName}[\`"']?\\b`, 'i');
    
    return fromPattern.test(query) || joinPattern.test(query) || updatePattern.test(query) || insertPattern.test(query);
  }
  
  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;
    let freedMemory = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        freedMemory += entry.size;
        this.cache.delete(key);
        this.accessOrder.delete(key);
        cleaned++;
      }
    }
    
    this.currentMemoryBytes -= freedMemory;
    
    if (cleaned > 0) {
      console.log(`[Cache] Cleaned up ${cleaned} expired entries, freed ${(freedMemory/1024).toFixed(1)}KB. Cache size: ${this.cache.size}`);
    }
  }
  
  // Invalidate cache entries by pattern
  invalidatePattern(pattern: string): void {
    let invalidated = 0;
    let freedMemory = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      // Check if the stored query pattern matches the invalidation pattern
      if (entry.queryPattern.toLowerCase().includes(pattern.toLowerCase())) {
        freedMemory += entry.size;
        this.cache.delete(key);
        this.accessOrder.delete(key);
        invalidated++;
      }
    }
    
    this.currentMemoryBytes -= freedMemory;
    
    console.log(`[Cache] Invalidated ${invalidated} entries matching pattern: ${pattern}, freed ${(freedMemory/1024).toFixed(1)}KB`);
  }
  
  // Get cache stats
  getCacheStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
    
    return {
      size: this.cache.size,
      hitRate,
      memoryUsage: this.currentMemoryBytes / (1024 * 1024), // MB
      hits: this.hits,
      misses: this.misses
    };
  }
  
  // Clear all cache entries
  clearCache(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.inFlightRequests.clear();
    this.hits = 0;
    this.misses = 0;
    this.currentMemoryBytes = 0;
    this.accessCounter = 0;
    console.log('[Cache] All cache entries cleared');
  }
  
  // Destroy the cache instance and cleanup resources
  destroy(): void {
    this.clearCache();
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Remove process event listeners to prevent memory leaks
    if (this.cleanupHandler) {
      process.off('exit', this.cleanupHandler);
      process.off('SIGINT', this.cleanupHandler);
      process.off('SIGTERM', this.cleanupHandler);
      process.off('uncaughtException', this.cleanupHandler);
      this.cleanupHandler = null;
    }
    
    console.log('[Cache] Cache instance destroyed');
  }
  
  // Check if a query result is cached
  isCached(options: QueryOptions): boolean {
    const cacheKey = this.generateCacheKey(options);
    const entry = this.cache.get(cacheKey);
    
    if (!entry) return false;
    
    const age = Date.now() - entry.timestamp;
    return age <= entry.ttl;
  }
}

// Default cache configuration
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttl: {
    brandAgents: 5 * 60 * 1000,    // 5 minutes
    campaigns: 2 * 60 * 1000,      // 2 minutes
    creatives: 5 * 60 * 1000,      // 5 minutes
    default: 1 * 60 * 1000         // 1 minute
  },
  maxMemoryMB: 100,
  preloadOnConnect: true
};