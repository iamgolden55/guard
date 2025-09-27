/**
 * Performance Monitoring and Alerting System
 *
 * Comprehensive performance monitoring for the Security Firm Onboarding System.
 * Tracks all critical metrics and alerts when thresholds are exceeded.
 *
 * MONITORING TARGETS:
 * - Page Load Time: < 2 seconds
 * - Animation FPS: 60 FPS maintained
 * - API Response Time: < 200ms
 * - Bundle Size: < 200KB gzipped
 * - First Input Delay: < 100ms
 * - Cumulative Layout Shift: < 0.1
 */

import { api } from '../services/optimizedApiClient';

// Performance thresholds configuration
export const PERFORMANCE_THRESHOLDS = {
  // Core Web Vitals
  firstContentfulPaint: 1500, // 1.5s
  largestContentfulPaint: 2500, // 2.5s
  firstInputDelay: 100, // 100ms
  cumulativeLayoutShift: 0.1,
  timeToInteractive: 3000, // 3s

  // Custom metrics
  pageLoadTime: 2000, // 2s
  apiResponseTime: 200, // 200ms
  animationFrameRate: 55, // Allow 5fps buffer below target 60fps
  bundleSize: 204800, // 200KB
  cacheHitRatio: 0.8, // 80%

  // Database performance
  databaseQueryTime: 50, // 50ms for company queries
  connectionCount: 20,

  // Memory and resource usage
  memoryUsage: 100 * 1024 * 1024, // 100MB
  domNodes: 5000,
  eventListeners: 1000
};

// Performance metric types
interface PerformanceMetric {
  name: string;
  value: number;
  threshold: number;
  timestamp: number;
  category: 'web-vitals' | 'custom' | 'api' | 'database' | 'animation';
  severity: 'info' | 'warning' | 'error';
}

interface PerformanceAlert {
  id: string;
  metric: string;
  message: string;
  severity: 'warning' | 'error';
  timestamp: number;
  resolved: boolean;
  recommendations: string[];
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private observers: PerformanceObserver[] = [];
  private intervalIds: number[] = [];
  private isMonitoring = false;

  // Singleton pattern
  private static instance: PerformanceMonitor;
  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.setupWebVitalsMonitoring();
    this.setupCustomMetricsMonitoring();
    this.setupAnimationMonitoring();
    this.setupApiMonitoring();
    this.setupMemoryMonitoring();

    console.log('🚀 Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;

    // Clear all observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];

    // Clear all intervals
    this.intervalIds.forEach(id => clearInterval(id));
    this.intervalIds = [];

    console.log('⏹️ Performance monitoring stopped');
  }

