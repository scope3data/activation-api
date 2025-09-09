import type { FastMCP } from "fastmcp";

import type { Scope3ApiClient } from "../client/scope3-client.js";

// New Creative Management Tools (MCP Orchestration)
import { assetsAddTool } from "./assets/add.js";
import { checkAuthTool } from "./auth/check-auth.js";
// Brand Agent brand story tools
import { createBrandAgentBrandStoryTool } from "./brand-agents/brand-stories/create-brand-agent-brand-story.js";
import { deleteBrandAgentBrandStoryTool } from "./brand-agents/brand-stories/delete-brand-agent-brand-story.js";
import { listBrandAgentBrandStoriesTool } from "./brand-agents/brand-stories/list-brand-agent-brand-stories.js";
import { updateBrandAgentBrandStoryTool } from "./brand-agents/brand-stories/update-brand-agent-brand-story.js";
// Brand Agent campaign tools
import { createBrandAgentCampaignTool } from "./brand-agents/campaigns/create-brand-agent-campaign.js";
// Brand Agent core tools
import { createBrandAgentTool } from "./brand-agents/core/create-brand-agent.js";
import { deleteBrandAgentTool } from "./brand-agents/core/delete-brand-agent.js";
import { getBrandAgentTool } from "./brand-agents/core/get-brand-agent.js";
import { listBrandAgentsTool } from "./brand-agents/core/list-brand-agents.js";
import { updateBrandAgentTool } from "./brand-agents/core/update-brand-agent.js";
// Brand Agent standards tools
import { createBrandAgentStandardsTool } from "./brand-agents/standards/create-brand-agent-standards.js";
import { deleteBrandAgentStandardsTool } from "./brand-agents/standards/delete-brand-agent-standards.js";
import { listBrandAgentStandardsTool } from "./brand-agents/standards/list-brand-agent-standards.js";
import { updateBrandAgentStandardsTool } from "./brand-agents/standards/update-brand-agent-standards.js";
// Brand Agent tactic tools
import { adjustTacticAllocationTool } from "./brand-agents/tactics/adjust-tactic-allocation.js";
import { analyzeTacticPerformanceTool } from "./brand-agents/tactics/analyze-tactic-performance.js";
import { createTacticTool } from "./brand-agents/tactics/create-tactic.js";
import { discoverPublisherProductsTool } from "./brand-agents/tactics/discover-publisher-products.js";
import { listTacticsTool } from "./brand-agents/tactics/list-tactics.js";
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
// PMP tools
import { createBrandAgentPMPTool } from "./pmps/create-pmp.js";
import { getDSPSeatsTool } from "./pmps/get-dsp-seats.js";
import { listBrandAgentPMPsTool } from "./pmps/list-pmps.js";
import { updateBrandAgentPMPTool } from "./pmps/update-pmp.js";
// Product discovery tools
import { getProductsTool } from "./products/get-products.js";
// Reporting tools
import { analyzeTacticsTool } from "./reporting/analyze-tactics.js";
import { exportCampaignDataTool } from "./reporting/export-campaign-data.js";
import { getCampaignSummaryTool } from "./reporting/get-campaign-summary.js";
import { provideScoringOutcomesTool } from "./reporting/provide-scoring-outcomes.js";
import { registerWebhookTool } from "./reporting/register-webhook.js";
// Custom Signal tools
import { createCustomSignalTool } from "./signals/create-custom-signal.js";
import { deleteCustomSignalTool } from "./signals/delete-custom-signal.js";
import { getCustomSignalTool } from "./signals/get-custom-signal.js";
import { listCustomSignalsTool } from "./signals/list-custom-signals.js";
import { updateCustomSignalTool } from "./signals/update-custom-signal.js";

