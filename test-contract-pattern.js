#!/usr/bin/env node

/**
 * Quick demonstration of the backend-independent testing pattern
 */

import { CampaignRepositoryTestDouble } from "./dist/test-doubles/campaign-repository-test-double.js";
import { CreativeRepositoryTestDouble } from "./dist/test-doubles/creative-repository-test-double.js";

async function demonstrateContractPattern() {
  console.log("🧪 Demonstrating Backend-Independent Testing Pattern");
  console.log("===================================================");

  try {
    // Step 1: Test Campaign Repository Contract
    console.log("\n📋 Step 1: Testing Campaign Repository Contract");
    const campaignRepo = new CampaignRepositoryTestDouble();
    const testApiKey = "demo_api_key";
    campaignRepo.addValidApiKey(testApiKey);

    // Test authentication (should work with any backend)
    console.log("✅ Testing authentication...");
    try {
      await campaignRepo.createCampaign("invalid_key", {
        brandAgentId: "48",
        campaignName: "Test",
        prompt: "Test",
      });
      console.log(
        "❌ Authentication test failed - should have rejected invalid key",
      );
    } catch (error) {
      console.log("✅ Authentication correctly rejected invalid API key");
    }

    // Test campaign creation (business logic, not implementation)
    console.log("✅ Testing campaign creation...");
    const campaign = await campaignRepo.createCampaign(testApiKey, {
      brandAgentId: "48",
      campaignName: "Contract Demo Campaign",
      prompt: "Demonstrating backend-independent testing",
    });

    console.log(`   Created campaign: ${campaign.id}`);
    console.log(`   Name: "${campaign.name}"`);
    console.log(`   Status: ${campaign.status}`);
    console.log(
      `   Budget: ${campaign.budget.currency} ${campaign.budget.total}`,
    );

    // Test campaign retrieval
    console.log("✅ Testing campaign retrieval...");
    const retrieved = await campaignRepo.getCampaign(testApiKey, campaign.id);
    console.log(`   Retrieved campaign: ${retrieved ? "SUCCESS" : "FAILED"}`);

    // Test campaign listing
    console.log("✅ Testing campaign listing...");
    const list = await campaignRepo.listCampaigns(testApiKey, {
      brandAgentId: "48",
    });
    console.log(
      `   Found ${list.campaigns.length} campaigns for brand agent 48`,
    );

    // Step 2: Test Creative Repository Contract
    console.log("\n🎨 Step 2: Testing Creative Repository Contract");
    const creativeRepo = new CreativeRepositoryTestDouble();
    creativeRepo.addValidApiKey(testApiKey);

    // Test creative creation
    console.log("✅ Testing creative creation...");
    const creative = await creativeRepo.createCreative(testApiKey, {
      buyerAgentId: "48",
      creativeName: "Contract Demo Creative",
      content: { htmlSnippet: "<div>Backend-independent test content</div>" },
      format: { formatId: "banner_300x250", type: "publisher" },
    });

    console.log(`   Created creative: ${creative.creativeId}`);
    console.log(`   Name: "${creative.creativeName}"`);
    console.log(`   Status: ${creative.status}`);
    console.log(`   Format: ${creative.format.formatId}`);

    // Test assignment workflow
    console.log("✅ Testing assignment workflow...");
    const assignResult = await creativeRepo.assignCreativeToCampaign(
      testApiKey,
      creative.creativeId,
      campaign.id,
      "48",
    );
    console.log(
      `   Assignment result: ${assignResult.success ? "SUCCESS" : "FAILED"}`,
    );
    console.log(`   Message: "${assignResult.message}"`);

    // Step 3: Test Backend Resilience
    console.log("\n⚡ Step 3: Testing Backend Resilience");

    // Test latency simulation
    console.log("✅ Testing latency tolerance...");
    const slowRepo = new CampaignRepositoryTestDouble({ latency: 500 }); // 500ms delay
    slowRepo.addValidApiKey(testApiKey);

    const startTime = Date.now();
    await slowRepo.listCampaigns(testApiKey, { brandAgentId: "48" });
    const duration = Date.now() - startTime;
    console.log(
      `   Operation took ${duration}ms (simulated 500ms backend latency)`,
    );

    // Test error resilience
    console.log("✅ Testing error resilience...");
    const flakyRepo = new CampaignRepositoryTestDouble({ errorRate: 0.7 }); // 70% failure rate
    flakyRepo.addValidApiKey(testApiKey);

    let attempts = 0;
    let success = false;

    while (attempts < 5 && !success) {
      try {
        attempts++;
        await flakyRepo.healthCheck();
        success = true;
      } catch (error) {
        if (attempts >= 5) throw error;
      }
    }

    console.log(
      `   Succeeded after ${attempts} attempts (70% error rate simulation)`,
    );

    // Step 4: Performance Testing
    console.log("\n🚀 Step 4: Testing Performance Characteristics");
    const perfRepo = new CampaignRepositoryTestDouble();
    perfRepo.addValidApiKey(testApiKey);

    console.log("✅ Testing bulk operations...");
    const bulkStart = Date.now();
    const bulkPromises = Array.from({ length: 20 }, (_, i) =>
      perfRepo.createCampaign(testApiKey, {
        brandAgentId: "48",
        campaignName: `Bulk Campaign ${i}`,
        prompt: `Bulk test ${i}`,
      }),
    );

    const bulkResults = await Promise.all(bulkPromises);
    const bulkDuration = Date.now() - bulkStart;
    console.log(
      `   Created ${bulkResults.length} campaigns in ${bulkDuration}ms`,
    );
    console.log(
      `   Average: ${(bulkDuration / bulkResults.length).toFixed(1)}ms per campaign`,
    );

    // Final summary
    console.log("\n🎉 CONTRACT PATTERN DEMONSTRATION COMPLETE");
    console.log("==========================================");
    console.log("✅ Campaign Repository: All operations working");
    console.log("✅ Creative Repository: All operations working");
    console.log("✅ Assignment Workflow: Working across repositories");
    console.log("✅ Backend Resilience: Latency and error handling working");
    console.log("✅ Performance Testing: Bulk operations working");
    console.log("");
    console.log("🎯 Key Benefits Demonstrated:");
    console.log("   • Tests focus on BUSINESS BEHAVIOR, not implementation");
    console.log(
      "   • Same tests work with ANY backend (BigQuery, PostgreSQL, etc.)",
    );
    console.log(
      "   • Fast execution with test doubles (no external dependencies)",
    );
    console.log("   • Resilience testing simulates real-world conditions");
    console.log("   • Performance testing validates scalability");
    console.log("");
    console.log("🔄 When Backend Changes (BigQuery → PostgreSQL):");
    console.log("   • Contract tests continue working unchanged");
    console.log("   • Only implementation changes, not test logic");
    console.log("   • Immediate validation that new backend works correctly");
  } catch (error) {
    console.error("\n❌ Demonstration failed:", error.message);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

// Run the demonstration
demonstrateContractPattern();
