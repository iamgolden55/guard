/**
 * Optimized API Client with Performance Enhancements
 *
 * Features:
 * - Request/Response caching with TTL
 * - Request deduplication
 * - Response compression
 * - Performance monitoring
 * - Error recovery and retry logic
 * - Payload size optimization
 *
 * TARGET METRICS:
 * - API Response Time: < 200ms
 * - Cache Hit Ratio: > 80%
 * - Request Deduplication: 90%+
 * - Bundle Size Impact: < 10KB gzipped
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig
} from 'axios';

// Performance monitoring types
interface PerformanceMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
  errorCount: number;
  deduplicationCount: number;
}

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  etag?: string;
}

interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  enableCaching: boolean;
  enableDeduplication: boolean;
  enableCompression: boolean;
  cacheMaxSize: number;
  defaultCacheTTL: number;
}

// Request deduplication registry
const pendingRequests = new Map<string, Promise<AxiosResponse<any>>>();

// Response cache with LRU eviction
class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL expiration
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  set(key: string, data: T, ttl: number, etag?: string): void {
    // Remove oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      etag
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      if (now <= entry.timestamp + entry.ttl) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      maxSize: this.maxSize
    };
  }
}

class OptimizedApiClient {
  private client: AxiosInstance;
  private cache: LRUCache<any>;
  private config: ApiClientConfig;
  private metrics: PerformanceMetrics;

  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = {
      baseURL: import.meta.env.VITE_API_URL || '', // Use VITE_API_URL if set, else relative
      timeout: 10000, // 10 seconds
      enableCaching: true,
      enableDeduplication: true,
      enableCompression: true,
      cacheMaxSize: 200,
      defaultCacheTTL: 5 * 60 * 1000, // 5 minutes
      ...config
    };

    this.cache = new LRUCache(this.config.cacheMaxSize);
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      errorCount: 0,
      deduplicationCount: 0
    };

    this.client = this.createAxiosInstance();
    this.setupInterceptors();
  }

  private createAxiosInstance(): AxiosInstance {
    return axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      withCredentials: true, // Send httpOnly cookies for authentication
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.enableCompression && {
          'Accept-Encoding': 'gzip, deflate, br'
        })
      }
    });
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const startTime = performance.now();
        config.metadata = { startTime };

        // Auth is handled via httpOnly cookies (withCredentials: true).
        // No Authorization header from localStorage.

        // Add company context if available
        const companyId = this.getCurrentCompanyId();
        if (companyId) {
          config.headers['X-Company-ID'] = companyId;
        }

        return config;
      },
      (error: AxiosError) => {
        this.metrics.errorCount++;
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        const endTime = performance.now();
        const requestStartTime = response.config.metadata?.startTime || endTime;
        const responseTime = endTime - requestStartTime;

        // Update performance metrics
        this.updateMetrics(responseTime);

        // Cache successful GET responses
        if (this.shouldCacheResponse(response)) {
          this.cacheResponse(response, responseTime);
        }

        return response;
      },
      (error: AxiosError) => {
        this.metrics.errorCount++;

        // Retry logic for specific error types
        if (this.shouldRetry(error)) {
          return this.retryRequest(error);
        }

        return Promise.reject(error);
      }
    );
  }

  private generateCacheKey(config: AxiosRequestConfig): string {
    const { method, url, params, data } = config;
    const companyId = this.getCurrentCompanyId();
    return `${method}:${url}:${JSON.stringify(params)}:${JSON.stringify(data)}:${companyId}`;
  }

  private generateRequestKey(config: AxiosRequestConfig): string {
    const { method, url, params } = config;
    return `${method}:${url}:${JSON.stringify(params)}`;
  }

  private shouldCacheResponse(response: AxiosResponse): boolean {
    return (
      this.config.enableCaching &&
      response.config.method?.toUpperCase() === 'GET' &&
      response.status === 200 &&
      !response.config.headers?.['Cache-Control']?.includes('no-cache')
    );
  }

  private cacheResponse(response: AxiosResponse, responseTime: number): void {
    const cacheKey = this.generateCacheKey(response.config);
    const ttl = this.getCacheTTL(response);
    const etag = response.headers.etag;

    this.cache.set(cacheKey, response.data, ttl, etag);
  }

  private getCacheTTL(response: AxiosResponse): number {
    // Check Cache-Control header
    const cacheControl = response.headers['cache-control'];
    if (cacheControl) {
      const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
      if (maxAgeMatch) {
        return parseInt(maxAgeMatch[1]) * 1000; // Convert to milliseconds
      }
    }

    // Use default TTL based on endpoint
    const url = response.config.url || '';
    if (url.includes('/companies/') || url.includes('/compliance/')) {
      return 10 * 60 * 1000; // 10 minutes for company/compliance data
    }
    if (url.includes('/dashboard/') || url.includes('/summary/')) {
      return 2 * 60 * 1000; // 2 minutes for dashboard data
    }

    return this.config.defaultCacheTTL;
  }

  private updateMetrics(responseTime: number): void {
    this.metrics.totalRequests++;

    // Update average response time using exponential moving average
    const alpha = 0.1;
    this.metrics.averageResponseTime =
      this.metrics.averageResponseTime * (1 - alpha) + responseTime * alpha;
  }

  private shouldRetry(error: AxiosError): boolean {
    // Retry on network errors or 5xx status codes
    return (
      !error.response ||
      (error.response.status >= 500 && error.response.status < 600) ||
      error.code === 'NETWORK_ERROR' ||
      error.code === 'TIMEOUT'
    );
  }

  private async retryRequest(error: AxiosError, retryCount: number = 0): Promise<AxiosResponse> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    if (retryCount >= maxRetries) {
      return Promise.reject(error);
    }

    // Exponential backoff with jitter
    const delay = baseDelay * Math.pow(2, retryCount) + Math.random() * 1000;

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      return await this.client.request(error.config!);
    } catch (retryError) {
      return this.retryRequest(retryError as AxiosError, retryCount + 1);
    }
  }

  private getAuthToken(): string | null {
    // Auth is handled via httpOnly cookies — no localStorage token access needed
    try {
      return null;
    } catch {
      return null;
    }
  }

  private getCurrentCompanyId(): string | null {
    try {
      const companyContext = localStorage.getItem('current_company');
      return companyContext ? JSON.parse(companyContext).id : null;
    } catch {
      return null;
    }
  }

  // Public API methods

  /**
   * GET request with caching and deduplication
   */
  async get<T = any>(
    url: string,
    config: AxiosRequestConfig = {},
    cacheTTL?: number
  ): Promise<AxiosResponse<T>> {
    const fullConfig = { ...config, method: 'GET', url };
    const cacheKey = this.generateCacheKey(fullConfig);
    const requestKey = this.generateRequestKey(fullConfig);

    // Check cache first
    if (this.config.enableCaching) {
      const cachedData = this.cache.get(cacheKey);
      if (cachedData) {
        this.metrics.cacheHits++;
        return {
          data: cachedData,
          status: 200,
          statusText: 'OK (cached)',
          headers: {},
          config: fullConfig
        } as AxiosResponse<T>;
      }
      this.metrics.cacheMisses++;
    }

    // Check for pending identical request
    if (this.config.enableDeduplication && pendingRequests.has(requestKey)) {
      this.metrics.deduplicationCount++;
      return pendingRequests.get(requestKey)! as Promise<AxiosResponse<T>>;
    }

    // Make the request
    const requestPromise = this.client.get<T>(url, config);

    if (this.config.enableDeduplication) {
      pendingRequests.set(requestKey, requestPromise);
    }

    try {
      const response = await requestPromise;

      // Cache the response with custom TTL if provided
      if (this.config.enableCaching && cacheTTL) {
        this.cache.set(cacheKey, response.data, cacheTTL);
      }

      return response;
    } finally {
      if (this.config.enableDeduplication) {
        pendingRequests.delete(requestKey);
      }
    }
  }

  /**
   * POST request with optimized payload
   */
  async post<T = any>(
    url: string,
    data?: any,
    config: AxiosRequestConfig = {}
  ): Promise<AxiosResponse<T>> {
    // Optimize payload size
    const optimizedData = this.optimizePayload(data);

    return this.client.post<T>(url, optimizedData, config);
  }

  /**
   * PUT request with optimized payload
   */
  async put<T = any>(
    url: string,
    data?: any,
    config: AxiosRequestConfig = {}
  ): Promise<AxiosResponse<T>> {
    // Invalidate related cache entries
    this.invalidateCache(url);

    const optimizedData = this.optimizePayload(data);
    return this.client.put<T>(url, optimizedData, config);
  }

  /**
   * DELETE request with cache invalidation
   */
  async delete<T = any>(
    url: string,
    config: AxiosRequestConfig = {}
  ): Promise<AxiosResponse<T>> {
    // Invalidate related cache entries
    this.invalidateCache(url);

    return this.client.delete<T>(url, config);
  }

  /**
   * Optimize request payload by removing undefined values and compressing data
   */
  private optimizePayload(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // Remove undefined values and empty strings
    const optimized = JSON.parse(JSON.stringify(data, (key, value) => {
      if (value === undefined || value === '') {
        return undefined;
      }
      return value;
    }));

    return optimized;
  }

  /**
   * Invalidate cache entries related to a URL pattern
   */
  private invalidateCache(urlPattern: string): void {
    // Simple pattern matching - could be enhanced with regex
    const keys = Array.from((this.cache as any).cache.keys());
    const keysToDelete = keys.filter((key: string) => key.includes(urlPattern));

    keysToDelete.forEach((key: string) => {
      this.cache.delete(key);
    });
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics & {
    cacheStats: ReturnType<LRUCache<any>['getStats']>;
    cacheHitRatio: number;
  } {
    return {
      ...this.metrics,
      cacheStats: this.cache.getStats(),
      cacheHitRatio: this.metrics.totalRequests > 0
        ? this.metrics.cacheHits / this.metrics.totalRequests
        : 0
    };
  }

  /**
   * Clear all caches and pending requests
   */
  clearCache(): void {
    this.cache.clear();
    pendingRequests.clear();
  }

  /**
   * Configure cache settings
   */
  configureCaching(options: Partial<{
    enabled: boolean;
    maxSize: number;
    defaultTTL: number;
  }>): void {
    if (options.enabled !== undefined) {
      this.config.enableCaching = options.enabled;
    }
    if (options.maxSize !== undefined) {
      this.config.cacheMaxSize = options.maxSize;
      this.cache = new LRUCache(options.maxSize);
    }
    if (options.defaultTTL !== undefined) {
      this.config.defaultCacheTTL = options.defaultTTL;
    }
  }
}

// Create singleton instance
const optimizedApiClient = new OptimizedApiClient();

// Export convenience methods
export const api = {
  get: optimizedApiClient.get.bind(optimizedApiClient),
  post: optimizedApiClient.post.bind(optimizedApiClient),
  put: optimizedApiClient.put.bind(optimizedApiClient),
  delete: optimizedApiClient.delete.bind(optimizedApiClient),
  getMetrics: optimizedApiClient.getMetrics.bind(optimizedApiClient),
  clearCache: optimizedApiClient.clearCache.bind(optimizedApiClient),
  configureCaching: optimizedApiClient.configureCaching.bind(optimizedApiClient),
};

export default optimizedApiClient;

// Performance monitoring hook for React components
export const useApiPerformance = () => {
  const [metrics, setMetrics] = React.useState(optimizedApiClient.getMetrics());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(optimizedApiClient.getMetrics());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return metrics;
};