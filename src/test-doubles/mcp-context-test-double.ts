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

export interface ProgressCall {
  progress: number;
  total?: number;
  timestamp: number;
}

export interface LogCall {
  level: "debug" | "error" | "info" | "warn";
  message: string;
  data?: SerializableValue;
  timestamp: number;
}

export interface ProgressValidation {
  isValid: boolean;
  violations: string[];
}

/**
 * Test double that captures and validates MCP progress and logging calls
 */
export class MCPContextTestDouble implements MCPToolExecuteContext {
  public session: {
    customerId?: number;
    scope3ApiKey?: string;
    userId?: string;
  };

  private progressCalls: ProgressCall[] = [];
  private logCalls: LogCall[] = [];

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
   * Mock implementation of reportProgress that captures calls for testing
   */
  reportProgress = async (progress: Progress): Promise<void> => {
    this.progressCalls.push({
      progress: progress.progress,
      total: progress.total,
      timestamp: Date.now(),
    });
  };

  /**
   * Mock logger implementation that captures all log calls
   */
  log: MCPLogger = {
    debug: (message: string, data?: SerializableValue) => {
      this.logCalls.push({
        level: "debug",
        message,
        data,
        timestamp: Date.now(),
      });
    },
    error: (message: string, data?: SerializableValue) => {
      this.logCalls.push({
        level: "error",
        message,
        data,
        timestamp: Date.now(),
      });
    },
    info: (message: string, data?: SerializableValue) => {
      this.logCalls.push({
        level: "info",
        message,
        data,
        timestamp: Date.now(),
      });
    },
    warn: (message: string, data?: SerializableValue) => {
      this.logCalls.push({
        level: "warn",
        message,
        data,
        timestamp: Date.now(),
      });
    },
  };

  /**
   * Get all captured progress calls
   */
  getProgressCalls(): ProgressCall[] {
    return [...this.progressCalls];
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
   * Reset all captured calls
   */
  reset(): void {
    this.progressCalls = [];
    this.logCalls = [];
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    return {
      progressCalls: this.progressCalls.length,
      logCalls: this.logCalls.length,
      logLevels: {
        debug: this.getLogCallsByLevel("debug").length,
        error: this.getLogCallsByLevel("error").length,
        info: this.getLogCallsByLevel("info").length,
        warn: this.getLogCallsByLevel("warn").length,
      },
      progressRange:
        this.progressCalls.length > 0
          ? {
              min: Math.min(...this.progressCalls.map((c) => c.progress)),
              max: Math.max(...this.progressCalls.map((c) => c.progress)),
              final:
                this.progressCalls[this.progressCalls.length - 1]?.progress ||
                0,
            }
          : null,
    };
  }
}

/**
 * Factory functions for common test scenarios
 */
export const createMCPContextTestDouble = {
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
   * Context without progress reporting capability
   */
  withoutProgress: (session?: {
    customerId?: number;
    scope3ApiKey?: string;
    userId?: string;
  }) => {
    const context = new MCPContextTestDouble(session);
    // Remove progress reporting capability
    delete (context as any).reportProgress;
    return context;
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
    delete (context as any).log;
    return context;
  },

  /**
   * Context with no MCP capabilities (minimal)
   */
  minimal: (session?: {
    customerId?: number;
    scope3ApiKey?: string;
    userId?: string;
  }) => {
    const context = new MCPContextTestDouble(session);
    delete (context as any).reportProgress;
    delete (context as any).log;
    return context;
  },
};
