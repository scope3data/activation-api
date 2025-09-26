/**
 * Example test demonstrating how to use the progress notification contract
 * This validates that our MCPContextTestDouble correctly implements the contract
 */

import { describe, expect, it } from "vitest";

import { MCPContextTestDouble } from "../../test-doubles/mcp-context-test-double.js";
import {
  progressScenarios,
  simulateProgressScenario,
  testProgressNotificationContract,
} from "../contracts/progress-notification.contract.test.js";

describe("Progress Notification Contract Validation", () => {
  // Test that our test double implements the contract correctly
  testProgressNotificationContract(
    () => new MCPContextTestDouble(),
    "MCPContextTestDouble Contract Compliance",
  );

  // Additional tests specific to our test double implementation
  describe("MCPContextTestDouble Specific Features", () => {
    it("should provide detailed summary statistics", () => {
      const context = new MCPContextTestDouble();

      context.log.info("Test info message");
      context.log.warn("Test warning");
      context.log.error("Test error");
      context.reportProgress({ progress: 1, total: 3 });
      context.reportProgress({ progress: 3, total: 3 });

      const summary = context.getSummary();
      expect(summary).toEqual({
        logCalls: 3,
        logLevels: {
          debug: 0,
          error: 1,
          info: 1,
          warn: 1,
        },
        progressCalls: 2,
        progressRange: {
          final: 3,
          max: 3,
          min: 1,
        },
      });
    });

    it("should support factory methods for different context types", () => {
      // Test full capabilities context
      const fullContext = new MCPContextTestDouble();
      expect(fullContext.reportProgress).toBeDefined();
      expect(fullContext.log).toBeDefined();

      // Test different scenarios using actual context capabilities
      expect(fullContext.session?.scope3ApiKey).toBe("test-api-key");
      expect(fullContext.session?.customerId).toBe(123);
    });

    it("should handle reset functionality", async () => {
      const context = new MCPContextTestDouble();

      // Add some data
      context.log.info("Test message");
      await context.reportProgress({ progress: 1, total: 2 });

      expect(context.getLogCalls()).toHaveLength(1);
      expect(context.getProgressCalls()).toHaveLength(1);

      // Reset and verify clean state
      context.reset();
      expect(context.getLogCalls()).toHaveLength(0);
      expect(context.getProgressCalls()).toHaveLength(0);
    });

    it("should capture timestamp information", async () => {
      const context = new MCPContextTestDouble();
      const startTime = Date.now();

      context.log.info("Test message");
      await context.reportProgress({ progress: 1, total: 2 });

      const logCalls = context.getLogCalls();
      const progressCalls = context.getProgressCalls();

      expect(logCalls[0].timestamp).toBeGreaterThanOrEqual(startTime);
      expect(progressCalls[0].timestamp).toBeGreaterThanOrEqual(startTime);
    });
  });

  describe("Predefined Scenario Testing", () => {
    it("should handle single agent scenario", async () => {
      const context = new MCPContextTestDouble();
      await simulateProgressScenario(context, progressScenarios.singleAgent);

      const progressCalls = context.getProgressCalls();
      const logMessages = context.getLogMessages();

      expect(progressCalls).toHaveLength(2);
      expect(progressCalls[0]).toEqual(
        expect.objectContaining({ progress: 0, total: 1 }),
      );
      expect(progressCalls[1]).toEqual(
        expect.objectContaining({ progress: 1, total: 1 }),
      );

      expect(logMessages).toContain("🔍 Discovering available sales agents...");
      expect(logMessages).toContain("📦 Agent responded with products");
    });

    it("should handle multiple agents scenario", async () => {
      const context = new MCPContextTestDouble();
      await simulateProgressScenario(context, progressScenarios.multipleAgents);

      const progressCalls = context.getProgressCalls();
      const logMessages = context.getLogMessages();

      expect(progressCalls).toHaveLength(4);
      expect(progressCalls[3]).toEqual(
        expect.objectContaining({ progress: 3, total: 3 }),
      );

      expect(logMessages).toContain("📦 First agent responded");
      expect(logMessages).toContain("📦 Second agent responded");
      expect(logMessages).toContain("⚠️ Third agent failed");

      // Verify progress sequence is valid
      const validation = context.verifyProgressSequence();
      expect(validation.isValid).toBe(true);
    });

    it("should handle indeterminate progress scenario", async () => {
      const context = new MCPContextTestDouble();
      await simulateProgressScenario(
        context,
        progressScenarios.indeterminateProgress,
      );

      const progressCalls = context.getProgressCalls();

      // All progress calls should have undefined total (indeterminate)
      progressCalls.forEach((call) => {
        expect(call.total).toBeUndefined();
      });

      expect(progressCalls).toEqual([
        expect.objectContaining({ progress: 0, total: undefined }),
        expect.objectContaining({ progress: 1, total: undefined }),
        expect.objectContaining({ progress: 2, total: undefined }),
      ]);
    });
  });

  describe("Error Detection and Validation", () => {
    it("should detect progress sequence violations", async () => {
      const context = new MCPContextTestDouble();

      // Create an invalid sequence
      await context.reportProgress({ progress: 0, total: 3 });
      await context.reportProgress({ progress: 2, total: 3 });
      await context.reportProgress({ progress: 1, total: 3 }); // Decreases!

      const validation = context.verifyProgressSequence();
      expect(validation.isValid).toBe(false);
      expect(validation.violations).toContain(
        "Progress decreased from 2 to 1 at index 2",
      );
    });

    it("should detect inconsistent total values", async () => {
      const context = new MCPContextTestDouble();

      await context.reportProgress({ progress: 0, total: 3 });
      await context.reportProgress({ progress: 1, total: 5 }); // Changed total!

      const validation = context.verifyProgressSequence();
      expect(validation.isValid).toBe(false);
      expect(validation.violations).toContain(
        "Total changed from 3 to 5 during progress",
      );
    });

    it("should detect progress exceeding total", async () => {
      const context = new MCPContextTestDouble();

      await context.reportProgress({ progress: 5, total: 3 }); // Exceeds!

      const validation = context.verifyProgressSequence();
      expect(validation.isValid).toBe(false);
      expect(validation.violations).toContain(
        "Progress 5 exceeds total 3 at index 0",
      );
    });

    it("should detect missing phase messages", () => {
      const context = new MCPContextTestDouble();

      context.log.info("🔍 Discovering available sales agents...");
      // Missing other expected phases

      const result = context.verifyPhaseMessages([
        "discovering available sales agents",
        "querying sales agents",
        "processing results",
        "discovery completed",
      ]);

      expect(result.found).toBe(false);
      expect(result.missing).toEqual([
        "querying sales agents",
        "processing results",
        "discovery completed",
      ]);
    });
  });
});
