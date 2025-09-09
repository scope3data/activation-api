import type { FastMCP } from "fastmcp";

import type { Scope3ApiClient } from "../client/scope3-client.js";

// Asset Management
import { assetsAddTool } from "./assets/add.js";
// Audiences
import { createSyntheticAudienceTool } from "./audiences/create.js";
import { listSyntheticAudiencesTool } from "./audiences/list.js";
// Authentication
import { checkAuthTool } from "./auth/check.js";
// Brand Agents (Core)
import { createBrandAgentTool } from "./brand-agents/core/create.js";
import { deleteBrandAgentTool } from "./brand-agents/core/delete.js";
import { getBrandAgentTool } from "./brand-agents/core/get.js";
import { listBrandAgentsTool } from "./brand-agents/core/list.js";
import { updateBrandAgentTool } from "./brand-agents/core/update.js";
// Brand Standards
import { createBrandAgentStandardsTool } from "./brand-standards/create.js";
import { deleteBrandAgentStandardsTool } from "./brand-standards/delete.js";
import { listBrandAgentStandardsTool } from "./brand-standards/list.js";
import { updateBrandAgentStandardsTool } from "./brand-standards/update.js";
// Brand Stories
import { createBrandAgentBrandStoryTool } from "./brand-stories/create.js";
import { deleteBrandAgentBrandStoryTool } from "./brand-stories/delete.js";
import { listBrandAgentBrandStoriesTool } from "./brand-stories/list.js";
import { updateBrandAgentBrandStoryTool } from "./brand-stories/update.js";
import { createCampaignLegacyTool } from "./campaigns/create-legacy.js";
// Campaigns
import { createCampaignTool } from "./campaigns/create.js";
import { deleteCampaignTool } from "./campaigns/delete.js";
import { exportCampaignDataTool } from "./campaigns/export-data.js";
import { getCampaignSummaryTool } from "./campaigns/get-summary.js";
import { campaignListCreativesTool } from "./campaigns/list-creatives.js";
import { listCampaignsTool } from "./campaigns/list.js";
import { updateCampaignTool } from "./campaigns/update.js";
// Creatives
import { creativeApprovalStatusTool } from "./creatives/approval-status.js";
import {
  creativeAssignTool,
  creativeUnassignTool,
} from "./creatives/assign.js";
import { creativeCreateTool } from "./creatives/create.js";
import { creativeDeleteTool } from "./creatives/delete.js";
import { creativeGetTool } from "./creatives/get.js";
import { creativeListTool } from "./creatives/list.js";
import { creativeReviseTool } from "./creatives/revise.js";
import { creativeSyncPublishersTool } from "./creatives/sync-publishers.js";
import { creativeUpdateTool } from "./creatives/update.js";
// DSP
import { getDSPSeatsTool } from "./dsp/get-seats.js";
import { discoverSalesAgentFormatsTool } from "./formats/discover-sales-agents.js";
// Formats
import { listCreativeFormatsTool } from "./formats/list.js";
// PMPs
import { createBrandAgentPMPTool } from "./pmps/create.js";
import { listBrandAgentPMPsTool } from "./pmps/list.js";
import { updateBrandAgentPMPTool } from "./pmps/update.js";
// Products
import { getProductsTool } from "./products/list.js";
// Reporting
import { analyzeTacticsTool } from "./reporting/analyze-tactics.js";
import { provideScoringOutcomesTool } from "./reporting/provide-outcomes.js";
// Signals
import { createCustomSignalTool } from "./signals/create.js";
import { deleteCustomSignalTool } from "./signals/delete.js";
import { getCustomSignalTool } from "./signals/get.js";
import { listCustomSignalsTool } from "./signals/list.js";
import { updateCustomSignalTool } from "./signals/update.js";
// Tactics
import { analyzeTacticPerformanceTool } from "./tactics/analyze-performance.js";
import { createTacticTool } from "./tactics/create.js";
import { discoverPublisherProductsTool } from "./tactics/discover-products.js";
import { listTacticsTool } from "./tactics/list.js";
// Webhooks
import { registerWebhookTool } from "./webhooks/register.js";

