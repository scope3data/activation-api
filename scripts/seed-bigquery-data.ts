#!/usr/bin/env tsx

import { CampaignBigQueryService } from "../src/services/campaign-bigquery-service.js";

async function seedBigQueryData() {
  console.log("🌱 Seeding BigQuery with demo data...\n");

  const bq = new CampaignBigQueryService();

  try {
    // Test connection first
    console.log("🔍 Testing BigQuery connection...");
    const isHealthy = await bq.healthCheck();
    if (!isHealthy) {
      throw new Error("BigQuery connection failed");
    }
    console.log("✅ BigQuery connection successful\n");

    // 1. Create brand agent extensions
    console.log("👤 Creating brand agent extensions...");

    // Demo agents - these should correspond to existing agents in your public_agent table
    const demoAgents = [
      {
        advertiserDomains: ["acme.com", "acme-store.com"],
        description: "Leading manufacturer of quality products and services",
        dspSeats: ["ttd_12345", "google_67890"],
        id: "demo-agent-1",
        name: "ACME Corporation",
      },
      {
        advertiserDomains: ["nike.com"],
        description: "Premium athletic wear and sports equipment",
        dspSeats: ["amazon_dsp_nike", "dv360_nike"],
        id: "demo-agent-2",
        name: "Nike Athletic",
      },
      {
        advertiserDomains: ["techstart.io", "techstart-app.com"],
        description: "Innovative technology startup focused on AI solutions",
        dspSeats: ["thetradedesk_tech"],
        id: "demo-agent-3",
        name: "TechStart Inc",
      },
    ];

    for (const agent of demoAgents) {
      await bq.upsertBrandAgentExtension(agent.id, {
        advertiserDomains: agent.advertiserDomains,
        description: agent.description,
        dspSeats: agent.dspSeats,
      });
      console.log(`  ✅ Created extension for ${agent.name}`);
    }

    console.log("");

    // 2. Create demo campaigns
    console.log("📋 Creating demo campaigns...");

    const campaignData = [
      {
        brandAgentId: "demo-agent-1",
        budgetCurrency: "USD",
        budgetDailyCap: 2000,
        budgetPacing: "even",
        budgetTotal: 50000,
        name: "ACME Q4 Holiday Sale",
        prompt:
          "Drive holiday sales with 25% discount promotion targeting families and gift buyers",
        scoringWeights: { affinity: 0.4, outcome: 0.3, quality: 0.3 },
        status: "delivering",
      },
      {
        brandAgentId: "demo-agent-1",
        budgetCurrency: "USD",
        budgetPacing: "front_loaded",
        budgetTotal: 25000,
        name: "ACME Brand Awareness Campaign",
        prompt:
          "Increase brand awareness among millennials and Gen Z consumers",
        scoringWeights: { affinity: 0.5, outcome: 0.2, quality: 0.3 },
        status: "scheduled",
      },
      {
        brandAgentId: "demo-agent-2",
        budgetCurrency: "USD",
        budgetDailyCap: 5000,
        budgetPacing: "asap",
        budgetTotal: 100000,
        name: "Nike Air Max Launch",
        prompt:
          "Launch new Air Max sneaker line targeting athletic enthusiasts and sneaker collectors",
        scoringWeights: { affinity: 0.6, outcome: 0.2, quality: 0.2 },
        status: "delivering",
      },
      {
        brandAgentId: "demo-agent-3",
        budgetCurrency: "USD",
        budgetDailyCap: 750,
        budgetPacing: "even",
        budgetTotal: 15000,
        name: "TechStart App Launch",
        prompt:
          "Promote new AI-powered productivity app to tech professionals and early adopters",
        status: "draft",
      },
    ];

    const createdCampaigns: string[] = [];

    for (const campaign of campaignData) {
      const campaignId = await bq.createCampaign(campaign);
      createdCampaigns.push(campaignId);
      console.log(`  ✅ Created campaign: ${campaign.name} (${campaignId})`);
    }

    console.log("");

    // 3. Create demo creatives
    console.log("🎨 Creating demo creatives...");

    const creativeData = [
      {
        brandAgentId: "demo-agent-1",
        content: {
          assetIds: ["asset_acme_holiday_1", "asset_acme_logo"],
          htmlSnippet:
            '<div class="acme-holiday-banner"><h2>ACME Holiday Sale - 25% Off!</h2><p>Limited time offer on all products</p></div>',
        },
        contentCategories: ["retail", "holiday", "discount"],
        description: "Holiday themed leaderboard banner with 25% off message",
        formatId: "display_banner_728x90",
        formatType: "adcp",
        name: "ACME Holiday Banner 728x90",
        status: "active",
      },
      {
        brandAgentId: "demo-agent-1",
        content: {
          assetIds: ["asset_acme_video_holiday"],
          vastTag: '<VAST version="4.0">...</VAST>',
        },
        contentCategories: ["retail", "holiday", "video"],
        description: "15-second holiday video showcasing product benefits",
        formatId: "video_16x9_15s",
        formatType: "adcp",
        name: "ACME Holiday Video 15s",
        status: "active",
      },
      {
        brandAgentId: "demo-agent-2",
        content: {
          assetIds: ["asset_nike_airmax_hero", "asset_nike_logo"],
          htmlSnippet:
            '<div class="nike-airmax-hero"><img src="airmax-hero.jpg" alt="New Air Max Collection" /><button class="cta">Shop Now</button></div>',
        },
        contentCategories: ["athletic", "footwear", "lifestyle"],
        description:
          "High-impact display creative featuring new Air Max design",
        formatId: "display_banner_300x250",
        formatType: "adcp",
        name: "Nike Air Max Hero Image",
        status: "active",
      },
      {
        brandAgentId: "demo-agent-2",
        content: {
          assetIds: ["asset_nike_mobile_banner"],
          htmlSnippet:
            '<div class="nike-mobile-banner"><span class="brand">Nike</span><span class="product">Air Max</span><span class="cta">Shop</span></div>',
        },
        contentCategories: ["athletic", "mobile", "footwear"],
        description: "Mobile-optimized banner for Air Max campaign",
        formatId: "display_banner_320x50",
        formatType: "adcp",
        name: "Nike Air Max Mobile Banner",
        status: "active",
      },
      {
        brandAgentId: "demo-agent-3",
        content: {
          htmlSnippet:
            '<div class="app-install-creative"><h3>Boost Productivity with AI</h3><p>TechStart App - Download Now</p></div>',
          productUrl: "https://techstart.io/app",
        },
        contentCategories: ["technology", "app", "productivity"],
        description: "App install creative highlighting key AI features",
        formatId: "ai_dynamic_product",
        formatType: "creative_agent",
        name: "TechStart App Install Creative",
        status: "draft",
      },
    ];

    const createdCreatives: string[] = [];

    for (const creative of creativeData) {
      const creativeId = await bq.createCreative(creative);
      createdCreatives.push(creativeId);
      console.log(`  ✅ Created creative: ${creative.name} (${creativeId})`);
    }

    console.log("");

    // 4. Create campaign-creative assignments
    console.log("🔗 Creating campaign-creative assignments...");

    // Assign ACME creatives to ACME campaigns
    await bq.assignCreativeToCampaign(
      createdCampaigns[0],
      createdCreatives[0],
      "seed_script",
    ); // Holiday campaign -> Holiday banner
    console.log(
      `  ✅ Assigned ACME Holiday Banner to ACME Holiday Sale campaign`,
    );

    await bq.assignCreativeToCampaign(
      createdCampaigns[0],
      createdCreatives[1],
      "seed_script",
    ); // Holiday campaign -> Holiday video
    console.log(
      `  ✅ Assigned ACME Holiday Video to ACME Holiday Sale campaign`,
    );

    // Assign Nike creatives to Nike campaign
    await bq.assignCreativeToCampaign(
      createdCampaigns[2],
      createdCreatives[2],
      "seed_script",
    ); // Nike campaign -> Hero image
    console.log(
      `  ✅ Assigned Nike Air Max Hero to Nike Air Max Launch campaign`,
    );

    await bq.assignCreativeToCampaign(
      createdCampaigns[2],
      createdCreatives[3],
      "seed_script",
    ); // Nike campaign -> Mobile banner
    console.log(
      `  ✅ Assigned Nike Air Max Mobile Banner to Nike Air Max Launch campaign`,
    );

    // Assign TechStart creative to TechStart campaign
    await bq.assignCreativeToCampaign(
      createdCampaigns[3],
      createdCreatives[4],
      "seed_script",
    ); // TechStart campaign -> App install
    console.log(
      `  ✅ Assigned TechStart App Install Creative to TechStart App Launch campaign`,
    );

    console.log("");

    // 5. Create some brand story assignments (if you have existing brand story IDs)
    console.log("📖 Creating sample brand story assignments...");

    // These would be real brand story agent IDs from your existing data
    const sampleBrandStoryIds = [
      "story_family_values",
      "story_premium_quality",
      "story_athletic_performance",
      "story_innovation",
    ];

    // Assign brand stories to campaigns
    try {
      await bq.assignBrandStoryToCampaign(
        createdCampaigns[0],
        sampleBrandStoryIds[0],
        0.6,
      ); // ACME Holiday -> Family values
      await bq.assignBrandStoryToCampaign(
        createdCampaigns[0],
        sampleBrandStoryIds[1],
        0.4,
      ); // ACME Holiday -> Premium quality
      console.log(`  ✅ Assigned brand stories to ACME Holiday Sale campaign`);

      await bq.assignBrandStoryToCampaign(
        createdCampaigns[2],
        sampleBrandStoryIds[2],
        1.0,
      ); // Nike -> Athletic performance
      console.log(
        `  ✅ Assigned brand stories to Nike Air Max Launch campaign`,
      );

      await bq.assignBrandStoryToCampaign(
        createdCampaigns[3],
        sampleBrandStoryIds[3],
        1.0,
      ); // TechStart -> Innovation
      console.log(
        `  ✅ Assigned brand stories to TechStart App Launch campaign`,
      );
    } catch {
      console.log(
        `  ℹ️  Brand story assignments skipped (brand stories may not exist yet)`,
      );
    }

    console.log("\n🎉 Seed data created successfully!");
    console.log("\n📊 Summary:");
    console.log(`• ${demoAgents.length} brand agent extensions created`);
    console.log(`• ${createdCampaigns.length} campaigns created`);
    console.log(`• ${createdCreatives.length} creatives created`);
    console.log(`• 5 campaign-creative assignments created`);
    console.log("\n🚀 Your BigQuery backend is ready for testing!");

    console.log("\n💡 Test with these sample IDs:");
    console.log("Brand Agents:", demoAgents.map((a) => a.id).join(", "));
    console.log("Campaigns:", createdCampaigns.join(", "));
    console.log("Creatives:", createdCreatives.join(", "));
  } catch (error) {
    console.error("\n❌ Error seeding BigQuery data:");
    if (error instanceof Error) {
      console.error(error.message);
      if (error.stack) {
        console.error("\nStack trace:");
        console.error(error.stack);
      }
    } else {
      console.error(String(error));
    }
    process.exit(1);
  }
}

// Run the seed script
seedBigQueryData().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
