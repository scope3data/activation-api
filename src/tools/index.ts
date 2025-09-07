import type { FastMCP } from "fastmcp";

import type { Scope3ApiClient } from "../client/scope3-client.js";

import { getAmpAgentsTool } from "./agents/get-amp-agents.js";
// New Creative Management Tools (MCP Orchestration)
import { assetsAddTool } from "./assets/add.js";
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
import { createBrandAgentStandardsTool } from "./brand-agents/standards/create-brand-agent-standards.js";
import { deleteBrandAgentStandardsTool } from "./brand-agents/standards/delete-brand-agent-standards.js";
import { listBrandAgentStandardsTool } from "./brand-agents/standards/list-brand-agent-standards.js";
import { updateBrandAgentStandardsTool } from "./brand-agents/standards/update-brand-agent-standards.js";
// Brand Agent stories tools
import { createBrandAgentStoryTool } from "./brand-agents/stories/create-brand-agent-story.js";
import { deleteBrandAgentStoryTool } from "./brand-agents/stories/delete-brand-agent-story.js";
import { listBrandAgentStoriesTool } from "./brand-agents/stories/list-brand-agent-stories.js";
import { updateBrandAgentStoryTool } from "./brand-agents/stories/update-brand-agent-story.js";
// Campaign creative tools
import { campaignAttachCreativeTool } from "./campaigns/attach-creative.js";
import { createCampaignTool } from "./campaigns/create-campaign.js";
import { campaignListCreativesTool } from "./campaigns/list-creatives.js";
import { updateCampaignTool } from "./campaigns/update-campaign.js";
import { creativeApprovalStatusTool } from "./creatives/approval-status.js";
import {
  creativeAssignTool,
  creativeUnassignTool,
} from "./creatives/assign.js";
import { creativeCreateTool } from "./creatives/create.js";
import { creativeListTool } from "./creatives/list.js";
import { creativeReviseTool } from "./creatives/revise.js";
import { creativeSyncPublishersTool } from "./creatives/sync-publishers.js";
import { creativeUpdateTool } from "./creatives/update.js";
import { listCreativeFormatsTool } from "./formats/list.js";
// Reporting tools
import { analyzeTacticsTool } from "./reporting/analyze-tactics.js";
import { exportCampaignDataTool } from "./reporting/export-campaign-data.js";
import { getCampaignSummaryTool } from "./reporting/get-campaign-summary.js";
import { registerWebhookTool } from "./reporting/register-webhook.js";

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
  server.addTool(listBrandAgentStandardsTool(client));
  server.addTool(createBrandAgentStandardsTool(client));
  server.addTool(updateBrandAgentStandardsTool(client));
  server.addTool(deleteBrandAgentStandardsTool(client));

  // Brand Agent stories tools
  server.addTool(listBrandAgentStoriesTool(client));
  server.addTool(createBrandAgentStoryTool(client));
  server.addTool(updateBrandAgentStoryTool(client));
  server.addTool(deleteBrandAgentStoryTool(client));

  // Brand Agent audience tools
  server.addTool(createSyntheticAudienceTool(client));
  server.addTool(listSyntheticAudiencesTool(client));

  // Brand Agent measurement tools
  server.addTool(addMeasurementSourceTool(client));
  server.addTool(listMeasurementSourcesTool(client));

  // Reporting tools
  server.addTool(getCampaignSummaryTool(client));
  server.addTool(exportCampaignDataTool(client));
  server.addTool(registerWebhookTool(client));
  server.addTool(analyzeTacticsTool(client));

  // New Creative Management Tools (MCP Orchestration)
  server.addTool(creativeCreateTool(client)); // creative/create
  server.addTool(creativeUpdateTool(client)); // creative/update
  server.addTool(creativeListTool(client)); // creative/list
  server.addTool(creativeAssignTool(client)); // creative/assign
  server.addTool(creativeUnassignTool(client)); // creative/unassign

  // Publisher Approval Workflow
  server.addTool(creativeSyncPublishersTool(client)); // creative/sync_publishers
  server.addTool(creativeApprovalStatusTool(client)); // creative/approval_status
  server.addTool(creativeReviseTool(client)); // creative/revise

  // Asset Management (Reference-Based)
  server.addTool(assetsAddTool(client)); // assets/add

  // Format Discovery
  server.addTool(listCreativeFormatsTool(client)); // list_creative_formats

  // Campaign Creative Tools
  server.addTool(campaignAttachCreativeTool(client)); // campaign/attach_creative
  server.addTool(campaignListCreativesTool(client)); // campaign/list_creatives
};

// Export individual tools for testing
export {
  // Brand Agent measurement tools
  addMeasurementSourceTool,
  // Brand Agent inventory tools
  adjustInventoryAllocationTool,
  analyzeInventoryPerformanceTool,
  // Reporting tools
  analyzeTacticsTool,
  // Asset Management
  assetsAddTool,
  // Campaign Creative Tools
  campaignAttachCreativeTool,
  campaignListCreativesTool,
  // Original tools
  checkAuthTool,
  // Brand Agent campaign tools
  createBrandAgentCampaignTool,

  // Brand Agent creative tools
  createBrandAgentCreativeTool,
  createBrandAgentStandardsTool,
  createBrandAgentStoryTool,
  // Brand Agent core tools
  createBrandAgentTool,
  createCampaignTool,
  createInventoryOptionTool,
  // Brand Agent audience tools
  createSyntheticAudienceTool,
  creativeApprovalStatusTool,
  creativeAssignTool,
  // New Creative Management Tools
  creativeCreateTool,
  creativeListTool,
  creativeReviseTool,
  // Publisher Approval Workflow
  creativeSyncPublishersTool,
  creativeUnassignTool,
  creativeUpdateTool,
  deleteBrandAgentStandardsTool,
  deleteBrandAgentStoryTool,
  deleteBrandAgentTool,
  discoverPublisherProductsTool,
  exportCampaignDataTool,
  getAmpAgentsTool,
  getBrandAgentTool,
  getCampaignSummaryTool,
  listBrandAgentCampaignsTool,
  listBrandAgentCreativesTool,
  // Brand Agent standards tools
  listBrandAgentStandardsTool,
  listBrandAgentsTool,
  // Brand Agent stories tools
  listBrandAgentStoriesTool,
  // Format Discovery
  listCreativeFormatsTool,
  listInventoryOptionsTool,
  listMeasurementSourcesTool,
  listSyntheticAudiencesTool,
  registerWebhookTool,
  updateBrandAgentCampaignTool,
  updateBrandAgentCreativeTool,
  updateBrandAgentStandardsTool,
  updateBrandAgentStoryTool,
  updateBrandAgentTool,
  updateCampaignTool,
};
