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
    // Coverage configuration
    coverage: {
      exclude: [
        "src/**/*.{test,spec}.ts",
        "src/__tests__/**",
        "src/**/*.d.ts",
        "node_modules/**",
        "dist/**",
        "**/*.config.ts",
      ],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "html", "json"],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // Higher thresholds for critical components
        "src/client/scope3-client.ts": {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        "src/services/brand-agent-service.ts": {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
    // Environment variables for tests
    env: {
      BIGQUERY_DATASET_ID: "test-dataset",
      BIGQUERY_PROJECT_ID: "test-project",
      NODE_ENV: "test",
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

    // Concurrent test execution
    pool: "threads",
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1,
        singleThread: false,
      },
    },

    // Reporter configuration
    reporter: ["verbose", "json"],

    // Retry configuration for flaky tests
    retry: 1,
    // Setup files
    setupFiles: ["./src/__tests__/setup/test-setup.ts"],

    // Test timeout configuration
    testTimeout: 10000, // 10 seconds for integration tests
  },
});
