import { SlackMetricsService } from "./dist/services/metrics/slack-metrics.service.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

async function testSlackIntegration() {
  console.log("🧪 Testing Slack integration...\n");

  const config = {
    bot_token: process.env.SLACK_BOT_TOKEN,
    channel_id: process.env.SLACK_CHANNEL_ID,
  };

  console.log("📋 Configuration:");
  console.log(
    `  Bot token: ${config.bot_token ? config.bot_token.substring(0, 10) + "..." : "NOT SET"}`,
  );
  console.log(`  Channel ID: ${config.channel_id || "NOT SET"}\n`);

  if (!config.bot_token || !config.channel_id) {
    console.error(
      "❌ Missing Slack configuration. Please check environment variables.",
    );
    return;
  }

  try {
    const slackService = new SlackMetricsService(config);

    // First test connection
    console.log("🔗 Testing Slack API connection...");
    const connectionTest = await slackService.testConnection();

    if (!connectionTest.success) {
      console.error(`❌ Connection test failed: ${connectionTest.error}`);
      return;
    }

    console.log(`✅ Connected successfully as user: ${connectionTest.user}\n`);

    console.log("🔄 Collecting Slack metrics...");
    const startTime = Date.now();

    const { metrics, slackMetrics } = await slackService.collectSlackMetrics();
    const duration = Date.now() - startTime;

    console.log(
      `✅ Successfully collected ${metrics.length} Slack metrics in ${duration}ms\n`,
    );

    console.log("📊 Slack Metrics:");
    console.log(`  Channel Members: ${slackMetrics.channel_members}`);
    console.log(`  Messages Today: ${slackMetrics.messages_today}`);
    console.log(`  Messages This Week: ${slackMetrics.messages_this_week}`);
    console.log(
      `  Active Participants Today: ${slackMetrics.active_participants_today}`,
    );
    console.log(
      `  Most Active Hour: ${slackMetrics.most_active_hour || "N/A"}\n`,
    );

    console.log("📋 Detailed Metrics:");
    metrics.forEach((metric) => {
      if (metric.metric_value !== undefined) {
        console.log(`  ${metric.metric_name}: ${metric.metric_value}`);
      } else if (metric.metric_json && metric.metric_name !== "all_metrics") {
        console.log(
          `  ${metric.metric_name}: ${JSON.stringify(metric.metric_json, null, 2)}`,
        );
      }
    });
  } catch (error) {
    console.error("❌ Slack integration test failed:");
    console.error(`  Error: ${error.message}`);

    if (error.message.includes("not_in_channel")) {
      console.error("  💡 Hint: Bot may not be added to the channel yet");
    } else if (error.message.includes("invalid_auth")) {
      console.error("  💡 Hint: Check bot token permissions");
    } else if (error.message.includes("channel_not_found")) {
      console.error("  💡 Hint: Verify channel ID is correct");
    }
  }
}

testSlackIntegration().catch(console.error);
