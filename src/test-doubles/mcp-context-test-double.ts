/**
 * Test double for MCP context with progress reporting and logging capabilities
 * Used for testing MCP tools that use progress notifications and phase logging
 */

import type {
  MCPLogger,
  MCPToolExecuteContext,
  Progress,
  SerializableValue,
} from "../types/mcp.js";

export interface LogCall {
  data?: SerializableValue;
  level: "debug" | "error" | "info" | "warn";
  message: string;
  timestamp: number;
}

export interface ProgressCall {
  progress: number;
  timestamp: number;
  total?: number;
}

export interface ProgressValidation {
  isValid: boolean;
  violations: string[];
}

/**
 * Test double that captures and validates MCP progress and logging calls
 */
export class MCPContextTestDouble implements MCPToolExecuteContext {
  private logCalls: LogCall[] = [];

  /**
   * Mock logger implementation that captures all log calls
   */
  log: MCPLogger = {
    debug: (message: string, data?: SerializableValue) => {
      this.logCalls.push({
        data,
        level: "debug",
        message,
        timestamp: Date.now(),
      });
    },
    error: (message: string, data?: SerializableValue) => {
      this.logCalls.push({
        data,
        level: "error",
        message,
        timestamp: Date.now(),
      });
    },
    info: (message: string, data?: SerializableValue) => {
      this.logCalls.push({
        data,
        level: "info",
        message,
        timestamp: Date.now(),
      });
    },
    warn: (message: string, data?: SerializableValue) => {
      this.logCalls.push({
        data,
        level: "warn",
        message,
        timestamp: Date.now(),
      });
    },
  };
  public session: {
    customerId?: number;
    scope3ApiKey?: string;
    userId?: string;
  };

  private progressCalls: ProgressCall[] = [];

  constructor(session?: {
    customerId?: number;
    scope3ApiKey?: string;
    userId?: string;
  }) {
    this.session = session || {
      customerId: 123,
      scope3ApiKey: "test-api-key",
      userId: "test-user",
    };
  }

  /**
   * Get all captured log calls
   */
  getLogCalls(): LogCall[] {
    return [...this.logCalls];
  }

  /**
   * Get log calls filtered by level
   */
  getLogCallsByLevel(level: "debug" | "error" | "info" | "warn"): LogCall[] {
    return this.logCalls.filter((call) => call.level === level);
  }

  /**
   * Get log messages as an array of strings
   */
  getLogMessages(): string[] {
    return this.logCalls.map((call) => call.message);
  }

  /**
   * Get all captured progress calls
   */
  getProgressCalls(): ProgressCall[] {
    return [...this.progressCalls];
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    return {
      logCalls: this.logCalls.length,
      logLevels: {
        debug: this.getLogCallsByLevel("debug").length,
        error: this.getLogCallsByLevel("error").length,
        info: this.getLogCallsByLevel("info").length,
        warn: this.getLogCallsByLevel("warn").length,
      },
      progressCalls: this.progressCalls.length,
      progressRange:
        this.progressCalls.length > 0
          ? {
              final:
                this.progressCalls[this.progressCalls.length - 1]?.progress ||
                0,
              max: Math.max(...this.progressCalls.map((c) => c.progress)),
              min: Math.min(...this.progressCalls.map((c) => c.progress)),
            }
          : null,
    };
  }

  /**
   * Mock implementation of reportProgress that captures calls for testing
   */
  reportProgress = async (progress: Progress): Promise<void> => {
    this.progressCalls.push({
      progress: progress.progress,
      timestamp: Date.now(),
      total: progress.total,
    });
  };

  /**
   * Reset all captured calls
   */
  reset(): void {
    this.progressCalls = [];
    this.logCalls = [];
  }

  /**
   * Verify that expected phase messages are present
   */
  verifyPhaseMessages(expectedPhases: string[]): {
    found: boolean;
    missing: string[];
  } {
    const logMessages = this.getLogMessages();
    const missing: string[] = [];

    for (const expectedPhase of expectedPhases) {
      const found = logMessages.some((message) =>
        message.toLowerCase().includes(expectedPhase.toLowerCase()),
      );
      if (!found) {
        missing.push(expectedPhase);
      }
    }

    return {
      found: missing.length === 0,
      missing,
    };
  }

  /**
   * Validate progress call sequence for correctness
   */
  verifyProgressSequence(): ProgressValidation {
    const violations: string[] = [];

    if (this.progressCalls.length === 0) {
      return { isValid: true, violations: [] };
    }

    // Check that progress is non-decreasing
    for (let i = 1; i < this.progressCalls.length; i++) {
      const prev = this.progressCalls[i - 1];
      const curr = this.progressCalls[i];

      if (curr.progress < prev.progress) {
        violations.push(
          `Progress decreased from ${prev.progress} to ${curr.progress} at index ${i}`,
        );
      }
    }

    // Check that total remains consistent (if provided)
    const totals = this.progressCalls
      .map((call) => call.total)
      .filter((total) => total !== undefined);

    if (totals.length > 1) {
      const firstTotal = totals[0];
      for (let i = 1; i < totals.length; i++) {
        if (totals[i] !== firstTotal) {
          violations.push(
            `Total changed from ${firstTotal} to ${totals[i]} during progress`,
          );
        }
      }
    }

    // Check that progress doesn't exceed total
    this.progressCalls.forEach((call, index) => {
      if (call.total !== undefined && call.progress > call.total) {
        violations.push(
          `Progress ${call.progress} exceeds total ${call.total} at index ${index}`,
        );
      }
    });

    // Check for negative progress
    this.progressCalls.forEach((call, index) => {
      if (call.progress < 0) {
        violations.push(`Negative progress ${call.progress} at index ${index}`);
      }
    });

    return {
      isValid: violations.length === 0,
      violations,
    };
  }
}

/**
 * Factory functions for common test scenarios
 */
export const createMCPContextTestDouble = {
  /**
   * Context with no MCP capabilities (minimal)
   */
  minimal: (session?: {
    customerId?: number;
    scope3ApiKey?: string;
    userId?: string;
  }) => {
    const context = new MCPContextTestDouble(session);
    delete (context as unknown as Record<string, unknown>).reportProgress;
    delete (context as unknown as Record<string, unknown>).log;
    return context;
  },

  /**
   * Standard context with full capabilities
   */
  withFullCapabilities: (session?: {
    customerId?: number;
    scope3ApiKey?: string;
    userId?: string;
  }) => {
    return new MCPContextTestDouble(session);
  },

  /**
   * Context without logging capability
   */
  withoutLogging: (session?: {
    customerId?: number;
    scope3ApiKey?: string;
    userId?: string;
  }) => {
    const context = new MCPContextTestDouble(session);
    // Remove logging capability
    delete (context as unknown as Record<string, unknown>).log;
    return context;
  },

  /**
   * Context without progress reporting capability
   */
  withoutProgress: (session?: {
    customerId?: number;
    scope3ApiKey?: string;
    userId?: string;
  }) => {
    const context = new MCPContextTestDouble(session);
    // Remove progress reporting capability
    delete (context as unknown as Record<string, unknown>).reportProgress;
    return context;
  },
};
