import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import type {
  ADCPGetProductsRequest,
  ADCPGetProductsResponse,
} from "../types/adcp.js";
import type { SalesAgent } from "./bigquery-service.js";

export class MCPClientService {
  private clients: Map<string, Client> = new Map();

  /**
   * Call get_products on a specific sales agent using official MCP SDK
   */
  async callGetProducts(
    salesAgent: SalesAgent,
    request: ADCPGetProductsRequest,
  ): Promise<ADCPGetProductsResponse> {
    try {
      const client = await this.getClient(salesAgent);

      const result = (await client.callTool({
        arguments: { req: request },
        name: "get_products",
      })) as CallToolResult;

      if (result.isError) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorText = (result as any).content?.[0]?.text || "Unknown error";
        throw new Error(
          `Sales agent ${salesAgent.name} returned error: ${errorText}`,
        );
      }

      // Parse the response - this might need adjustment based on actual response format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const responseText = (result as any).content?.[0]?.text || "{}";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsedResponse: any;

      try {
        parsedResponse = JSON.parse(responseText);
      } catch {
        // If not JSON, treat as plain text message
        parsedResponse = {
          message: responseText,
          products: [],
        };
      }

      return {
        message: parsedResponse.message || responseText,
        products: parsedResponse.products || [],
        sales_agent: {
          name: salesAgent.name,
          principal_id: salesAgent.principal_id,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to call get_products on ${salesAgent.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Call get_products on multiple sales agents concurrently
   */
  async callGetProductsMultiple(
    salesAgents: SalesAgent[],
    request: ADCPGetProductsRequest,
  ): Promise<{
    failed: { agent: SalesAgent; error: string }[];
    successful: ADCPGetProductsResponse[];
  }> {
    const promises = salesAgents.map(async (agent) => {
      try {
        const response = await this.callGetProducts(agent, request);
        return { agent, response, success: true };
      } catch (error) {
        return {
          agent,
          error: error instanceof Error ? error.message : String(error),
          success: false,
        };
      }
    });

    const results = await Promise.allSettled(promises);

    const successful: ADCPGetProductsResponse[] = [];
    const failed: { agent: SalesAgent; error: string }[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        if ("success" in result.value && result.value.success) {
          successful.push(result.value.response!);
        } else if ("success" in result.value && !result.value.success) {
          failed.push({
            agent: result.value.agent,
            error: result.value.error!,
          });
        }
      } else {
        failed.push({
          agent: salesAgents[index],
          error: (result.reason as Error)?.message || "Promise rejected",
        });
      }
    });

    return { failed, successful };
  }

  /**
   * Close all client connections
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.clients.values()).map((client) =>
      client
        .close()
        .catch((error) => console.error("Error closing MCP client:", error)),
    );

    await Promise.allSettled(closePromises);
    this.clients.clear();
  }

  /**
   * Close connection to specific sales agent
   */
  async closeClient(principalId: string): Promise<void> {
    const client = this.clients.get(principalId);
    if (client) {
      await client.close();
      this.clients.delete(principalId);
    }
  }

  /**
   * Check if a sales agent is reachable
   */
  async healthCheck(salesAgent: SalesAgent): Promise<boolean> {
    try {
      const client = await this.getClient(salesAgent);
      // Try to list tools as a basic health check
      await client.listTools();
      return true;
    } catch (error) {
      console.error(`Health check failed for ${salesAgent.name}:`, error);
      return false;
    }
  }

  /**
   * Create or get existing MCP client for a sales agent
   */
  private async getClient(salesAgent: SalesAgent): Promise<Client> {
    const clientKey = salesAgent.principal_id;

    if (this.clients.has(clientKey)) {
      return this.clients.get(clientKey)!;
    }

    // Choose the appropriate transport based on the agent URI
    // Use StreamableHTTP transport for HTTP-based MCP agents
    // This properly handles streaming HTTP with authentication headers
    const url = new URL(salesAgent.agent_uri);

    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: {
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          "x-adcp-auth": salesAgent.auth_token,
        },
      },
    });

    const client = new Client(
      {
        name: `mcp-client-${salesAgent.name}`,
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    await client.connect(transport);
    this.clients.set(clientKey, client);

    return client;
  }
}
