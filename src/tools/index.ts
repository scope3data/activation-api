import type { FastMCP } from "fastmcp";

import type { Scope3ApiClient } from "../client/scope3-client.js";

// Audiences
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
import { getCampaignSummaryTool } from "./campaigns/get-summary.js";
import { listCampaignsTool } from "./campaigns/list.js";
import { updateCampaignTool } from "./campaigns/update.js";
// Creatives
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
// Formats
import { listCreativeFormatsTool } from "./formats/list.js";
// PMPs
import { createPMPTool } from "./pmps/create.js";
import { listPMPsTool } from "./pmps/list.js";
import { updatePMPTool } from "./pmps/update.js";
// Products
import { getProductsTool } from "./products/list.js";
import { exportDataTool } from "./reporting/export-data.js";
// Reporting
import { provideScoringOutcomesTool } from "./reporting/provide-outcomes.js";
// Signals Agents
import { activateSignalTool } from "./signals-agents/activate.js";
import { getSignalsTool } from "./signals-agents/get-signals.js";
import { getSignalsAgentTool } from "./signals-agents/get.js";
import { getSignalsAgentHistoryTool } from "./signals-agents/history.js";
import { listSignalsAgentsTool } from "./signals-agents/list.js";
import { registerSignalsAgentTool } from "./signals-agents/register.js";
import { unregisterSignalsAgentTool } from "./signals-agents/unregister.js";
import { updateSignalsAgentTool } from "./signals-agents/update.js";
// Signals
import { createCustomSignalTool } from "./signals/create.js";
import { deleteCustomSignalTool } from "./signals/delete.js";
import { getPartnerSeatsTool } from "./signals/get-partner-seats.js";
import { getCustomSignalTool } from "./signals/get.js";
import { listCustomSignalsTool } from "./signals/list.js";
import { updateCustomSignalTool } from "./signals/update.js";
// Tactics
import { createTacticTool } from "./tactics/create.js";
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
  server.addTool(createCampaignLegacyTool(client)); // campaign/create-legacy (backward compatibility)

  // Creatives
  server.addTool(creativeCreateTool(client)); // creative/create
  server.addTool(creativeGetTool(client)); // creative/get
  server.addTool(creativeListTool(client)); // creative/list
  server.addTool(creativeUpdateTool(client)); // creative/update
  server.addTool(creativeDeleteTool(client)); // creative/delete
  server.addTool(creativeAssignTool(client)); // creative/assign
  server.addTool(creativeUnassignTool(client)); // creative/unassign
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

  // Tactics (budget allocation merged into campaign/update)
  server.addTool(createTacticTool(client)); // tactic/create
  server.addTool(listTacticsTool(client)); // tactic/list

  // PMPs
  server.addTool(createPMPTool(client)); // pmp/create
  server.addTool(listPMPsTool(client)); // pmp/list
  server.addTool(updatePMPTool(client)); // pmp/update

  // Signals
  server.addTool(createCustomSignalTool(client)); // signal/create
  server.addTool(getCustomSignalTool(client)); // signal/get
  server.addTool(listCustomSignalsTool(client)); // signal/list
  server.addTool(updateCustomSignalTool(client)); // signal/update
  server.addTool(deleteCustomSignalTool(client)); // signal/delete
  server.addTool(getPartnerSeatsTool(client)); // signals/get-partner-seats

  // Signals Agents
  server.addTool(registerSignalsAgentTool(client)); // signals-agent/register
  server.addTool(listSignalsAgentsTool(client)); // signals-agent/list
  server.addTool(getSignalsAgentTool(client)); // signals-agent/get
  server.addTool(updateSignalsAgentTool(client)); // signals-agent/update
  server.addTool(unregisterSignalsAgentTool(client)); // signals-agent/unregister
  server.addTool(getSignalsTool(client)); // signals-agent/get-signals
  server.addTool(activateSignalTool(client)); // signals-agent/activate
  server.addTool(getSignalsAgentHistoryTool(client)); // signals-agent/history

  // Reporting
  server.addTool(provideScoringOutcomesTool(client)); // reporting/provide-outcomes
  server.addTool(exportDataTool(client)); // reporting/export-data

  // Webhooks
  server.addTool(registerWebhookTool(client)); // webhook/register

  // Formats
  server.addTool(listCreativeFormatsTool(client)); // format/list

  // Products
  server.addTool(getProductsTool()); // product/list

  // DSP
  server.addTool(getDSPSeatsTool(client)); // dsp/get-seats

  // Assets
};

// Export individual tools for testing
export {
  activateSignalTool,
  // Asset Management
  // Campaigns
  // Authentication
  checkAuthTool,
  // Brand Stories
  createBrandAgentBrandStoryTool,
  // Brand Standards
  createBrandAgentStandardsTool,
  // Brand Agents (Core)
  createBrandAgentTool,
  createCampaignLegacyTool,
  createCampaignTool,
  // Signals
  createCustomSignalTool,
  // PMPs
  createPMPTool,
  // Audiences
  createTacticTool,
  // Creatives
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
  exportDataTool,
  getBrandAgentTool,
  getCampaignSummaryTool,
  getCustomSignalTool,
  // DSP
  getDSPSeatsTool,
  getPartnerSeatsTool,
  // Products
  getProductsTool,
  getSignalsAgentHistoryTool,
  getSignalsAgentTool,
  getSignalsTool,
  listBrandAgentBrandStoriesTool,
  listBrandAgentStandardsTool,
  listBrandAgentsTool,
  listCampaignsTool,
  listCreativeFormatsTool,
  listCustomSignalsTool,
  listPMPsTool,
  listSignalsAgentsTool,
  listTacticsTool,
  provideScoringOutcomesTool,
  // Signals Agents
  registerSignalsAgentTool,
  // Webhooks
  registerWebhookTool,
  unregisterSignalsAgentTool,
  updateBrandAgentBrandStoryTool,
  updateBrandAgentStandardsTool,
  updateBrandAgentTool,
  updateCampaignTool,
  updateCustomSignalTool,
  updatePMPTool,
  updateSignalsAgentTool,
};
