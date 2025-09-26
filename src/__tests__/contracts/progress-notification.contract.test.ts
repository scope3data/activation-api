/**
 * Contract tests for MCP progress notifications and phase logging
 * These tests validate the behavior of any MCP context implementation
 */

import type { MCPToolExecuteContext } from "../../types/mcp.js";

/**
 * Interface for testable progress/logging functionality
 * Any MCP context test double should implement this for validation
 */
export interface TestableProgressContext extends MCPToolExecuteContext {
  getLogCalls?: () => Array<{
    level: string;
    message: string;
    timestamp: number;
  }>;
  getLogMessages?: () => string[];
  // Test-specific methods for validation
  getProgressCalls?: () => Array<{
    progress: number;
    timestamp: number;
    total?: number;
  }>;
  getSummary?: () => {
    logCalls: number;
    logLevels: { debug: number; error: number; info: number; warn: number };
    progressCalls: number;
    progressRange: { final: number; max: number; min: number } | null;
  };
  reset?: () => void;
  verifyPhaseMessages?: (phases: string[]) => {
    found: boolean;
    missing: string[];
  };
  verifyProgressSequence?: () => { isValid: boolean; violations: string[] };
}

/**
 * Convenience function for testing specific progress scenarios
 */
export async function simulateProgressScenario(
  context: TestableProgressContext,
  scenario: {
    phases: Array<{ message: string; progress: number; total?: number }>;
  },
) {
  for (const phase of scenario.phases) {
    context.log?.info(phase.message);
    if (context.reportProgress) {
      await context.reportProgress({
        progress: phase.progress,
        total: phase.total,
      });
    }
  }
}

/**
 * Contract test suite for MCP progress notification behavior
 * Run this against any MCP context implementation to validate compliance
 */
