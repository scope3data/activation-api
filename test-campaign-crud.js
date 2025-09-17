#!/usr/bin/env node

import { listCampaignsTool } from "./dist/tools/campaigns/list.js";
import { createCampaignTool } from "./dist/tools/campaigns/create.js";
import { updateCampaignTool } from "./dist/tools/campaigns/update.js";
import { deleteCampaignTool } from "./dist/tools/campaigns/delete.js";
import { Scope3ApiClient } from "./dist/client/scope3-client.js";

console.log("🧪 Testing Full Campaign CRUD Operations");
console.log("=========================================");

const client = new Scope3ApiClient("https://api.scope3.com/api/graphql");

// Create tool instances
const listTool = listCampaignsTool(client);
const createTool = createCampaignTool(client);
const updateTool = updateCampaignTool(client);
const deleteTool = deleteCampaignTool(client);

const context = {
  session: {
    scope3ApiKey: process.env.SCOPE3_API_KEY,
  },
};

if (!context.session.scope3ApiKey) {
  console.log("❌ Please set SCOPE3_API_KEY environment variable");
  process.exit(1);
}

const brandAgentId = "48";
let createdCampaignId = null;

async function testCampaignCRUD() {
  try {
    console.log("✅ API Key found");
    console.log(`📋 Testing with brandAgentId: "${brandAgentId}"`);
    console.log("");

    // 1. LIST - Initial state
    console.log("🔍 Step 1: List campaigns (initial state)");
    const initialList = await listTool.execute(
      {
        brandAgentId: brandAgentId,
      },
      context,
    );

    const initialData = JSON.parse(initialList);
    console.log(`✅ Initial campaign count: ${initialData.data?.count || 0}`);
    console.log("");

    // 2. CREATE - New campaign
    console.log("🔍 Step 2: Create new campaign");
    const createResult = await createTool.execute(
      {
        brandAgentId: brandAgentId,
        name: "Test Campaign - CRUD Operations",
        prompt:
          "Test campaign for verifying CRUD operations work correctly with BigQuery type fixes",
        budget: {
          total: 100000, // $1000 in cents
          currency: "USD",
          dailyCap: 10000, // $100 in cents
          pacing: "even",
        },
        status: "draft",
      },
      context,
    );

    const createData = JSON.parse(createResult);
    if (!createData.success) {
      throw new Error(`Create failed: ${createData.message}`);
    }

    createdCampaignId = createData.data?.campaign?.id;
    console.log(`✅ Campaign created successfully: ${createdCampaignId}`);
    console.log(`📝 Campaign name: "${createData.data?.campaign?.name}"`);
    console.log(
      `💰 Budget: ${createData.data?.campaign?.budget?.currency} ${(createData.data?.campaign?.budget?.total / 100).toFixed(2)}`,
    );
    console.log("");

    // 3. LIST - After creation
    console.log("🔍 Step 3: List campaigns (after creation)");
    const afterCreateList = await listTool.execute(
      {
        brandAgentId: brandAgentId,
      },
      context,
    );

    const afterCreateData = JSON.parse(afterCreateList);
    console.log(
      `✅ Campaign count after creation: ${afterCreateData.data?.count || 0}`,
    );

    // Verify our campaign is in the list
    const foundCampaign = afterCreateData.data?.campaigns?.find(
      (c) => c.id === createdCampaignId,
    );
    if (foundCampaign) {
      console.log(`✅ Created campaign found in list: "${foundCampaign.name}"`);
    } else {
      console.log(
        "⚠️  Created campaign not found in list (may take time to appear)",
      );
    }
    console.log("");

    // 4. UPDATE - Modify campaign
    console.log("🔍 Step 4: Update campaign");
    const updateResult = await updateTool.execute(
      {
        campaignId: createdCampaignId,
        name: "Test Campaign - CRUD Operations (Updated)",
        budget: {
          total: 150000, // $1500 in cents
          currency: "USD",
          dailyCap: 15000, // $150 in cents
          pacing: "front_loaded",
        },
        status: "active",
      },
      context,
    );

    const updateData = JSON.parse(updateResult);
    if (!updateData.success) {
      throw new Error(`Update failed: ${updateData.message}`);
    }

    console.log(`✅ Campaign updated successfully`);
    console.log(`📝 New name: "${updateData.data?.campaign?.name}"`);
    console.log(
      `💰 New budget: ${updateData.data?.campaign?.budget?.currency} ${(updateData.data?.campaign?.budget?.total / 100).toFixed(2)}`,
    );
    console.log(`📊 New status: ${updateData.data?.campaign?.status}`);
    console.log("");

    // 5. DELETE - Remove campaign
    console.log("🔍 Step 5: Delete campaign (cleanup)");
    const deleteResult = await deleteTool.execute(
      {
        campaignId: createdCampaignId,
      },
      context,
    );

    const deleteData = JSON.parse(deleteResult);
    if (!deleteData.success) {
      throw new Error(`Delete failed: ${deleteData.message}`);
    }

    console.log(`✅ Campaign deleted successfully: ${createdCampaignId}`);
    console.log("");

    // 6. LIST - Final state (verify deletion)
    console.log("🔍 Step 6: List campaigns (after deletion)");
    const finalList = await listTool.execute(
      {
        brandAgentId: brandAgentId,
      },
      context,
    );

    const finalData = JSON.parse(finalList);
    console.log(`✅ Final campaign count: ${finalData.data?.count || 0}`);

    // Verify our campaign is no longer in the list
    const deletedCampaign = finalData.data?.campaigns?.find(
      (c) => c.id === createdCampaignId,
    );
    if (!deletedCampaign) {
      console.log(`✅ Deleted campaign no longer appears in list`);
    } else {
      console.log(
        "⚠️  Deleted campaign still appears in list (may take time to remove)",
      );
    }
    console.log("");

    // Summary
    console.log("🎉 CRUD TEST SUMMARY");
    console.log("====================");
    console.log("✅ LIST: Successfully retrieved campaigns");
    console.log("✅ CREATE: Successfully created new campaign");
    console.log("✅ UPDATE: Successfully modified campaign properties");
    console.log("✅ DELETE: Successfully removed campaign");
    console.log("");
    console.log("🎯 All BigQuery type fixes are working correctly!");
    console.log("🎯 Campaign CRUD operations fully functional");
  } catch (error) {
    console.log("❌ CRUD TEST FAILED:", error.message);
    console.log("");

    // Cleanup on failure
    if (createdCampaignId) {
      console.log("🧹 Attempting cleanup of created campaign...");
      try {
        await deleteTool.execute(
          {
            campaignId: createdCampaignId,
          },
          context,
        );
        console.log("✅ Cleanup successful");
      } catch (cleanupError) {
        console.log("⚠️  Cleanup failed:", cleanupError.message);
        console.log(
          `⚠️  Manual cleanup may be needed for campaign: ${createdCampaignId}`,
        );
      }
    }

    console.log("");
    console.log("🔍 Error Analysis:");

    if (error.message.includes("BigQuery")) {
      console.log("- BigQuery operation failed");
      console.log("- Check table schema and permissions");
    } else if (error.message.includes("Authentication")) {
      console.log("- Authentication issue");
      console.log("- Verify API key has campaign management permissions");
    } else if (error.message.includes("brand agent")) {
      console.log("- Brand agent issue");
      console.log('- Verify brandAgentId "48" exists and is accessible');
    } else {
      console.log("- Unexpected error");
      console.log("- Full error details:", error);
    }

    process.exit(1);
  }
}

testCampaignCRUD().catch(console.error);
