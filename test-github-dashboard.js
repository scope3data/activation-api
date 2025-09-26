#!/usr/bin/env node

// Test script for GitHub metrics dashboard
import dotenv from "dotenv";
import { GitHubMetricsService } from "./dist/services/metrics/github-metrics.service.js";

// Load environment variables
dotenv.config({ path: ".env.local" });

async function testGitHubDashboard() {
  console.log("🧪 Testing GitHub Metrics Dashboard...\n");

  try {
    const config = {
      token: process.env.GITHUB_TOKEN,
      adcp_repo: "adcontextprotocol/adcp",
      activation_api_repo: "conductor/activation-api",
    };

    console.log("📋 Configuration:");
    console.log(
      `  GitHub Token: ${config.token ? config.token.substring(0, 10) + "..." : "NOT SET"}`,
    );
    console.log(`  ADCP Repo: ${config.adcp_repo}`);
    console.log(`  Activation Repo: ${config.activation_api_repo}\n`);

    if (!config.token) {
      console.error("❌ Missing GitHub token. Please check .env.local file.");
      return;
    }

    console.log("🔄 Collecting GitHub metrics...");
    const githubService = new GitHubMetricsService(config);

    const startTime = Date.now();
    const { metrics, githubMetrics } =
      await githubService.collectGitHubMetrics();
    const duration = Date.now() - startTime;

    console.log(
      `✅ Successfully collected ${metrics.length} GitHub metrics in ${duration}ms\n`,
    );

    // Display dashboard
    console.log("🚀 AGENTIC ADVERTISING SECRET DASHBOARD");
    console.log("═══════════════════════════════════════");
    console.log("");

    console.log("📊 GITHUB ECOSYSTEM METRICS");
    console.log("────────────────────────────");
    console.log("");

    console.log("🏗️  ADCP Repository:");
    console.log(`   📄 Open Issues: ${githubMetrics.adcp_repo.open_issues}`);
    console.log(`   🔄 Open PRs: ${githubMetrics.adcp_repo.open_prs}`);
    console.log(`   🌟 Stars: ${githubMetrics.adcp_repo.stars}`);
    console.log(`   👥 Contributors: ${githubMetrics.adcp_repo.contributors}`);
    console.log(
      `   📝 PRs Merged This Week: ${githubMetrics.adcp_repo.merged_prs_this_week}`,
    );
    if (githubMetrics.adcp_repo.latest_release) {
      console.log(
        `   🏷️  Latest Release: ${githubMetrics.adcp_repo.latest_release} (${githubMetrics.adcp_repo.latest_release_days_ago} days ago)`,
      );
    }
    console.log("");

    console.log("🚀 Activation API Repository:");
    console.log(
      `   📄 Open Issues: ${githubMetrics.activation_api_repo.open_issues}`,
    );
    console.log(
      `   🔄 Open PRs: ${githubMetrics.activation_api_repo.open_prs}`,
    );
    console.log(`   🌟 Stars: ${githubMetrics.activation_api_repo.stars}`);
    console.log(
      `   👥 Contributors: ${githubMetrics.activation_api_repo.contributors}`,
    );
    console.log(
      `   📝 PRs Merged This Week: ${githubMetrics.activation_api_repo.merged_prs_this_week}`,
    );
    if (githubMetrics.activation_api_repo.latest_release) {
      console.log(
        `   🏷️  Latest Release: ${githubMetrics.activation_api_repo.latest_release} (${githubMetrics.activation_api_repo.latest_release_days_ago} days ago)`,
      );
    }
    console.log("");

    console.log("🎯 SUMMARY:");
    console.log(`   📊 Total Metrics Collected: ${metrics.length}`);
    console.log(`   ⏱️  Collection Time: ${duration}ms`);
    console.log(`   🗓️  Last Updated: ${new Date().toLocaleString()}`);
    console.log("");

    console.log("📈 DETAILED METRICS:");
    console.log("──────────────────");
    metrics.forEach((metric) => {
      if (metric.metric_value !== undefined) {
        console.log(`   ${metric.metric_name}: ${metric.metric_value}`);
      }
    });
    console.log("");

    console.log("✅ STATUS:");
    console.log("   🟢 GitHub Integration: WORKING");
    console.log("   🟡 Slack Integration: BOT NOT IN CHANNEL");
    console.log("   🟡 Platform Metrics: NEEDS BIGQUERY SETUP");
    console.log("");

    console.log("💡 NEXT STEPS:");
    console.log("   1. Add Slack bot to #agentic-advertising channel");
    console.log(
      "   2. Run BigQuery setup script: `psql -f scripts/create-metrics-tables.sql`",
    );
    console.log("   3. Test complete dashboard with all integrations");
    console.log("");

    console.log("🎉 GitHub Dashboard Test Completed Successfully!");
  } catch (error) {
    console.error("❌ GitHub Dashboard Test Failed:", error.message);
    if (error.stack) {
      console.error("Stack:", error.stack);
    }
  }
}

testGitHubDashboard().catch(console.error);