export function testProgressNotificationContract(
  contextFactory: () => TestableProgressContext,
  description: string = "Progress Notification Contract",
) {
  describe(description, () => {
    let context: TestableProgressContext;

    beforeEach(() => {
      context = contextFactory();
    });

    describe("Progress Reporting", () => {
      it("should support progress reporting with progress and total", async () => {
        if (!context.reportProgress) {
          console.warn(
            "Context does not support progress reporting - skipping test",
          );
          return;
        }

        await context.reportProgress({ progress: 0, total: 3 });
        await context.reportProgress({ progress: 1, total: 3 });
        await context.reportProgress({ progress: 3, total: 3 });

        if (context.getProgressCalls) {
          const calls = context.getProgressCalls();
          expect(calls).toHaveLength(3);
          expect(calls[0]).toEqual(
            expect.objectContaining({ progress: 0, total: 3 }),
          );
          expect(calls[1]).toEqual(
            expect.objectContaining({ progress: 1, total: 3 }),
          );
          expect(calls[2]).toEqual(
            expect.objectContaining({ progress: 3, total: 3 }),
          );
        }
      });

      it("should support progress reporting without total (indeterminate)", async () => {
        if (!context.reportProgress) {
          console.warn(
            "Context does not support progress reporting - skipping test",
          );
          return;
        }

        await context.reportProgress({ progress: 1 });
        await context.reportProgress({ progress: 2 });

        if (context.getProgressCalls) {
          const calls = context.getProgressCalls();
          expect(calls).toHaveLength(2);
          expect(calls[0]).toEqual(
            expect.objectContaining({ progress: 1, total: undefined }),
          );
          expect(calls[1]).toEqual(
            expect.objectContaining({ progress: 2, total: undefined }),
          );
        }
      });

      it("should validate progress sequence correctness", async () => {
        if (!context.reportProgress || !context.verifyProgressSequence) {
          console.warn(
            "Context does not support progress validation - skipping test",
          );
          return;
        }

        // Valid sequence
        await context.reportProgress({ progress: 0, total: 3 });
        await context.reportProgress({ progress: 1, total: 3 });
        await context.reportProgress({ progress: 3, total: 3 });

        const validation = context.verifyProgressSequence();
        expect(validation.isValid).toBe(true);
        expect(validation.violations).toHaveLength(0);
      });

      it("should detect invalid progress sequences", async () => {
        if (!context.reportProgress || !context.verifyProgressSequence) {
          console.warn(
            "Context does not support progress validation - skipping test",
          );
          return;
        }

        // Invalid sequence (decreasing progress)
        await context.reportProgress({ progress: 2, total: 3 });
        await context.reportProgress({ progress: 1, total: 3 }); // Decreases!

        const validation = context.verifyProgressSequence();
        expect(validation.isValid).toBe(false);
        expect(validation.violations.length).toBeGreaterThan(0);
        expect(validation.violations[0]).toContain("Progress decreased");
      });

      it("should handle progress exceeding total", async () => {
        if (!context.reportProgress || !context.verifyProgressSequence) {
          console.warn(
            "Context does not support progress validation - skipping test",
          );
          return;
        }

        await context.reportProgress({ progress: 5, total: 3 }); // Exceeds total!

        const validation = context.verifyProgressSequence();
        expect(validation.isValid).toBe(false);
        expect(
          validation.violations.some((v) => v.includes("exceeds total")),
        ).toBe(true);
      });
    });

    describe("Phase Logging", () => {
      it("should support info logging", () => {
        if (!context.log?.info) {
          console.warn("Context does not support info logging - skipping test");
          return;
        }

        context.log.info("🔍 Test phase message");
        context.log.info("✅ Another test message");

        if (context.getLogMessages) {
          const messages = context.getLogMessages();
          expect(messages).toContain("🔍 Test phase message");
          expect(messages).toContain("✅ Another test message");
        }
      });

      it("should support warn logging for failures", () => {
        if (!context.log?.warn) {
          console.warn("Context does not support warn logging - skipping test");
          return;
        }

        context.log.warn("⚠️ Agent failed with error");

        if (context.getLogMessages) {
          const messages = context.getLogMessages();
          expect(messages).toContain("⚠️ Agent failed with error");
        }
      });

      it("should support error logging", () => {
        if (!context.log?.error) {
          console.warn(
            "Context does not support error logging - skipping test",
          );
          return;
        }

        context.log.error("❌ Critical failure");

        if (context.getLogMessages) {
          const messages = context.getLogMessages();
          expect(messages).toContain("❌ Critical failure");
        }
      });

      it("should verify expected phase messages", () => {
        if (!context.log?.info || !context.verifyPhaseMessages) {
          console.warn(
            "Context does not support phase message validation - skipping test",
          );
          return;
        }

        context.log.info("🔍 Discovering available sales agents...");
        context.log.info("🚀 Querying sales agents");
        context.log.info("🎉 Product discovery completed!");

        const result = context.verifyPhaseMessages([
          "discovering available sales agents",
          "querying sales agents",
          "product discovery completed",
        ]);

        expect(result.found).toBe(true);
        expect(result.missing).toHaveLength(0);
      });

      it("should detect missing phase messages", () => {
        if (!context.log?.info || !context.verifyPhaseMessages) {
          console.warn(
            "Context does not support phase message validation - skipping test",
          );
          return;
        }

        context.log.info("🔍 Discovering available sales agents...");
        // Missing other phases

        const result = context.verifyPhaseMessages([
          "discovering available sales agents",
          "querying sales agents", // Missing!
          "product discovery completed", // Missing!
        ]);

        expect(result.found).toBe(false);
        expect(result.missing).toHaveLength(2);
        expect(result.missing).toContain("querying sales agents");
        expect(result.missing).toContain("product discovery completed");
      });
    });

    describe("Combined Progress and Logging", () => {
      it("should support simultaneous progress and logging", async () => {
        if (!context.reportProgress || !context.log?.info) {
          console.warn(
            "Context does not support combined progress/logging - skipping test",
          );
          return;
        }

        context.log.info("🔍 Starting discovery process");
        await context.reportProgress({ progress: 0, total: 2 });

        context.log.info("📦 Processing first item");
        await context.reportProgress({ progress: 1, total: 2 });

        context.log.info("🎉 Discovery completed");
        await context.reportProgress({ progress: 2, total: 2 });

        if (context.getProgressCalls && context.getLogMessages) {
          const progressCalls = context.getProgressCalls();
          const logMessages = context.getLogMessages();

          expect(progressCalls).toHaveLength(3);
          expect(logMessages).toHaveLength(3);
          expect(progressCalls[2]).toEqual(
            expect.objectContaining({ progress: 2, total: 2 }),
          );
          expect(logMessages).toContain("🎉 Discovery completed");
        }
      });

      it("should provide meaningful summary statistics", () => {
        if (
          !context.getSummary ||
          !context.reportProgress ||
          !context.log?.info
        ) {
          console.warn(
            "Context does not support summary statistics - skipping test",
          );
          return;
        }

        // Simulate some activity
        context.log.info("Info message");
        context.log.warn("Warning message");
        context.reportProgress({ progress: 1, total: 3 });

        const summary = context.getSummary();
        expect(summary).toEqual(
          expect.objectContaining({
            logCalls: expect.any(Number),
            logLevels: expect.objectContaining({
              debug: expect.any(Number),
              error: expect.any(Number),
              info: expect.any(Number),
              warn: expect.any(Number),
            }),
            progressCalls: expect.any(Number),
          }),
        );
      });
    });

    describe("Edge Cases and Resilience", () => {
      it("should handle empty progress sequences", () => {
        if (!context.verifyProgressSequence) {
          console.warn(
            "Context does not support progress validation - skipping test",
          );
          return;
        }

        // No progress calls made
        const validation = context.verifyProgressSequence();
        expect(validation.isValid).toBe(true);
        expect(validation.violations).toHaveLength(0);
      });

      it("should handle context without progress capability", () => {
        // This test verifies that tools gracefully handle missing capabilities
        const noProgressContext = { ...context };
        delete (noProgressContext as unknown as Record<string, unknown>)
          .reportProgress;

        // Should not throw error when progress capability is missing
        expect(() => {
          (noProgressContext as TestableProgressContext).reportProgress?.({
            progress: 1,
            total: 2,
          });
        }).not.toThrow();
      });

      it("should handle context without logging capability", () => {
        const noLogContext = { ...context };
        delete (noLogContext as unknown as Record<string, unknown>).log;

        // Should not throw error when logging capability is missing
        expect(() => {
          (noLogContext as TestableProgressContext).log?.info?.("Test message");
        }).not.toThrow();
      });
    });
  });
}

/**
 * Predefined test scenarios for common use cases
 */
export const progressScenarios = {
  indeterminateProgress: {
    phases: [
      { message: "🔍 Starting discovery...", progress: 0 },
      { message: "📦 Processing responses...", progress: 1 },
      { message: "🎉 Discovery completed", progress: 2 },
    ],
  },
  multipleAgents: {
    phases: [
      {
        message: "🔍 Discovering available sales agents...",
        progress: 0,
        total: 3,
      },
      { message: "📦 First agent responded", progress: 1, total: 3 },
      { message: "📦 Second agent responded", progress: 2, total: 3 },
      { message: "⚠️ Third agent failed", progress: 3, total: 3 },
    ],
  },
  singleAgent: {
    phases: [
      {
        message: "🔍 Discovering available sales agents...",
        progress: 0,
        total: 1,
      },
      { message: "📦 Agent responded with products", progress: 1, total: 1 },
    ],
  },
};
