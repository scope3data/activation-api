// Media Buy Approval Webhook Handler
// Processes status updates from sales agents for media buy approvals

import { AdCPMediaBuyService } from "../services/adcp-media-buy-service.js";
import { TacticBigQueryService } from "../services/tactic-bigquery-service.js";

export interface MediaBuyWebhookPayload {
  approval_date?: string;
  buyer_ref: string; // tactic ID
  creative_deadline?: string;
  event_type: "activation_status" | "approval_status" | "rejection";
  media_buy_id: string;
  message?: string;
  rejection_reason?: string;
  status: "active" | "approved" | "live" | "paused" | "rejected";
  timestamp: string;
}

export interface WebhookValidationResult {
  error?: string;
  isValid: boolean;
  tacticId?: string;
}

export class MediaBuyApprovalWebhookHandler {
  private mediaBuyService: AdCPMediaBuyService;
  private tacticService: TacticBigQueryService;

  constructor() {
    this.tacticService = new TacticBigQueryService();
    this.mediaBuyService = new AdCPMediaBuyService();
  }

  /**
   * Handle incoming media buy approval webhook
   */
  async handleWebhook(
    tacticId: string,
    payload: MediaBuyWebhookPayload,
    signature: string,
    rawBody: string,
  ): Promise<{
    error?: string;
    message: string;
    success: boolean;
  }> {
    try {
      // 1. Validate webhook signature and get tactic
      const validation = await this.validateWebhook(
        tacticId,
        signature,
        rawBody,
      );

      if (!validation.isValid) {
        return {
          error: validation.error,
          message: "Webhook validation failed",
          success: false,
        };
      }

      // 2. Validate payload matches tactic
      if (payload.buyer_ref !== tacticId) {
        return {
          error: `Expected ${tacticId}, got ${payload.buyer_ref}`,
          message: "Payload buyer_ref does not match tactic ID",
          success: false,
        };
      }

      // 3. Process the status update
      const result = await this.processStatusUpdate(tacticId, payload);

      return {
        message: `Tactic ${tacticId} status updated to ${result.newStatus}`,
        success: true,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        message: "Failed to process webhook",
        success: false,
      };
    }
  }

  /**
   * Map media buy status to tactic status
   */
  private mapMediaBuyStatusToTacticStatus(mediaBuyStatus: string): string {
    switch (mediaBuyStatus) {
      case "active":
        return "active";
      case "approved":
        return "active"; // Approved means ready to go live
      case "pending_approval":
      case "submitted":
        return "pending_approval";
      case "rejected":
        return "failed";
      default:
        return "draft";
    }
  }

  /**
   * Map webhook payload status to internal media buy status
   */
  private mapPayloadStatusToMediaBuyStatus(
    payloadStatus: string,
  ): "active" | "approved" | "pending_approval" | "rejected" | "submitted" {
    switch (payloadStatus.toLowerCase()) {
      case "active":
      case "live":
        return "active";
      case "approved":
        return "approved";
      case "declined":
      case "rejected":
        return "rejected";
      case "submitted":
        return "submitted";
      default:
        return "pending_approval";
    }
  }

  /**
   * Process media buy status update
   */
  private async processStatusUpdate(
    tacticId: string,
    payload: MediaBuyWebhookPayload,
  ): Promise<{
    mediaBuyStatus: string;
    newStatus: string;
  }> {
    // Map payload status to internal status
    const mediaBuyStatus = this.mapPayloadStatusToMediaBuyStatus(
      payload.status,
    );
    const tacticStatus = this.mapMediaBuyStatusToTacticStatus(mediaBuyStatus);

    // Prepare update data
    const updates: Parameters<
      typeof this.tacticService.updateTacticMediaBuy
    >[1] = {
      media_buy_status: mediaBuyStatus,
    };

    // Add approval timestamp for approved status
    if (mediaBuyStatus === "approved" || mediaBuyStatus === "active") {
      updates.media_buy_approved_at =
        payload.approval_date || new Date().toISOString();
    }

    // Add error message for rejections
    if (mediaBuyStatus === "rejected" && payload.rejection_reason) {
      updates.error_message = payload.rejection_reason;
    }

    // Update media buy info
    await this.tacticService.updateTacticMediaBuy(tacticId, updates);

    // Update tactic status if needed
    if (tacticStatus !== mediaBuyStatus) {
      await this.tacticService.updateTacticStatus(tacticId, tacticStatus);
    }

    return {
      mediaBuyStatus,
      newStatus: tacticStatus,
    };
  }

  /**
   * Validate webhook signature and get tactic details
   */
  private async validateWebhook(
    tacticId: string,
    signature: string,
    rawBody: string,
  ): Promise<WebhookValidationResult> {
    try {
      // Get tactic to retrieve webhook secret
      const tactics = await this.tacticService.listTactics("dummy_campaign_id"); // We need tactic by ID method
      const tactic = tactics.find((t) => t.id === tacticId);

      if (!tactic) {
        return {
          error: `Tactic ${tacticId} not found`,
          isValid: false,
        };
      }

      // Get webhook secret from tactic data - cast to include BigQuery fields
      const tacticWithWebhook = tactic as {
        webhook_secret?: string;
      } & typeof tactic;
      const webhookSecret = tacticWithWebhook.webhook_secret;
      if (!webhookSecret) {
        return {
          error: "No webhook secret found for tactic",
          isValid: false,
        };
      }

      // Validate signature
      const isValid = this.mediaBuyService.validateWebhookSignature(
        rawBody,
        signature,
        webhookSecret,
      );

      if (!isValid) {
        return {
          error: "Invalid webhook signature",
          isValid: false,
        };
      }

      return {
        isValid: true,
        tacticId,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        isValid: false,
      };
    }
  }
}

/**
 * HTTP handler function for media buy webhooks
 * This would be integrated with the web server/framework
 */
export async function handleMediaBuyWebhookRequest(request: {
  body: MediaBuyWebhookPayload;
  headers: { [key: string]: string };
  params: { tacticId: string };
  rawBody: string;
}): Promise<{
  body: Record<string, unknown>;
  statusCode: number;
}> {
  const handler = new MediaBuyApprovalWebhookHandler();

  try {
    // Extract signature from headers (common patterns)
    const signature =
      request.headers["x-signature"] ||
      request.headers["x-hub-signature"] ||
      request.headers["signature"] ||
      "";

    if (!signature) {
      return {
        body: { error: "Missing webhook signature" },
        statusCode: 400,
      };
    }

    // Process webhook
    const result = await handler.handleWebhook(
      request.params.tacticId,
      request.body,
      signature,
      request.rawBody,
    );

    if (result.success) {
      return {
        body: { message: result.message },
        statusCode: 200,
      };
    } else {
      return {
        body: {
          details: result.error,
          error: result.message,
        },
        statusCode: 400,
      };
    }
  } catch (error) {
    return {
      body: {
        details: error instanceof Error ? error.message : String(error),
        error: "Internal server error",
      },
      statusCode: 500,
    };
  }
}