  /**
   * Set up Core Web Vitals monitoring
   */
  private setupWebVitalsMonitoring(): void {
    if (!('PerformanceObserver' in window)) {
      console.warn('PerformanceObserver not supported');
      return;
    }

    // Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };

      this.recordMetric({
        name: 'Largest Contentful Paint',
        value: lastEntry.startTime,
        threshold: PERFORMANCE_THRESHOLDS.largestContentfulPaint,
        category: 'web-vitals'
      });
    });

    try {
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);
    } catch (error) {
      console.warn('LCP monitoring not supported:', error);
    }

    // First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        this.recordMetric({
          name: 'First Input Delay',
          value: entry.processingStart - entry.startTime,
          threshold: PERFORMANCE_THRESHOLDS.firstInputDelay,
          category: 'web-vitals'
        });
      });
    });

    try {
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);
    } catch (error) {
      console.warn('FID monitoring not supported:', error);
    }

    // Cumulative Layout Shift (CLS)
    const clsObserver = new PerformanceObserver((list) => {
      let clsValue = 0;
      const entries = list.getEntries();

      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });

      if (clsValue > 0) {
        this.recordMetric({
          name: 'Cumulative Layout Shift',
          value: clsValue,
          threshold: PERFORMANCE_THRESHOLDS.cumulativeLayoutShift,
          category: 'web-vitals'
        });
      }
    });

    try {
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);
    } catch (error) {
      console.warn('CLS monitoring not supported:', error);
    }
  }

  /**
   * Set up custom performance metrics monitoring
   */
  private setupCustomMetricsMonitoring(): void {
    // Page Load Time monitoring
    const monitorPageLoad = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const pageLoadTime = navigation.loadEventEnd - navigation.navigationStart;

      if (pageLoadTime > 0) {
        this.recordMetric({
          name: 'Page Load Time',
          value: pageLoadTime,
          threshold: PERFORMANCE_THRESHOLDS.pageLoadTime,
          category: 'custom'
        });
      }
    };

    // Monitor on page load and route changes
    if (document.readyState === 'complete') {
      monitorPageLoad();
    } else {
      window.addEventListener('load', monitorPageLoad);
    }

    // Bundle size monitoring (approximation based on resource loading)
    const monitorBundleSize = () => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const jsResources = resources.filter(resource =>
        resource.name.includes('.js') && !resource.name.includes('node_modules')
      );

      const totalSize = jsResources.reduce((total, resource) => {
        return total + (resource.transferSize || 0);
      }, 0);

      this.recordMetric({
        name: 'Bundle Size',
        value: totalSize,
        threshold: PERFORMANCE_THRESHOLDS.bundleSize,
        category: 'custom'
      });
    };

    setTimeout(monitorBundleSize, 2000); // Check after initial load

    // DOM complexity monitoring
    const monitorDomComplexity = () => {
      const nodeCount = document.querySelectorAll('*').length;
      const eventListenerCount = this.estimateEventListeners();

      this.recordMetric({
        name: 'DOM Nodes',
        value: nodeCount,
        threshold: PERFORMANCE_THRESHOLDS.domNodes,
        category: 'custom'
      });

      this.recordMetric({
        name: 'Event Listeners',
        value: eventListenerCount,
        threshold: PERFORMANCE_THRESHOLDS.eventListeners,
        category: 'custom'
      });
    };

    const domMonitoringInterval = setInterval(monitorDomComplexity, 10000); // Every 10 seconds
    this.intervalIds.push(domMonitoringInterval);
  }

  /**
   * Set up animation performance monitoring
   */
  private setupAnimationMonitoring(): void {
    let frames = 0;
    let lastTime = performance.now();
    let animationId: number;

    const measureFPS = () => {
      frames++;
      const currentTime = performance.now();

      if (currentTime >= lastTime + 1000) { // Every second
        const fps = Math.round(frames * 1000 / (currentTime - lastTime));

        this.recordMetric({
          name: 'Animation Frame Rate',
          value: fps,
          threshold: PERFORMANCE_THRESHOLDS.animationFrameRate,
          category: 'animation'
        });

        frames = 0;
        lastTime = currentTime;
      }

      if (this.isMonitoring) {
        animationId = requestAnimationFrame(measureFPS);
      }
    };

    animationId = requestAnimationFrame(measureFPS);

    // Clean up animation frame when monitoring stops
    this.intervalIds.push(animationId);
  }

  /**
   * Set up API performance monitoring
   */
  private setupApiMonitoring(): void {
    const monitorApiPerformance = () => {
      const metrics = api.getMetrics();

      this.recordMetric({
        name: 'API Response Time',
        value: metrics.averageResponseTime,
        threshold: PERFORMANCE_THRESHOLDS.apiResponseTime,
        category: 'api'
      });

      this.recordMetric({
        name: 'Cache Hit Ratio',
        value: metrics.cacheHitRatio,
        threshold: PERFORMANCE_THRESHOLDS.cacheHitRatio,
        category: 'api'
      });

      // Check for API errors
      if (metrics.errorCount > 5) {
        this.createAlert({
          metric: 'API Error Count',
          message: `High number of API errors detected: ${metrics.errorCount}`,
          severity: 'warning',
          recommendations: [
            'Check API server status',
            'Verify network connectivity',
            'Review error logs for patterns'
          ]
        });
      }
    };

    const apiMonitoringInterval = setInterval(monitorApiPerformance, 5000); // Every 5 seconds
    this.intervalIds.push(apiMonitoringInterval);
  }

  /**
   * Set up memory usage monitoring
   */
  private setupMemoryMonitoring(): void {
    if (!('memory' in performance)) {
      console.warn('Memory monitoring not supported');
      return;
    }

    const monitorMemory = () => {
      const memInfo = (performance as any).memory;
      const memoryUsage = memInfo.usedJSHeapSize;

      this.recordMetric({
        name: 'Memory Usage',
        value: memoryUsage,
        threshold: PERFORMANCE_THRESHOLDS.memoryUsage,
        category: 'custom'
      });
    };

    const memoryMonitoringInterval = setInterval(monitorMemory, 30000); // Every 30 seconds
    this.intervalIds.push(memoryMonitoringInterval);
  }

  /**
   * Record a performance metric and check for threshold violations
   */
  private recordMetric(metric: Omit<PerformanceMetric, 'timestamp' | 'severity'>): void {
    const severity = this.calculateSeverity(metric.value, metric.threshold, metric.category);

    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now(),
      severity
    };

    this.metrics.push(fullMetric);

    // Keep only last 100 metrics to prevent memory bloat
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Create alert if threshold is exceeded
    if (severity === 'warning' || severity === 'error') {
      this.createAlert({
        metric: metric.name,
        message: this.generateAlertMessage(metric.name, metric.value, metric.threshold),
        severity,
        recommendations: this.getRecommendations(metric.name, metric.value)
      });
    }

    // Log performance issues in development
    if (process.env.NODE_ENV === 'development' && severity !== 'info') {
      console.warn(`⚠️ Performance issue: ${metric.name} = ${metric.value} (threshold: ${metric.threshold})`);
    }
  }

  /**
   * Calculate severity based on how much the value exceeds the threshold
   */
  private calculateSeverity(value: number, threshold: number, category: string): 'info' | 'warning' | 'error' {
    // Special handling for metrics where lower is better
    const lowerIsBetter = [
      'Page Load Time', 'API Response Time', 'First Input Delay',
      'Largest Contentful Paint', 'Cumulative Layout Shift'
    ];

    // Special handling for metrics where higher is better
    const higherIsBetter = [
      'Animation Frame Rate', 'Cache Hit Ratio'
    ];

    let exceedsThreshold = false;
    let severityMultiplier = 1;

    if (lowerIsBetter.some(metric => metric === name)) {
      exceedsThreshold = value > threshold;
      severityMultiplier = value / threshold;
    } else if (higherIsBetter.some(metric => metric === name)) {
      exceedsThreshold = value < threshold;
      severityMultiplier = threshold / value;
    } else {
      exceedsThreshold = value > threshold;
      severityMultiplier = value / threshold;
    }

    if (!exceedsThreshold) return 'info';
    if (severityMultiplier > 2) return 'error';
    if (severityMultiplier > 1.2) return 'warning';

    return 'info';
  }

  /**
   * Create a performance alert
   */
  private createAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp' | 'resolved'>): void {
    // Check if similar alert already exists and is unresolved
    const existingAlert = this.alerts.find(alert =>
      !alert.resolved &&
      alert.metric === alertData.metric &&
      alert.severity === alertData.severity
    );

    if (existingAlert) return; // Don't create duplicate alerts

    const alert: PerformanceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      resolved: false,
      ...alertData
    };

    this.alerts.push(alert);

    // Trigger alert handlers
    this.triggerAlert(alert);
  }

  /**
   * Generate alert message based on metric and values
   */
  private generateAlertMessage(metricName: string, value: number, threshold: number): string {
    const formatValue = (val: number, metric: string) => {
      if (metric.includes('Time') || metric.includes('Delay')) {
        return `${val.toFixed(1)}ms`;
      }
      if (metric.includes('Size')) {
        return `${(val / 1024).toFixed(1)}KB`;
      }
      if (metric.includes('Ratio')) {
        return `${(val * 100).toFixed(1)}%`;
      }
      return val.toFixed(2);
    };

    return `${metricName} is ${formatValue(value, metricName)} (threshold: ${formatValue(threshold, metricName)})`;
  }

  /**
   * Get performance recommendations based on metric
   */
  private getRecommendations(metricName: string, value: number): string[] {
    const recommendations: Record<string, string[]> = {
      'Page Load Time': [
        'Enable code splitting and lazy loading',
        'Optimize images and assets',
        'Use CDN for static resources',
        'Minimize main thread work'
      ],
      'API Response Time': [
        'Implement request caching',
        'Optimize database queries',
        'Use request deduplication',
        'Add response compression'
      ],
      'Animation Frame Rate': [
        'Use GPU-accelerated animations',
        'Avoid animating layout properties',
        'Implement will-change CSS property',
        'Reduce animation complexity'
      ],
      'Bundle Size': [
        'Implement code splitting',
        'Remove unused dependencies',
        'Use tree shaking',
        'Compress assets'
      ],
      'Memory Usage': [
        'Fix memory leaks',
        'Optimize component re-renders',
        'Clear unused event listeners',
        'Optimize data structures'
      ],
      'Cumulative Layout Shift': [
        'Set dimensions for images and videos',
        'Reserve space for dynamic content',
        'Avoid inserting content above existing content',
        'Use CSS contain property'
      ]
    };

    return recommendations[metricName] || ['Review performance optimization guidelines'];
  }

  /**
   * Trigger alert handlers (console, analytics, etc.)
   */
  private triggerAlert(alert: PerformanceAlert): void {
    // Console logging
    const emoji = alert.severity === 'error' ? '🚨' : '⚠️';
    console.warn(`${emoji} Performance Alert: ${alert.message}`);

    // Could integrate with external monitoring services here
    // e.g., Sentry, LogRocket, DataDog, etc.

    // Store in localStorage for development debugging
    if (process.env.NODE_ENV === 'development') {
      const alerts = JSON.parse(localStorage.getItem('performance_alerts') || '[]');
      alerts.push(alert);
      localStorage.setItem('performance_alerts', JSON.stringify(alerts.slice(-50))); // Keep last 50
    }
  }

  /**
   * Estimate number of event listeners (approximation)
   */
  private estimateEventListeners(): number {
    // This is an approximation - actual count would require walking the DOM
    const interactiveElements = document.querySelectorAll(
      'button, input, select, textarea, a, [onclick], [onmouseover], [onfocus]'
    );
    return interactiveElements.length * 2; // Rough estimate
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
    }
  }

  /**
   * Clear all resolved alerts
   */
  clearResolvedAlerts(): void {
    this.alerts = this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    overall: 'good' | 'needs-improvement' | 'poor';
    metrics: Record<string, { value: number; status: string }>;
    activeAlerts: number;
    recommendations: string[];
  } {
    const recentMetrics = this.metrics.filter(m => Date.now() - m.timestamp < 60000); // Last minute
    const activeAlerts = this.getActiveAlerts();

    // Calculate overall performance score
    const criticalIssues = activeAlerts.filter(a => a.severity === 'error').length;
    const warnings = activeAlerts.filter(a => a.severity === 'warning').length;

    let overall: 'good' | 'needs-improvement' | 'poor';
    if (criticalIssues > 0) {
      overall = 'poor';
    } else if (warnings > 2) {
      overall = 'needs-improvement';
    } else {
      overall = 'good';
    }

    // Get latest value for each metric
    const metricSummary: Record<string, { value: number; status: string }> = {};
    const latestMetrics = new Map<string, PerformanceMetric>();

    recentMetrics.forEach(metric => {
      if (!latestMetrics.has(metric.name) || metric.timestamp > latestMetrics.get(metric.name)!.timestamp) {
        latestMetrics.set(metric.name, metric);
      }
    });

    latestMetrics.forEach((metric, name) => {
      metricSummary[name] = {
        value: metric.value,
        status: metric.severity === 'info' ? 'good' : metric.severity
      };
    });

    // Get top recommendations
    const allRecommendations = activeAlerts.flatMap(alert => alert.recommendations);
    const uniqueRecommendations = [...new Set(allRecommendations)].slice(0, 5);

    return {
      overall,
      metrics: metricSummary,
      activeAlerts: activeAlerts.length,
      recommendations: uniqueRecommendations
    };
  }
}

// Create singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Auto-start monitoring in development and production
if (typeof window !== 'undefined') {
  performanceMonitor.startMonitoring();
}

// React hook for performance monitoring
export const usePerformanceMonitoring = () => {
  const [metrics, setMetrics] = React.useState(performanceMonitor.getMetrics());
  const [alerts, setAlerts] = React.useState(performanceMonitor.getActiveAlerts());
  const [summary, setSummary] = React.useState(performanceMonitor.getPerformanceSummary());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(performanceMonitor.getMetrics());
      setAlerts(performanceMonitor.getActiveAlerts());
      setSummary(performanceMonitor.getPerformanceSummary());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return {
    metrics,
    alerts,
    summary,
    resolveAlert: performanceMonitor.resolveAlert.bind(performanceMonitor),
    clearResolvedAlerts: performanceMonitor.clearResolvedAlerts.bind(performanceMonitor)
  };
};

export default performanceMonitor;