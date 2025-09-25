import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // ESM configuration
  esbuild: {
    target: "es2022",
  },

  // Module resolution for tests
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@fixtures": resolve(__dirname, "./src/__tests__/fixtures"),
      "@mocks": resolve(__dirname, "./src/__tests__/setup"),
      "@tests": resolve(__dirname, "./src/__tests__"),
    },
  },

  test: {
    // Test environment configuration
    maxConcurrency: 1, // Further reduce concurrency for event listener stability

    // Coverage configuration
    // Strategy: Focus on business logic layers that survive backend infrastructure changes
    // Exclude: GraphQL/BigQuery client code (temporary infrastructure, changing to different backend)
    // Include: MCP tools (core business logic), utils (reusable logic), server orchestration, caching system
    coverage: {
      exclude: [
        "src/**/*.{test,spec}.ts",
        "src/__tests__/**",
        "src/**/*.d.ts",
        "node_modules/**",
        "dist/**",
        "**/*.config.ts",
        // Exclude infrastructure layers that will change with backend migration
        "src/client/**",
        "src/services/bigquery-*.ts",
        "src/services/*-bigquery-*.ts",
        "src/services/auth-service.ts",
        "src/types/**",
        // Exclude test doubles and contracts from coverage (they are test infrastructure)
        "src/test-doubles/**",
        "src/contracts/**",
      ],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "html", "json"],
      thresholds: {
        // Focus coverage on business logic layers that survive backend changes
        global: {
          branches: 25,
          functions: 25,
          lines: 25,
          statements: 25,
        },
        // Higher thresholds only for tested tools to prevent regression
        "src/tools/signals/get-partner-seats.ts": {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        "src/tools/signals/list.ts": {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        // Moderate thresholds for reusable utilities
        "src/utils/error-handling.ts": {
          branches: 50,
          functions: 50,
          lines: 65,
          statements: 65,
        },
        // High thresholds for caching system (critical for performance)
        "src/services/cache/cached-bigquery.ts": {
          branches: 85,
          functions: 90,
          lines: 85,
          statements: 85,
        },
        "src/services/cache/preload-service.ts": {
          branches: 80,
          functions: 85,
          lines: 80,
          statements: 80,
        },
      },
    },
    // Environment variables for tests
    env: {
      BIGQUERY_DATASET_ID: "test-dataset",
      BIGQUERY_PROJECT_ID: "test-project",
      NODE_ENV: "test",
      // Increase process max listeners for test environment
      UV_THREADPOOL_SIZE: "128",
      // Disable actual process event listeners in tests
      VITEST_DISABLE_PROCESS_LISTENERS: "true",
    },

    environment: "node",
    exclude: ["node_modules/**", "dist/**", "**/*.d.ts"],

    // Global test configuration
    globals: true,

    hookTimeout: 5000, // 5 seconds for setup/teardown
    // Test file patterns
    include: ["src/**/*.{test,spec}.ts", "src/__tests__/**/*.test.ts"],
    // Test isolation
    isolate: true,

    outputFile: {
      json: "./test-results.json",
    },

    // Concurrent test execution - use forks for better isolation
    pool: "forks",
    poolOptions: {
      forks: {
        maxForks: 2,
        minForks: 1,
        singleFork: false,
      },
    },

    // Reporter configuration
    reporter: ["verbose", "json"],

    // Retry configuration for flaky tests
    retry: 1,
    // Setup files
    setupFiles: ["./src/__tests__/setup/test-setup.ts"],

    // Test timeout configuration
    testTimeout: 15000, // 15 seconds for integration tests with caching delays

    // Test environment stability
    sequence: {
      concurrent: false, // Run tests sequentially to avoid resource conflicts
    },

    // Better cleanup and isolation
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
});
