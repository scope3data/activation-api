import { z } from "zod";

import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { AssetStorageService } from "../../services/asset-storage-service.js";
import { requireSessionAuth } from "../../utils/auth.js";

/**
 * Get asset usage analytics and directory management
 */
export const assetsAnalyticsTool = () => ({
  annotations: {
    category: "Assets",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Asset Usage Analytics",
  },

  description:
    "Get asset usage analytics by customer and brand agent. Shows asset counts, storage usage, and activity patterns. Useful for understanding usage patterns and identifying inactive customers/brand agents for cleanup.",

  execute: async (
    args: {
      customerId?: string;
      includeInactive?: boolean;
      scope: "brand-agents" | "customers";
    },
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Universal session authentication check
    const { customerId: authenticatedCustomerId } = requireSessionAuth(context);

    const storageService = new AssetStorageService();

    try {
      if (args.scope === "customers") {
        // List all customers with asset statistics
        const customers = await storageService.listCustomers();

        // Filter inactive customers if requested
        const filteredCustomers = args.includeInactive
          ? customers
          : customers.filter((customer) => {
              const daysSinceActivity = Math.floor(
                (Date.now() - new Date(customer.lastActivity).getTime()) /
                  (1000 * 60 * 60 * 24),
              );
              return daysSinceActivity <= 30; // Active within 30 days
            });

        let response = `📊 **Customer Asset Analytics**

🆔 **Overview**
• Authenticated Customer: ${authenticatedCustomerId}
• Total Customers: ${customers.length}
• Active Customers: ${filteredCustomers.length}
• Filter: ${args.includeInactive ? "All customers" : "Active only (30 days)"}

📋 **Customer Breakdown:**`;

        if (filteredCustomers.length === 0) {
          response += `\n\n📋 **No customers found**`;
          return response;
        }

        // Sort by asset count (descending)
        filteredCustomers.sort((a, b) => b.assetCount - a.assetCount);

        for (const customer of filteredCustomers.slice(0, 50)) {
          // Limit to top 50
          const daysSinceActivity = Math.floor(
            (Date.now() - new Date(customer.lastActivity).getTime()) /
              (1000 * 60 * 60 * 24),
          );

          response += `
• **Customer ${customer.customerId}**
  📦 Assets: ${customer.assetCount}
  📅 Last Activity: ${daysSinceActivity} days ago
  ${daysSinceActivity > 30 ? "⚠️ Inactive" : "✅ Active"}`;
        }

        if (filteredCustomers.length > 50) {
          response += `
  ... and ${filteredCustomers.length - 50} more customers`;
        }

        // Add cleanup suggestions
        const inactiveCustomers = customers.filter((customer) => {
          const daysSinceActivity = Math.floor(
            (Date.now() - new Date(customer.lastActivity).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          return daysSinceActivity > 90; // Inactive for 90+ days
        });

        if (inactiveCustomers.length > 0) {
          response += `

🧹 **Cleanup Recommendations**
• ${inactiveCustomers.length} customers inactive for 90+ days
• Consider cleanup using asset management tools
• Total assets in inactive customers: ${inactiveCustomers.reduce((sum, c) => sum + c.assetCount, 0)}`;
        }

        return response;
      } else {
        // List brand agents for a specific customer
        const targetCustomerId =
          args.customerId || String(authenticatedCustomerId);
        const brandAgents =
          await storageService.listBrandAgents(targetCustomerId);

        let response = `📊 **Brand Agent Asset Analytics**

🆔 **Overview**
• Customer ID: ${targetCustomerId}
• Total Brand Agents: ${brandAgents.length}
• Filter: ${args.includeInactive ? "All brand agents" : "Active only (30 days)"}

📋 **Brand Agent Breakdown:**`;

        if (brandAgents.length === 0) {
          response += `\n\n📋 **No brand agents found for customer ${targetCustomerId}**`;
          return response;
        }

        // Filter inactive brand agents if requested
        const filteredAgents = args.includeInactive
          ? brandAgents
          : brandAgents.filter((agent) => {
              const daysSinceActivity = Math.floor(
                (Date.now() - new Date(agent.lastActivity).getTime()) /
                  (1000 * 60 * 60 * 24),
              );
              return daysSinceActivity <= 30; // Active within 30 days
            });

        // Sort by asset count (descending)
        filteredAgents.sort((a, b) => b.assetCount - a.assetCount);

        for (const agent of filteredAgents) {
          const daysSinceActivity = Math.floor(
            (Date.now() - new Date(agent.lastActivity).getTime()) /
              (1000 * 60 * 60 * 24),
          );

          response += `
• **Brand Agent ${agent.brandAgentId}**
  📦 Assets: ${agent.assetCount}
  📅 Last Activity: ${daysSinceActivity} days ago
  ${daysSinceActivity > 30 ? "⚠️ Inactive" : "✅ Active"}`;
        }

        // Add usage insights
        const totalAssets = filteredAgents.reduce(
          (sum, agent) => sum + agent.assetCount,
          0,
        );
        const avgAssetsPerAgent = totalAssets / (filteredAgents.length || 1);

        response += `

📈 **Usage Insights**
• Total Assets: ${totalAssets}
• Average per Brand Agent: ${Math.round(avgAssetsPerAgent)}
• Most Active: ${filteredAgents[0]?.brandAgentId} (${filteredAgents[0]?.assetCount} assets)`;

        // Add cleanup suggestions
        const inactiveAgents = brandAgents.filter((agent) => {
          const daysSinceActivity = Math.floor(
            (Date.now() - new Date(agent.lastActivity).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          return daysSinceActivity > 60; // Inactive for 60+ days
        });

        if (inactiveAgents.length > 0) {
          response += `

🧹 **Cleanup Recommendations**
• ${inactiveAgents.length} brand agents inactive for 60+ days
• Consider cleanup for unused brand agents
• Assets in inactive agents: ${inactiveAgents.reduce((sum, a) => sum + a.assetCount, 0)}`;
        }

        return response;
      }
    } catch (error) {
      throw new Error(
        `Failed to get asset analytics: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "assets_analytics",

  parameters: z.object({
    customerId: z
      .string()
      .optional()
      .describe("Specific customer ID (required for brand-agents scope)"),

    includeInactive: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include inactive customers/brand agents in results"),

    scope: z
      .enum(["customers", "brand-agents"])
      .describe(
        "Analytics scope: customers (all customers) or brand-agents (for specific customer)",
      ),
  }),
});