export const registerTools = (server: FastMCP, client: Scope3ApiClient) => {
  // Authentication and existing agent tools
  server.addTool(checkAuthTool(client));

  // Original campaign tools (kept for backward compatibility)
  server.addTool(createCampaignTool(client));
  server.addTool(updateCampaignTool(client));

  // Brand Agent core tools
  server.addTool(createBrandAgentTool(client));
  server.addTool(updateBrandAgentTool(client));
  server.addTool(deleteBrandAgentTool(client));
  server.addTool(getBrandAgentTool(client));
  server.addTool(listBrandAgentsTool(client));

  // Brand Agent tactic tools
  server.addTool(discoverPublisherProductsTool(client));
  server.addTool(createTacticTool(client));
  server.addTool(listTacticsTool(client));
  server.addTool(adjustTacticAllocationTool(client));
  server.addTool(analyzeTacticPerformanceTool(client));

  // Brand Agent standards tools
  server.addTool(listBrandAgentStandardsTool(client));
  server.addTool(createBrandAgentStandardsTool(client));
  server.addTool(updateBrandAgentStandardsTool(client));
  server.addTool(deleteBrandAgentStandardsTool(client));

  // Brand Agent brand story tools
  server.addTool(listBrandAgentBrandStoriesTool(client));
  server.addTool(createBrandAgentBrandStoryTool(client));
  server.addTool(updateBrandAgentBrandStoryTool(client));
  server.addTool(deleteBrandAgentBrandStoryTool(client));

  // Brand Agent campaign tools
  server.addTool(createBrandAgentCampaignTool(client)); // create_brand_agent_campaign

  // Reporting tools
  server.addTool(getCampaignSummaryTool(client));
  server.addTool(exportCampaignDataTool(client));
  server.addTool(registerWebhookTool(client));
  server.addTool(analyzeTacticsTool(client));
  server.addTool(provideScoringOutcomesTool(client));

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

  server.addTool(campaignListCreativesTool(client)); // campaign/list_creatives

  // PMP tools
  server.addTool(getDSPSeatsTool(client)); // get_dsp_seats
  server.addTool(createBrandAgentPMPTool(client)); // create_brand_agent_pmp
  server.addTool(updateBrandAgentPMPTool(client)); // update_brand_agent_pmp
  server.addTool(listBrandAgentPMPsTool(client)); // list_brand_agent_pmps

  // Custom Signal tools
  server.addTool(createCustomSignalTool(client)); // create_custom_signal
  server.addTool(listCustomSignalsTool(client)); // list_custom_signals
  server.addTool(getCustomSignalTool(client)); // get_custom_signal
  server.addTool(updateCustomSignalTool(client)); // update_custom_signal
  server.addTool(deleteCustomSignalTool(client)); // delete_custom_signal

  // Product discovery tools
  server.addTool(getProductsTool()); // get_products - calls multiple sales agents via MCP
};

// Export individual tools for testing
export {
  // Brand Agent tactic tools
  adjustTacticAllocationTool,
  analyzeTacticPerformanceTool,
  // Reporting tools
  analyzeTacticsTool,
  // Asset Management
  assetsAddTool,
  campaignListCreativesTool,
  // Original tools
  checkAuthTool,
  createBrandAgentBrandStoryTool,
  // Brand Agent campaign tools
  createBrandAgentCampaignTool,

  // PMP tools
  createBrandAgentPMPTool,
  createBrandAgentStandardsTool,
  // Brand Agent core tools
  createBrandAgentTool,
  createCampaignTool,
  createTacticTool,
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
  deleteBrandAgentBrandStoryTool,
  deleteBrandAgentStandardsTool,
  deleteBrandAgentTool,
  deleteCustomSignalTool,
  discoverPublisherProductsTool,
  exportCampaignDataTool,
  getBrandAgentTool,
  getCampaignSummaryTool,
  getCustomSignalTool,
  getDSPSeatsTool,
  // Product discovery tools
  getProductsTool,
  // Brand Agent synthetic audience tools
  listBrandAgentBrandStoriesTool,
  listBrandAgentPMPsTool,
  // Brand Agent standards tools
  listBrandAgentStandardsTool,
  listBrandAgentsTool,
  // Format Discovery
  listCreativeFormatsTool,
  listTacticsTool,
  provideScoringOutcomesTool,
  registerWebhookTool,
  updateBrandAgentBrandStoryTool,
  updateBrandAgentPMPTool,
  updateBrandAgentStandardsTool,
  updateBrandAgentTool,
  updateCampaignTool,
  updateCustomSignalTool,
};
