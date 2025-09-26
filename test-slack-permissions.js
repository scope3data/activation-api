#!/usr/bin/env node

import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID;

if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL_ID) {
  console.error("❌ Missing SLACK_BOT_TOKEN or SLACK_CHANNEL_ID in .env.local");
  process.exit(1);
}

async function testSlackPermissions() {
  console.log("🔍 Testing Slack bot permissions...\n");

  // Test 1: Check bot info and scopes
  console.log("1️⃣ Checking bot authentication and scopes...");
  try {
    const authResponse = await fetch("https://slack.com/api/auth.test", {
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      },
    });

    const authData = await authResponse.json();
    console.log("✅ Auth test:", authData);

    if (authData.ok) {
      console.log(`   Bot name: ${authData.user}`);
      console.log(`   Team: ${authData.team}`);
      console.log(`   User ID: ${authData.user_id}`);
    }
  } catch (error) {
    console.error("❌ Auth test failed:", error.message);
  }

  console.log("\n2️⃣ Testing channel access...");

  // Test 2: Try to get channel info
  try {
    const channelResponse = await fetch(
      `https://slack.com/api/conversations.info?channel=${SLACK_CHANNEL_ID}`,
      {
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        },
      },
    );

    const channelData = await channelResponse.json();
    console.log("📋 Channel info result:", channelData);

    if (channelData.ok) {
      console.log(`   Channel: ${channelData.channel.name}`);
      console.log(`   Members: ${channelData.channel.num_members}`);
      console.log(`   Is member: ${channelData.channel.is_member}`);
    }
  } catch (error) {
    console.error("❌ Channel info failed:", error.message);
  }

  console.log("\n3️⃣ Testing message history access...");

  // Test 3: Try to get message history
  try {
    const historyResponse = await fetch(
      `https://slack.com/api/conversations.history?channel=${SLACK_CHANNEL_ID}&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        },
      },
    );

    const historyData = await historyResponse.json();
    console.log("📨 Message history result:", historyData);

    if (historyData.ok) {
      console.log(
        `   ✅ Can read message history! Found ${historyData.messages?.length || 0} messages`,
      );
    } else {
      console.log(`   ❌ Cannot read message history: ${historyData.error}`);

      if (historyData.error === "not_in_channel") {
        console.log(
          "\n💡 SOLUTION: The bot needs to be added to the channel AND have proper scopes:",
        );
        console.log("   1. In Slack, type: /invite @demo_app");
        console.log(
          "   2. Or go to https://api.slack.com/apps and add these scopes:",
        );
        console.log(
          "      - channels:history (read message history in public channels)",
        );
        console.log(
          "      - channels:read (view basic info about public channels)",
        );
        console.log(
          "      - chat:write (if you want the bot to send messages)",
        );
      }
    }
  } catch (error) {
    console.error("❌ Message history test failed:", error.message);
  }
}

testSlackPermissions().catch(console.error);
