import type { FastMCP } from "fastmcp";

import type { Scope3ApiClient } from "../client/scope3-client.js";

import { getAmpAgentsTool } from "./agents/get-amp-agents.js";
// Import all tools
import { checkAuthTool } from "./auth/check-auth.js";
import { createCampaignTool } from "./campaigns/create-campaign.js";
import { updateCampaignTool } from "./campaigns/update-campaign.js";

export const registerTools = (server: FastMCP, client: Scope3ApiClient) => {
  server.addTool(checkAuthTool(client));
  server.addTool(getAmpAgentsTool(client));
  server.addTool(createCampaignTool(client));
  server.addTool(updateCampaignTool(client));
};

// Export individual tools for testing
export {
  checkAuthTool,
  createCampaignTool,
  getAmpAgentsTool,
  updateCampaignTool,
};
