#!/usr/bin/env node

import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

if (!SLACK_BOT_TOKEN) {
  console.error("❌ Missing SLACK_BOT_TOKEN in .env.local");
  process.exit(1);
}

async function testSimplifiedSlack() {
  console.log("🏢 Testing simplified Slack team metrics...\n");

  // Test 1: Get team members (this works)
  console.log("1️⃣ Getting team members...");
  try {
    const usersResponse = await fetch(
      "https://slack.com/api/users.list?limit=1000",
      {
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        },
      },
    );

    const usersData = await usersResponse.json();

    if (usersData.ok && usersData.members) {
      const realUsers = usersData.members.filter(
        (member) =>
          !member.deleted && !member.is_bot && member.id !== "USLACKBOT",
      );

      console.log(`   ✅ Total team members: ${realUsers.length} real users`);
      console.log(
        `   🤖 Total users (including bots): ${usersData.members.length}`,
      );
    } else {
      console.log(`   ❌ Cannot list users: ${usersData.error}`);
    }
  } catch (error) {
    console.error("❌ Users list failed:", error.message);
  }

  console.log("\n2️⃣ Testing public channels with different approach...");

  // Test 2: Try getting just public channels (no private)
  try {
    const channelsResponse = await fetch(
      "https://slack.com/api/conversations.list?types=public_channel&limit=100",
      {
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        },
      },
    );

    const channelsData = await channelsResponse.json();
    console.log("📋 Public channels result:", channelsData);

    if (channelsData.ok) {
      console.log(
        `   ✅ Found ${channelsData.channels.length} public channels`,
      );

      const activeChannels = channelsData.channels.filter(
        (ch) => !ch.is_archived,
      );
      const totalMembers = activeChannels.reduce(
        (sum, ch) => sum + (ch.num_members || 0),
        0,
      );
      const avgMembers =
        activeChannels.length > 0
          ? Math.round(totalMembers / activeChannels.length)
          : 0;
      const largestChannel = Math.max(
        ...activeChannels.map((ch) => ch.num_members || 0),
        0,
      );

      console.log(`   📊 Active channels: ${activeChannels.length}`);
      console.log(`   📊 Average members per channel: ${avgMembers}`);
      console.log(`   📊 Largest channel: ${largestChannel} members`);

      // Show top 3 channels by size
      const topChannels = activeChannels
        .sort((a, b) => (b.num_members || 0) - (a.num_members || 0))
        .slice(0, 3);
      console.log(`   🏆 Top channels:`);
      topChannels.forEach((ch) => {
        console.log(`      - ${ch.name}: ${ch.num_members} members`);
      });
    } else {
      console.log(`   ❌ Cannot list public channels: ${channelsData.error}`);
      console.log(`   ℹ️  Required scope: channels:read`);
    }
  } catch (error) {
    console.error("❌ Public channels list failed:", error.message);
  }
}

testSimplifiedSlack().catch(console.error);