export const registerTools = (server: FastMCP, client: Scope3ApiClient) => {
  // Authentication
  server.addTool(checkAuthTool(client));

  // Brand Agents (Core)
  server.addTool(createBrandAgentTool(client));
  server.addTool(getBrandAgentTool(client));
  server.addTool(listBrandAgentsTool(client));
  server.addTool(updateBrandAgentTool(client));
  server.addTool(deleteBrandAgentTool(client));

  // Campaigns
  server.addTool(createCampaignTool(client)); // campaign/create
  server.addTool(getCampaignSummaryTool(client)); // campaign/get-summary
  server.addTool(listCampaignsTool(client)); // campaign/list
  server.addTool(updateCampaignTool(client)); // campaign/update
  server.addTool(deleteCampaignTool(client)); // campaign/delete
  server.addTool(exportCampaignDataTool(client)); // campaign/export-data
  server.addTool(campaignListCreativesTool(client)); // campaign/list-creatives
  server.addTool(createCampaignLegacyTool(client)); // campaign/create-legacy (backward compatibility)

  // Creatives
  server.addTool(creativeCreateTool(client)); // creative/create
  server.addTool(creativeGetTool(client)); // creative/get
  server.addTool(creativeListTool(client)); // creative/list
  server.addTool(creativeUpdateTool(client)); // creative/update
  server.addTool(creativeDeleteTool(client)); // creative/delete
  server.addTool(creativeAssignTool(client)); // creative/assign
  server.addTool(creativeUnassignTool(client)); // creative/unassign
  server.addTool(creativeApprovalStatusTool(client)); // creative/approval_status
  server.addTool(creativeReviseTool(client)); // creative/revise
  server.addTool(creativeSyncPublishersTool(client)); // creative/sync_publishers

  // Brand Stories (formerly Synthetic Audiences)
  server.addTool(createBrandAgentBrandStoryTool(client)); // brand-story/create
  server.addTool(listBrandAgentBrandStoriesTool(client)); // brand-story/list
  server.addTool(updateBrandAgentBrandStoryTool(client)); // brand-story/update
  server.addTool(deleteBrandAgentBrandStoryTool(client)); // brand-story/delete

  // Brand Standards
  server.addTool(createBrandAgentStandardsTool(client)); // brand-standards/create
  server.addTool(listBrandAgentStandardsTool(client)); // brand-standards/list
  server.addTool(updateBrandAgentStandardsTool(client)); // brand-standards/update
  server.addTool(deleteBrandAgentStandardsTool(client)); // brand-standards/delete

  // Audiences
  server.addTool(createSyntheticAudienceTool(client)); // audience/create
  server.addTool(listSyntheticAudiencesTool(client)); // audience/list

  // Tactics (budget allocation merged into campaign/update)
  server.addTool(createTacticTool(client)); // tactic/create
  server.addTool(listTacticsTool(client)); // tactic/list
  server.addTool(analyzeTacticPerformanceTool(client)); // tactic/analyze-performance
  server.addTool(discoverPublisherProductsTool(client)); // tactic/discover-products

  // PMPs
  server.addTool(createBrandAgentPMPTool(client)); // pmp/create
  server.addTool(listBrandAgentPMPsTool(client)); // pmp/list
  server.addTool(updateBrandAgentPMPTool(client)); // pmp/update

  // Signals
  server.addTool(createCustomSignalTool(client)); // signal/create
  server.addTool(getCustomSignalTool(client)); // signal/get
  server.addTool(listCustomSignalsTool(client)); // signal/list
  server.addTool(updateCustomSignalTool(client)); // signal/update
  server.addTool(deleteCustomSignalTool(client)); // signal/delete

  // Reporting
  server.addTool(analyzeTacticsTool(client)); // reporting/analyze-tactics
  server.addTool(provideScoringOutcomesTool(client)); // reporting/provide-outcomes

  // Webhooks
  server.addTool(registerWebhookTool(client)); // webhook/register

  // Formats
  server.addTool(listCreativeFormatsTool(client)); // format/list
  server.addTool(discoverSalesAgentFormatsTool(client)); // format/discover-sales-agents

  // Products
  server.addTool(getProductsTool()); // product/list

  // DSP
  server.addTool(getDSPSeatsTool(client)); // dsp/get-seats

  // Assets
  server.addTool(assetsAddTool(client)); // assets/add
};

// Export individual tools for testing
export {
  // Tactics
  analyzeTacticPerformanceTool,
  // Reporting
  analyzeTacticsTool,
  // Asset Management
  assetsAddTool,
  // Campaigns
  campaignListCreativesTool,
  // Authentication
  checkAuthTool,
  // Brand Stories
  createBrandAgentBrandStoryTool,
  // PMPs
  createBrandAgentPMPTool,
  // Brand Standards
  createBrandAgentStandardsTool,
  // Brand Agents (Core)
  createBrandAgentTool,
  createCampaignLegacyTool,
  createCampaignTool,
  // Signals
  createCustomSignalTool,
  // Audiences
  createSyntheticAudienceTool,
  createTacticTool,
  // Creatives
  creativeApprovalStatusTool,
  creativeAssignTool,
  creativeCreateTool,
  creativeDeleteTool,
  creativeGetTool,
  creativeListTool,
  creativeReviseTool,
  creativeSyncPublishersTool,
  creativeUnassignTool,
  creativeUpdateTool,
  deleteBrandAgentBrandStoryTool,
  deleteBrandAgentStandardsTool,
  deleteBrandAgentTool,
  // Campaign CRUD
  deleteCampaignTool,
  deleteCustomSignalTool,
  discoverPublisherProductsTool,
  // Formats
  discoverSalesAgentFormatsTool,
  exportCampaignDataTool,
  getBrandAgentTool,
  getCampaignSummaryTool,
  getCustomSignalTool,
  // DSP
  getDSPSeatsTool,
  // Products
  getProductsTool,
  listBrandAgentBrandStoriesTool,
  listBrandAgentPMPsTool,
  listBrandAgentStandardsTool,
  listBrandAgentsTool,
  listCampaignsTool,
  listCreativeFormatsTool,
  listCustomSignalsTool,
  listSyntheticAudiencesTool,
  listTacticsTool,
  provideScoringOutcomesTool,
  // Webhooks
  registerWebhookTool,
  updateBrandAgentBrandStoryTool,
  updateBrandAgentPMPTool,
  updateBrandAgentStandardsTool,
  updateBrandAgentTool,
  updateCampaignTool,
  updateCustomSignalTool,
};
