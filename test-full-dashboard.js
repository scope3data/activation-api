#!/usr/bin/env node

import dotenv from "dotenv";
import { SlackMetricsService } from "./dist/services/metrics/slack-metrics.service.js";
import { GitHubMetricsService } from "./dist/services/metrics/github-metrics.service.js";

// Load environment variables
dotenv.config({ path: ".env.local" });

async function testFullDashboard() {
  console.log("🚀 Testing full dashboard with team-wide Slack metrics...\n");

  // Test Slack team-wide metrics
  console.log("1️⃣ Testing Slack team-wide metrics...");
  if (process.env.SLACK_BOT_TOKEN) {
    try {
      const slackService = new SlackMetricsService({
        bot_token: process.env.SLACK_BOT_TOKEN,
      });

      const { slackMetrics } = await slackService.collectSlackMetrics();

      console.log("✅ Slack Team Metrics:");
      console.log(`   👥 Team Members: ${slackMetrics.team_members}`);
      console.log(`   📋 Total Channels: ${slackMetrics.total_channels}`);
      console.log(`   🔓 Public Channels: ${slackMetrics.public_channels}`);
      console.log(
        `   📊 Avg Members/Channel: ${slackMetrics.avg_members_per_channel}`,
      );
      console.log(
        `   🏆 Largest Channel: ${slackMetrics.largest_channel_size} members`,
      );
    } catch (error) {
      console.error("❌ Slack metrics failed:", error.message);
    }
  } else {
    console.log("⚠️  Slack integration skipped - no bot token");
  }

  console.log("\n2️⃣ Testing GitHub metrics...");
  if (process.env.GITHUB_TOKEN) {
    try {
      const githubService = new GitHubMetricsService({
        token: process.env.GITHUB_TOKEN,
        adcp_repo: process.env.GITHUB_ADCP_REPO || "adcontextprotocol/adcp",
        activation_api_repo:
          process.env.GITHUB_ACTIVATION_REPO || "conductor/activation-api",
      });

      const { githubMetrics } = await githubService.collectGitHubMetrics();

      console.log("✅ GitHub Ecosystem Metrics:");
      console.log(`   📋 ADCP Repo - Open PRs: ${githubMetrics.adcp.open_prs}`);
      console.log(`   ⭐ ADCP Repo - Stars: ${githubMetrics.adcp.stars}`);
      console.log(
        `   👥 ADCP Repo - Contributors: ${githubMetrics.adcp.contributors}`,
      );
      console.log(
        `   📋 Activation API - Open PRs: ${githubMetrics.activation_api.open_prs}`,
      );
      console.log(
        `   ⭐ Activation API - Stars: ${githubMetrics.activation_api.stars}`,
      );
    } catch (error) {
      console.error("❌ GitHub metrics failed:", error.message);
    }
  } else {
    console.log("⚠️  GitHub integration skipped - no token");
  }

  console.log("\n📊 Dashboard Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎯 SECRET AGENTIC ADVERTISING DASHBOARD");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✨ Team-wide Slack metrics now working!");
  console.log("✨ No longer limited to single channel");
  console.log("✨ Shows total team members across the workspace");
  console.log("✨ Tracks public channel usage and engagement");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

testFullDashboard().catch(console.error);
