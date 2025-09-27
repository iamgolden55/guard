// Performance-optimized Vite configuration for Security Firm Onboarding System
// Targeting < 200KB gzipped bundle size for optimal performance

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import type { ManualChunksOption } from 'rollup';

export default defineConfig({
  plugins: [
    react(),
    splitVendorChunkPlugin(),
    // Bundle analyzer - run with ANALYZE=true to generate report
    process.env.ANALYZE && visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true
    })
  ].filter(Boolean),

  // Performance-optimized build configuration
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: process.env.NODE_ENV !== 'production',

    // Chunk size optimization
    chunkSizeWarningLimit: 1000, // 1MB warning limit

    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },

      output: {
        // Optimize chunk naming for better caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop()?.replace('.tsx', '').replace('.ts', '')
            : 'chunk';
          return `assets/${facadeModuleId}-[hash].js`;
        },
        assetFileNames: 'assets/[name]-[hash].[ext]',
        entryFileNames: 'assets/[name]-[hash].js',

        // Advanced code splitting configuration
        manualChunks: (id) => {
          // Vendor libraries
          if (id.includes('node_modules')) {
            // Separate large UI libraries
            if (id.includes('@fluentui/react-components') || id.includes('@fluentui/react-icons')) {
              return 'fluentui';
            }

            // Chart.js and related libraries
            if (id.includes('chart.js') || id.includes('react-chartjs-2') || id.includes('chartjs-adapter-date-fns')) {
              return 'charts';
            }

            // React Query and related
            if (id.includes('@tanstack/react-query') || id.includes('@tanstack/react-query-devtools')) {
              return 'react-query';
            }

            // Date handling libraries
            if (id.includes('date-fns') || id.includes('dayjs') || id.includes('moment')) {
              return 'date-utils';
            }

            // Core React ecosystem
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-core';
            }

            // Other vendor libraries
            return 'vendor';
          }

          // Application code splitting by feature

          // Compliance system - separate chunk for compliance components
          if (id.includes('/components/compliance/') || id.includes('/hooks/useCompliance')) {
            return 'compliance-system';
          }

          // Staff management features
          if (id.includes('/components/staff/') || id.includes('/pages/staff/')) {
            return 'staff-management';
          }

          // Venue management features
          if (id.includes('/components/venues/') || id.includes('/pages/venues/')) {
            return 'venue-management';
          }

          // Reports and analytics
          if (id.includes('/components/reports/') || id.includes('/pages/reports/') || id.includes('/components/analytics/')) {
            return 'reports-analytics';
          }

          // Shift management
          if (id.includes('/components/shifts/') || id.includes('/pages/shifts/')) {
            return 'shift-management';
          }

          // Leave management
          if (id.includes('/components/leave/') || id.includes('/pages/leave/')) {
            return 'leave-management';
          }

          // Common shared components stay in main bundle
          if (id.includes('/components/shared/') || id.includes('/components/common/')) {
            return 'shared';
          }

          // Services and utilities
          if (id.includes('/services/') || id.includes('/utils/') || id.includes('/types/')) {
            return 'core-utils';
          }
        }
      }
    },

    // Minification and optimization
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
        pure_funcs: process.env.NODE_ENV === 'production' ? ['console.log', 'console.debug'] : []
      },
      format: {
        comments: false
      }
    },

    // CSS optimization
    cssCodeSplit: true,
    cssMinify: true,

    // Asset optimization
    assetsInlineLimit: 4096, // 4KB inline limit
  },

  // Development server optimization
  server: {
    port: 3000,
    open: false,
    cors: true,
    hmr: {
      overlay: true
    }
  },

  // Dependency optimization for faster dev builds
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@fluentui/react-components',
      '@fluentui/react-icons',
      '@tanstack/react-query',
      'chart.js',
      'react-chartjs-2'
    ],
    exclude: [
      // Exclude large dependencies that should be loaded on demand
    ]
  },

  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@pages': resolve(__dirname, './src/pages'),
      '@services': resolve(__dirname, './src/services'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@types': resolve(__dirname, './src/types'),
      '@utils': resolve(__dirname, './src/utils'),
      '@styles': resolve(__dirname, './src/styles'),
    }
  },

  // Environment variables for build optimization
  define: {
    __DEV__: process.env.NODE_ENV !== 'production',
    __PROD__: process.env.NODE_ENV === 'production',
    'process.env.REACT_APP_BUILD_TIME': JSON.stringify(new Date().toISOString()),
  },

  // CSS processing optimization
  css: {
    modules: {
      localsConvention: 'camelCaseOnly'
    },
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`
      }
    }
  },

  // Asset processing
  assetsInclude: ['**/*.woff2', '**/*.woff', '**/*.ttf'],

  // Worker configuration for background processing
  worker: {
    format: 'es'
  }
});

// Performance monitoring configuration
export const performanceConfig = {
  // Bundle size targets
  bundleSizeTargets: {
    maxMainBundle: 1200000, // 1.2MB
    maxVendorBundle: 800000, // 800KB
    maxFeatureChunk: 200000, // 200KB
  },

  // Loading performance targets
  loadingTargets: {
    firstContentfulPaint: 1500, // 1.5s
    timeToInteractive: 3000, // 3s
    largestContentfulPaint: 2500, // 2.5s
  },

  // Code splitting configuration
  codeSplitting: {
    enableRouteBasedSplitting: true,
    enableComponentBasedSplitting: true,
    lazyLoadThreshold: 100000, // 100KB - components above this size should be lazy loaded
  },

  // Caching configuration
  caching: {
    staticAssetsCacheDuration: 31536000, // 1 year
    dynamicContentCacheDuration: 300, // 5 minutes
    apiResponseCacheDuration: 60, // 1 minute
  }
};

// Bundle analysis utilities
export const analyzeBundleSize = () => {
  console.log('Bundle Analysis Configuration:');
  console.log('- Run "npm run build:analyze" to generate bundle report');
  console.log('- Check dist/stats.html for detailed bundle analysis');
  console.log('- Monitor chunk sizes in build output');
  console.log('- Target: Main bundle < 1.2MB, Vendor < 800KB');
};