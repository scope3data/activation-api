/* eslint-disable @typescript-eslint/no-unused-vars */
import type { PreloadService } from "../contracts/cache-service.js";

/**
 * Test Double for Preload Service
 *
 * Provides controllable preload simulation for testing without
 * external dependencies or network calls.
 */
export class PreloadServiceTestDouble implements PreloadService {
  private activePreloads = new Map<number, Promise<void>>();
  private customerIdCounter = 1000;
  private customerIdMap = new Map<string, number>(); // apiKey -> customerId
  private preloadDelay = 100; // Simulate preload work

  constructor(
    private config?: {
      maxConcurrentPreloads?: number;
      preloadDelay?: number;
      shouldFail?: boolean;
    },
  ) {
    this.preloadDelay = config?.preloadDelay ?? 100;
  }

  public clearPreloads(): void {
    this.activePreloads.clear();
    this.customerIdMap.clear();
  }

  public getCustomerIdForApiKey(apiKey: string): number | undefined {
    return this.customerIdMap.get(apiKey);
  }

  getPreloadStatus(): { activePreloads: number; customerIds: number[] } {
    return {
      activePreloads: this.activePreloads.size,
      customerIds: Array.from(this.activePreloads.keys()),
    };
  }

  // Test utilities
  public setPreloadDelay(delayMs: number): void {
    this.preloadDelay = delayMs;
  }

  public simulatePreloadFailure(shouldFail: boolean): void {
    this.config = { ...this.config, shouldFail };
  }

  triggerPreload(apiKey: string): void {
    // Non-blocking - start preload in background
    this.startPreload(apiKey).catch((err) => {
      console.error("[TestDouble] Preload failed:", err);
    });
  }

  async waitForPreload(
    customerId: number,
    timeoutMs: number = 5000,
  ): Promise<void> {
    const preloadPromise = this.activePreloads.get(customerId);
    if (!preloadPromise) {
      throw new Error(`No active preload for customer ${customerId}`);
    }

    // Race between preload completion and timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Preload timeout for customer ${customerId}`)),
        timeoutMs,
      ),
    );

    await Promise.race([preloadPromise, timeoutPromise]);
  }

  private async doPreload(customerId: number, apiKey: string): Promise<void> {
    if (this.config?.shouldFail) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.preloadDelay / 2),
      );
      throw new Error(`Simulated preload failure for customer ${customerId}`);
    }

    // Simulate preload work phases
    const phases = [
      "Loading brand agents",
      "Loading campaigns",
      "Loading campaign details",
      "Loading brand agent details",
    ];

    for (const phase of phases) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.preloadDelay / phases.length),
      );
      // Could emit events or log progress here for testing
    }
  }

  private async startPreload(apiKey: string): Promise<void> {
    // Get or create customer ID for this API key
    let customerId = this.customerIdMap.get(apiKey);
    if (!customerId) {
      customerId = this.customerIdCounter++;
      this.customerIdMap.set(apiKey, customerId);
    }

    // Check if already preloading for this customer
    if (this.activePreloads.has(customerId)) {
      return this.activePreloads.get(customerId);
    }

    // Check concurrent preload limit
    if (
      this.config?.maxConcurrentPreloads &&
      this.activePreloads.size >= this.config.maxConcurrentPreloads
    ) {
      throw new Error("Maximum concurrent preloads exceeded");
    }

    // Start preload
    const preloadPromise = this.doPreload(customerId, apiKey);
    this.activePreloads.set(customerId, preloadPromise);

    try {
      await preloadPromise;
    } finally {
      this.activePreloads.delete(customerId);
    }
  }
}
