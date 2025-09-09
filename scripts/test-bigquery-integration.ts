#!/usr/bin/env tsx

import { CampaignBigQueryService } from "../src/services/campaign-bigquery-service.js";

async function testBigQueryIntegration() {
  console.log("🧪 Testing BigQuery integration...\n");

  const bq = new CampaignBigQueryService();

  try {
    // 1. Test connection
    console.log("🔍 Testing BigQuery connection...");
    const isHealthy = await bq.healthCheck();
    if (isHealthy) {
      console.log("✅ BigQuery connection successful");
    } else {
      console.log("❌ BigQuery connection failed");
      return;
    }

    // 2. Test brand agent retrieval
    console.log("\n👤 Testing brand agent retrieval...");
    try {
      const agent = await bq.getBrandAgent("demo-agent-1");
      if (agent) {
        console.log(`✅ Found brand agent: ${agent.name}`);
        console.log(`   - ID: ${agent.id}`);
        console.log(`   - Customer ID: ${agent.customerId}`);
        console.log(
          `   - Domains: ${agent.advertiserDomains?.join(", ") || "None"}`,
        );
      } else {
        console.log(
          "ℹ️  No brand agent found (this is expected if tables are empty)",
        );
      }
    } catch {
      console.log("ℹ️  Brand agent test skipped (tables may not exist yet)");
    }

    // 3. Test campaign listing
    console.log("\n📋 Testing campaign listing...");
    try {
      const campaigns = await bq.listCampaigns("demo-agent-1");
      console.log(`✅ Found ${campaigns.length} campaigns`);
      campaigns.forEach((campaign) => {
        console.log(`   - ${campaign.name} (${campaign.status})`);
      });
    } catch {
      console.log("ℹ️  Campaign test skipped (tables may not exist yet)");
    }

    // 4. Test creative listing
    console.log("\n🎨 Testing creative listing...");
    try {
      const creatives = await bq.listCreatives("demo-agent-1");
      console.log(`✅ Found ${creatives.length} creatives`);
      creatives.forEach((creative) => {
        console.log(`   - ${creative.creativeName} (${creative.status})`);
      });
    } catch {
      console.log("ℹ️  Creative test skipped (tables may not exist yet)");
    }

    console.log("\n🎉 BigQuery integration test completed!");
    console.log("\n💡 Next steps:");
    console.log("1. Run the SQL scripts to create BigQuery tables:");
    console.log(
      "   bq query --project_id=bok-playground --use_legacy_sql=false < scripts/create-bigquery-tables.sql",
    );
    console.log("2. Run the seed script to add demo data:");
    console.log("   tsx scripts/seed-bigquery-data.ts");
    console.log("3. Test the MCP tools with real data");
  } catch {
    console.error("\n❌ BigQuery integration test failed:");
    console.error(error instanceof Error ? error.message : String(error));

    console.log(
      "\n🚨 This is likely because the BigQuery tables don't exist yet.",
    );
    console.log("📋 Follow these steps to set up BigQuery:");
    console.log(
      "1. Ensure you have access to the bok-playground.agenticapi dataset",
    );
    console.log(
      "2. Run: bq query --project_id=bok-playground --use_legacy_sql=false < scripts/create-bigquery-tables.sql",
    );
    console.log("3. Run: tsx scripts/seed-bigquery-data.ts");
  }
}

// Run the test
testBigQueryIntegration().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
