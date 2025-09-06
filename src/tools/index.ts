import type { FastMCP } from "fastmcp";

import type { Scope3ApiClient } from "../client/scope3-client.js";

import { getAmpAgentsTool } from "./agents/get-amp-agents.js";
import { checkAuthTool } from "./auth/check-auth.js";
// Brand Agent audience tools
import { createSyntheticAudienceTool } from "./brand-agents/audiences/create-audience.js";
import { listSyntheticAudiencesTool } from "./brand-agents/audiences/list-audiences.js";
// Brand Agent campaign tools
import { createBrandAgentCampaignTool } from "./brand-agents/campaigns/create-campaign.js";
import { listBrandAgentCampaignsTool } from "./brand-agents/campaigns/list-campaigns.js";
import { updateBrandAgentCampaignTool } from "./brand-agents/campaigns/update-campaign.js";
// Brand Agent core tools
import { createBrandAgentTool } from "./brand-agents/core/create-brand-agent.js";
import { deleteBrandAgentTool } from "./brand-agents/core/delete-brand-agent.js";
import { getBrandAgentTool } from "./brand-agents/core/get-brand-agent.js";
import { listBrandAgentsTool } from "./brand-agents/core/list-brand-agents.js";
import { updateBrandAgentTool } from "./brand-agents/core/update-brand-agent.js";
// Brand Agent creative tools
import { createBrandAgentCreativeTool } from "./brand-agents/creatives/create-creative.js";
import { listBrandAgentCreativesTool } from "./brand-agents/creatives/list-creatives.js";
import { updateBrandAgentCreativeTool } from "./brand-agents/creatives/update-creative.js";
// Brand Agent inventory tools
import { adjustInventoryAllocationTool } from "./brand-agents/inventory/adjust-inventory-allocation.js";
import { analyzeInventoryPerformanceTool } from "./brand-agents/inventory/analyze-inventory-performance.js";
import { createInventoryOptionTool } from "./brand-agents/inventory/create-inventory-option.js";
import { discoverPublisherProductsTool } from "./brand-agents/inventory/discover-publisher-products.js";
import { listInventoryOptionsTool } from "./brand-agents/inventory/list-inventory-options.js";
// Brand Agent measurement tools
import { addMeasurementSourceTool } from "./brand-agents/measurement/add-measurement-source.js";
import { listMeasurementSourcesTool } from "./brand-agents/measurement/list-measurement-sources.js";
// Brand Agent standards tools
import { getBrandStandardsTool } from "./brand-agents/standards/get-brand-standards.js";
import { setBrandStandardsTool } from "./brand-agents/standards/set-brand-standards.js";
import { createCampaignTool } from "./campaigns/create-campaign.js";
import { updateCampaignTool } from "./campaigns/update-campaign.js";

export const registerTools = (server: FastMCP, client: Scope3ApiClient) => {
  // Authentication and existing agent tools
  server.addTool(checkAuthTool(client));
  server.addTool(getAmpAgentsTool(client));

  // Original campaign tools (kept for backward compatibility)
  server.addTool(createCampaignTool(client));
  server.addTool(updateCampaignTool(client));

  // Brand Agent core tools
  server.addTool(createBrandAgentTool(client));
  server.addTool(updateBrandAgentTool(client));
  server.addTool(deleteBrandAgentTool(client));
  server.addTool(getBrandAgentTool(client));
  server.addTool(listBrandAgentsTool(client));

  // Brand Agent campaign tools
  server.addTool(createBrandAgentCampaignTool(client));
  server.addTool(updateBrandAgentCampaignTool(client));
  server.addTool(listBrandAgentCampaignsTool(client));

  // Brand Agent creative tools
  server.addTool(createBrandAgentCreativeTool(client));
  server.addTool(updateBrandAgentCreativeTool(client));
  server.addTool(listBrandAgentCreativesTool(client));

  // Brand Agent inventory tools
  server.addTool(discoverPublisherProductsTool(client));
  server.addTool(createInventoryOptionTool(client));
  server.addTool(listInventoryOptionsTool(client));
  server.addTool(adjustInventoryAllocationTool(client));
  server.addTool(analyzeInventoryPerformanceTool(client));

  // Brand Agent standards tools
  server.addTool(setBrandStandardsTool(client));
  server.addTool(getBrandStandardsTool(client));

  // Brand Agent audience tools
  server.addTool(createSyntheticAudienceTool(client));
  server.addTool(listSyntheticAudiencesTool(client));

  // Brand Agent measurement tools
  server.addTool(addMeasurementSourceTool(client));
  server.addTool(listMeasurementSourcesTool(client));
};

// Export individual tools for testing
export {
  // Brand Agent measurement tools
  addMeasurementSourceTool,
  // Brand Agent inventory tools
  adjustInventoryAllocationTool,
  analyzeInventoryPerformanceTool,
  // Original tools
  checkAuthTool,
  // Brand Agent campaign tools
  createBrandAgentCampaignTool,
  // Brand Agent creative tools
  createBrandAgentCreativeTool,

  // Brand Agent core tools
  createBrandAgentTool,
  createCampaignTool,
  createInventoryOptionTool,
  // Brand Agent audience tools
  createSyntheticAudienceTool,
  deleteBrandAgentTool,
  discoverPublisherProductsTool,
  getAmpAgentsTool,
  getBrandAgentTool,
  getBrandStandardsTool,
  listBrandAgentCampaignsTool,
  listBrandAgentCreativesTool,
  listBrandAgentsTool,
  listInventoryOptionsTool,
  listMeasurementSourcesTool,
  listSyntheticAudiencesTool,
  // Brand Agent standards tools
  setBrandStandardsTool,
  updateBrandAgentCampaignTool,
  updateBrandAgentCreativeTool,
  updateBrandAgentTool,
  updateCampaignTool,
};
