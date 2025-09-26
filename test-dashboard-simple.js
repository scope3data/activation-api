#!/usr/bin/env node

// Simple test for dashboard infrastructure
import { BigQuery } from "@google-cloud/bigquery";
import { MetricsStorageService } from "./dist/services/metrics/metrics-storage.service.js";

async function testDashboardInfrastructure() {
  console.log("🧪 Testing Dashboard Infrastructure...\n");

  try {
    const bigquery = new BigQuery();
    const storageService = new MetricsStorageService(bigquery);

    console.log("🎲 Testing fun facts system...");
    const funFacts = await storageService.getRandomFunFacts(3);
    console.log("Fun facts retrieved:", funFacts.length);
    funFacts.forEach((fact, i) => console.log(`  ${i + 1}. ${fact}`));

    console.log("\n📊 Testing metrics storage...");
    const testMetrics = [
      storageService.createMetricEntry(
        "test",
        "sample_metric",
        42,
        undefined,
        undefined,
        "manual",
      ),
      storageService.createMetricEntry(
        "test",
        "another_metric",
        123,
        { detail: "test" },
        undefined,
        "manual",
      ),
    ];

    await storageService.storeMetrics(testMetrics);
    console.log("✅ Successfully stored 2 test metrics");

    console.log("\n📈 Testing metrics retrieval...");
    const latestMetrics = await storageService.getLatestMetrics({
      categories: ["test"],
      max_age_minutes: 1,
    });
    console.log(`✅ Retrieved ${latestMetrics.length} metrics`);
    latestMetrics.forEach((metric) => {
      console.log(
        `  📊 ${metric.metric_name}: ${metric.metric_value || "N/A"}`,
      );
    });

    console.log("\n🎯 Dashboard infrastructure test PASSED!");
    console.log("\n🎉 Your secret dashboard is ready!");
    console.log("\n📝 Next steps:");
    console.log("  1. Add the Slack bot to #agentic-advertising channel");
    console.log("  2. Set up GitHub token (optional)");
    console.log("  3. Run: show_agentic_metrics");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    throw error;
  }
}

testDashboardInfrastructure().catch(console.error);
