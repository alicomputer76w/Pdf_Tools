/**
 * Performance Optimization Module for PDF Tools Suite
 * Handles lazy loading, caching, memory management, and performance monitoring
 */

class PerformanceManager {
    constructor() {
        this.cache = new Map();
        this.observers = new Map();
        this.performanceMetrics = {
            loadTimes: [],
            memoryUsage: [],
            toolUsage: new Map(),
            errors: []
        };
        
        this.config = {
            maxCacheSize: 50 * 1024 * 1024, // 50MB
            maxCacheItems: 100,
            lazyLoadThreshold: 0.1,
            performanceReportInterval: 30000, // 30 seconds
            memoryCheckInterval: 10000 // 10 seconds
        };
        
        this.init();
    }

    init() {
        this.setupLazyLoading();
        this.setupCaching();
        this.setupMemoryManagement();
        this.setupPerformanceMonitoring();
        this.setupResourceOptimization();
    }

    setupLazyLoading() {
        // Intersection Observer for lazy loading
        this.lazyLoadObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadLazyContent(entry.target);
                        this.lazyLoadObserver.unobserve(entry.target);
                    }
                });
            },
            {
                rootMargin: '50px',
                threshold: this.config.lazyLoadThreshold
            }
        );

        // Observe lazy-loadable elements
        this.observeLazyElements();
        
        // Set up mutation observer for dynamically added elements
        this.setupLazyMutationObserver();
    }

    observeLazyElements() {
        const lazyElements = document.querySelectorAll('[data-lazy]');
        lazyElements.forEach(element => {
            this.lazyLoadObserver.observe(element);
        });
    }

    setupLazyMutationObserver() {
        const mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const lazyElements = node.querySelectorAll ? 
                            node.querySelectorAll('[data-lazy]') : [];
                        lazyElements.forEach(element => {
                            this.lazyLoadObserver.observe(element);
                        });
                        
                        if (node.hasAttribute && node.hasAttribute('data-lazy')) {
                            this.lazyLoadObserver.observe(node);
                        }
                    }
                });
            });
        });

        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    loadLazyContent(element) {
        const lazyType = element.dataset.lazy;
        const startTime = performance.now();

        switch (lazyType) {
            case 'image':
                this.loadLazyImage(element);
                break;
            case 'component':
                this.loadLazyComponent(element);
                break;
            case 'script':
                this.loadLazyScript(element);
                break;
            case 'style':
                this.loadLazyStyle(element);
                break;
        }

        const loadTime = performance.now() - startTime;
        this.recordMetric('lazyLoad', { type: lazyType, time: loadTime });
    }

    loadLazyImage(element) {
        const src = element.dataset.src;
        if (src) {
            const img = new Image();
            img.onload = () => {
                element.src = src;
                element.classList.add('loaded');
            };
            img.onerror = () => {
                element.classList.add('error');
            };
            img.src = src;
        }
    }

    loadLazyComponent(element) {
        const componentName = element.dataset.component;
        if (componentName && window[componentName]) {
            try {
                new window[componentName](element);
                element.classList.add('loaded');
            } catch (error) {
                console.error(`Failed to load component ${componentName}:`, error);
                element.classList.add('error');
            }
        }
    }

    loadLazyScript(element) {
        const src = element.dataset.src;
        if (src) {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => element.classList.add('loaded');
            script.onerror = () => element.classList.add('error');
            document.head.appendChild(script);
        }
    }

    loadLazyStyle(element) {
        const href = element.dataset.href;
        if (href) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = () => element.classList.add('loaded');
            link.onerror = () => element.classList.add('error');
            document.head.appendChild(link);
        }
    }

    setupCaching() {
        // Cache management
        this.cacheStats = {
            hits: 0,
            misses: 0,
            size: 0,
            items: 0
        };

        // Periodic cache cleanup
        setInterval(() => {
            this.cleanupCache();
        }, 60000); // Every minute
    }

    cache(key, data, options = {}) {
        const cacheItem = {
            data,
            timestamp: Date.now(),
            size: this.calculateSize(data),
            ttl: options.ttl || 3600000, // 1 hour default
            priority: options.priority || 1
        };

        // Check cache limits
        if (this.cacheStats.size + cacheItem.size > this.config.maxCacheSize ||
            this.cacheStats.items >= this.config.maxCacheItems) {
            this.evictCache();
        }

        this.cache.set(key, cacheItem);
        this.cacheStats.size += cacheItem.size;
        this.cacheStats.items++;
    }

    getFromCache(key) {
        const item = this.cache.get(key);
        
        if (!item) {
            this.cacheStats.misses++;
            return null;
        }

        // Check TTL
        if (Date.now() - item.timestamp > item.ttl) {
            this.cache.delete(key);
            this.cacheStats.size -= item.size;
            this.cacheStats.items--;
            this.cacheStats.misses++;
            return null;
        }

        this.cacheStats.hits++;
        return item.data;
    }

    evictCache() {
        // LRU eviction with priority consideration
        const items = Array.from(this.cache.entries())
            .map(([key, item]) => ({
                key,
                ...item,
                score: (Date.now() - item.timestamp) / item.priority
            }))
            .sort((a, b) => b.score - a.score);

        // Remove oldest/lowest priority items
        const toRemove = Math.ceil(items.length * 0.2); // Remove 20%
        for (let i = 0; i < toRemove && items[i]; i++) {
            const item = items[i];
            this.cache.delete(item.key);
            this.cacheStats.size -= item.size;
            this.cacheStats.items--;
        }
    }

    cleanupCache() {
        const now = Date.now();
        const expired = [];

        this.cache.forEach((item, key) => {
            if (now - item.timestamp > item.ttl) {
                expired.push(key);
            }
        });

        expired.forEach(key => {
            const item = this.cache.get(key);
            this.cache.delete(key);
            this.cacheStats.size -= item.size;
            this.cacheStats.items--;
        });
    }

    calculateSize(data) {
        if (typeof data === 'string') {
            return data.length * 2; // UTF-16
        }
        if (data instanceof ArrayBuffer) {
            return data.byteLength;
        }
        if (data instanceof Blob) {
            return data.size;
        }
        // Rough estimate for objects
        return JSON.stringify(data).length * 2;
    }

    setupMemoryManagement() {
        // Monitor memory usage
        if ('memory' in performance) {
            setInterval(() => {
                this.checkMemoryUsage();
            }, this.config.memoryCheckInterval);
        }

        // Cleanup on page visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.performMemoryCleanup();
            }
        });

        // Cleanup on low memory (if supported)
        if ('deviceMemory' in navigator && navigator.deviceMemory < 4) {
            this.enableLowMemoryMode();
        }
    }

    checkMemoryUsage() {
        if ('memory' in performance) {
            const memory = performance.memory;
            const usage = {
                used: memory.usedJSHeapSize,
                total: memory.totalJSHeapSize,
                limit: memory.jsHeapSizeLimit,
                timestamp: Date.now()
            };

            this.performanceMetrics.memoryUsage.push(usage);

            // Keep only last 100 measurements
            if (this.performanceMetrics.memoryUsage.length > 100) {
                this.performanceMetrics.memoryUsage.shift();
            }

            // Trigger cleanup if memory usage is high
            const usagePercent = usage.used / usage.limit;
            if (usagePercent > 0.8) {
                this.performMemoryCleanup();
            }
        }
    }

    performMemoryCleanup() {
        // Clear caches
        this.cache.clear();
        this.cacheStats = { hits: 0, misses: 0, size: 0, items: 0 };

        // Clear old performance metrics
        this.performanceMetrics.loadTimes = this.performanceMetrics.loadTimes.slice(-50);
        this.performanceMetrics.memoryUsage = this.performanceMetrics.memoryUsage.slice(-50);

        // Trigger garbage collection if available
        if (window.gc) {
            window.gc();
        }

        // Notify other components
        document.dispatchEvent(new CustomEvent('memory-cleanup'));
    }

    enableLowMemoryMode() {
        // Reduce cache sizes
        this.config.maxCacheSize = 10 * 1024 * 1024; // 10MB
        this.config.maxCacheItems = 20;

        // More aggressive cleanup
        this.config.memoryCheckInterval = 5000; // 5 seconds

        document.body.classList.add('low-memory-mode');
    }

    setupPerformanceMonitoring() {
        // Monitor page load performance
        window.addEventListener('load', () => {
            this.recordPageLoadMetrics();
        });

        // Monitor navigation timing
        this.setupNavigationObserver();

        // Monitor resource loading
        this.setupResourceObserver();

        // Periodic performance reports
        setInterval(() => {
            this.generatePerformanceReport();
        }, this.config.performanceReportInterval);
    }

    recordPageLoadMetrics() {
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation) {
            const metrics = {
                domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
                domInteractive: navigation.domInteractive - navigation.navigationStart,
                firstPaint: this.getFirstPaint(),
                firstContentfulPaint: this.getFirstContentfulPaint()
            };

            this.performanceMetrics.loadTimes.push({
                ...metrics,
                timestamp: Date.now()
            });
        }
    }

    getFirstPaint() {
        const paintEntries = performance.getEntriesByType('paint');
        const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
        return firstPaint ? firstPaint.startTime : null;
    }

    getFirstContentfulPaint() {
        const paintEntries = performance.getEntriesByType('paint');
        const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        return fcp ? fcp.startTime : null;
    }

    setupNavigationObserver() {
        // Monitor SPA navigation performance
        let navigationStart = performance.now();

        document.addEventListener('click', (e) => {
            const link = e.target.closest('a, button');
            if (link) {
                navigationStart = performance.now();
            }
        });

        // Monitor DOM changes that might indicate navigation completion
        const observer = new MutationObserver(() => {
            const navigationEnd = performance.now();
            const duration = navigationEnd - navigationStart;
            
            if (duration > 100 && duration < 10000) { // Reasonable navigation time
                this.recordMetric('navigation', { duration });
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }

    setupResourceObserver() {
        // Monitor resource loading performance
        const observer = new PerformanceObserver((list) => {
            list.getEntries().forEach(entry => {
                if (entry.entryType === 'resource') {
                    this.recordResourceMetric(entry);
                }
            });
        });

        observer.observe({ entryTypes: ['resource'] });
    }

    recordResourceMetric(entry) {
        const metric = {
            name: entry.name,
            type: this.getResourceType(entry.name),
            duration: entry.duration,
            size: entry.transferSize || entry.encodedBodySize,
            cached: entry.transferSize === 0 && entry.encodedBodySize > 0,
            timestamp: Date.now()
        };

        this.recordMetric('resource', metric);
    }

    getResourceType(url) {
        if (url.includes('.js')) return 'script';
        if (url.includes('.css')) return 'style';
        if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return 'image';
        if (url.includes('.pdf')) return 'pdf';
        return 'other';
    }

    setupResourceOptimization() {
        // Preload critical resources
        this.preloadCriticalResources();

        // Prefetch likely-to-be-used resources
        this.setupPrefetching();

        // Optimize images
        this.optimizeImages();
    }

    preloadCriticalResources() {
        const criticalResources = [
            { href: 'css/styles.css', as: 'style' },
            { href: 'css/components.css', as: 'style' },
            { href: 'js/utils.js', as: 'script' },
            { href: 'js/components.js', as: 'script' }
        ];

        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource.href;
            link.as = resource.as;
            document.head.appendChild(link);
        });
    }

    setupPrefetching() {
        // Prefetch resources when user hovers over tool cards
        document.addEventListener('mouseenter', (e) => {
            if (!e.target || typeof e.target.closest !== 'function') return;
            
            const toolCard = e.target.closest('.tool-card');
            if (toolCard) {
                const toolId = toolCard.dataset.tool;
                this.prefetchToolResources(toolId);
            }
        }, true);
    }

    prefetchToolResources(toolId) {
        // Prefetch tool-specific resources
        const resources = this.getToolResources(toolId);
        resources.forEach(resource => {
            if (!this.getFromCache(`prefetch-${resource}`)) {
                this.prefetchResource(resource);
                // Use cache() API; provide setCache alias for compatibility
                this.setCache(`prefetch-${resource}`, true, { ttl: 300000 }); // 5 minutes
            }
        });
    }

    getToolResources(toolId) {
        // Define tool-specific resources that might be needed
        const toolResources = {
            'merger': ['icons/merge.svg'],
            'splitter': ['icons/split.svg'],
            'pdf-to-image': ['icons/image.svg'],
            'image-to-pdf': ['icons/pdf.svg'],
            'compressor': ['icons/pdf.svg'],
            'optimizer': ['icons/pdf.svg'],
            'resizer': ['icons/pdf.svg'],
            'color-converter': ['icons/pdf.svg'],
            'rotator': ['icons/pdf.svg'],
            'watermark': ['icons/pdf.svg']
        };

        return toolResources[toolId] || [];
    }

    prefetchResource(url) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        document.head.appendChild(link);
    }

    optimizeImages() {
        // Use Intersection Observer to load images only when needed
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        imageObserver.unobserve(img);
                    }
                }
            });
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }

    recordMetric(type, data) {
        const metric = {
            type,
            data,
            timestamp: Date.now()
        };

        if (!this.performanceMetrics[type]) {
            this.performanceMetrics[type] = [];
        }

        this.performanceMetrics[type].push(metric);

        // Limit metric history
        if (this.performanceMetrics[type].length > 1000) {
            this.performanceMetrics[type] = this.performanceMetrics[type].slice(-500);
        }
    }

    generatePerformanceReport() {
        const report = {
            timestamp: Date.now(),
            cache: {
                hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0,
                size: this.cacheStats.size,
                items: this.cacheStats.items
            },
            memory: this.getMemoryStats(),
            performance: this.getPerformanceStats(),
            tools: this.getToolUsageStats()
        };

        // Send to analytics if enabled
        if (window.app && window.app.settings.analytics) {
            this.sendAnalytics('performance-report', report);
        }

        return report;
    }

    getMemoryStats() {
        if (this.performanceMetrics.memoryUsage.length === 0) return null;

        const recent = this.performanceMetrics.memoryUsage.slice(-10);
        const avg = recent.reduce((sum, m) => sum + m.used, 0) / recent.length;
        const max = Math.max(...recent.map(m => m.used));

        return { average: avg, maximum: max, samples: recent.length };
    }

    getPerformanceStats() {
        const stats = {};

        Object.keys(this.performanceMetrics).forEach(key => {
            if (Array.isArray(this.performanceMetrics[key])) {
                const metrics = this.performanceMetrics[key];
                if (metrics.length > 0) {
                    const values = metrics.map(m => m.data?.duration || m.duration || 0);
                    stats[key] = {
                        count: metrics.length,
                        average: values.reduce((a, b) => a + b, 0) / values.length,
                        min: Math.min(...values),
                        max: Math.max(...values)
                    };
                }
            }
        });

        return stats;
    }

    getToolUsageStats() {
        return Object.fromEntries(this.performanceMetrics.toolUsage);
    }

    sendAnalytics(event, data) {
        // Send performance data to analytics service
        if (window.gtag) {
            gtag('event', event, {
                custom_parameter: JSON.stringify(data)
            });
        }
    }

    // Public API methods
    measureOperation(name, operation) {
        const start = performance.now();
        const result = operation();
        const duration = performance.now() - start;
        
        this.recordMetric('operation', { name, duration });
        
        return result;
    }

    async measureAsyncOperation(name, operation) {
        const start = performance.now();
        const result = await operation();
        const duration = performance.now() - start;
        
        this.recordMetric('operation', { name, duration });
        
        return result;
    }

    trackToolUsage(toolId) {
        const current = this.performanceMetrics.toolUsage.get(toolId) || 0;
        this.performanceMetrics.toolUsage.set(toolId, current + 1);
    }

    getPerformanceReport() {
        return this.generatePerformanceReport();
    }

    clearCache() {
        this.cache.clear();
        this.cacheStats = { hits: 0, misses: 0, size: 0, items: 0 };
    }

    optimizeForLowEnd() {
        this.enableLowMemoryMode();
        
        // Disable animations
        document.body.classList.add('reduced-motion');
        
        // Reduce update frequencies
        this.config.performanceReportInterval = 60000; // 1 minute
        this.config.memoryCheckInterval = 30000; // 30 seconds
    }
}

// Initialize performance manager
document.addEventListener('DOMContentLoaded', () => {
    window.performanceManager = new PerformanceManager();
});

// Expose class to window for debug checks
if (typeof window !== 'undefined') {
    window.PerformanceManager = PerformanceManager;
}

// Provide alias method expected by some callers
if (typeof PerformanceManager !== 'undefined') {
    PerformanceManager.prototype.setCache = function(key, data, options = {}) {
        // Call the cache method directly on the instance
        if (typeof this.cache === 'function') {
            return this.cache(key, data, options);
        } else {
            console.warn('Cache method not available on this instance');
            return false;
        }
    };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceManager;
}