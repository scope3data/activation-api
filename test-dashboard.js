#!/usr/bin/env node

// Test script for the secret dashboard
import { BigQuery } from "@google-cloud/bigquery";
import { MetricsCollectorService } from "./dist/services/metrics/metrics-collector.service.js";

async function testDashboard() {
  console.log("🧪 Testing Secret Dashboard...\n");

  try {
    // Set up environment
    process.env.SLACK_BOT_TOKEN =
      process.env.SLACK_BOT_TOKEN || "xoxb-YOUR-SLACK-BOT-TOKEN-HERE";
    process.env.SLACK_CHANNEL_ID =
      process.env.SLACK_CHANNEL_ID || "C09B9S23KAP";

    const config = {
      slack_bot_token: process.env.SLACK_BOT_TOKEN,
      slack_channel_id: process.env.SLACK_CHANNEL_ID,
      github_adcp_repo: "adcontextprotocol/adcp",
      github_activation_repo: "conductor/activation-api",
      max_cache_age_minutes: 15,
      collection_timeout_ms: 30000,
    };

    console.log("📊 Initializing metrics collector...");
    const bigquery = new BigQuery();
    const metricsCollector = new MetricsCollectorService(bigquery, config);

    console.log("🔍 Testing Slack connection...");
    const connections = await metricsCollector.testConnections();
    console.log("Connection results:", connections);

    console.log("\n📈 Collecting platform metrics...");
    const refreshResult = await metricsCollector.refreshAllMetrics(
      {
        include_github: false,
        include_slack: true,
        force_refresh: true,
      },
      undefined, // no customer ID
      "manual",
    );

    console.log("\n✅ Refresh completed:");
    console.log(`  🆔 Job ID: ${refreshResult.job_id}`);
    console.log(`  📊 Metrics collected: ${refreshResult.metrics_collected}`);
    console.log(
      `  ✅ Sources succeeded: ${refreshResult.sources_succeeded.join(", ")}`,
    );
    console.log(
      `  ❌ Sources failed: ${refreshResult.sources_failed.join(", ")}`,
    );
    console.log(`  ⏱️  Duration: ${refreshResult.collection_duration_ms}ms`);

    console.log("\n🎯 Getting comprehensive metrics...");
    const metrics = await metricsCollector.getComprehensiveMetrics(
      undefined,
      1,
    );

    console.log("\n🚀 DASHBOARD PREVIEW:");
    console.log("═══════════════════════");
    console.log(
      `📊 Platform: ${metrics.platform.brand_agents} brand agents, ${metrics.platform.active_campaigns} campaigns`,
    );
    console.log(
      `🔥 API Usage: ${metrics.api_usage.total_api_calls} calls today`,
    );
    if (metrics.slack) {
      console.log(
        `👥 Slack: ${metrics.slack.channel_members} members, ${metrics.slack.messages_today} messages today`,
      );
    }
    console.log(`🎲 Fun Facts: ${metrics.fun_facts.length} facts available`);
    console.log(`⏱️  Collected in: ${metrics.collection_duration_ms}ms`);

    console.log("\n🎉 Test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    if (error.stack) {
      console.error("Stack:", error.stack);
    }
  }
}

testDashboard().catch(console.error);
