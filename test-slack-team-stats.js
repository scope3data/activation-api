#!/usr/bin/env node

import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

if (!SLACK_BOT_TOKEN) {
  console.error("❌ Missing SLACK_BOT_TOKEN in .env.local");
  process.exit(1);
}

async function testSlackTeamStats() {
  console.log("🏢 Testing Slack team-wide statistics...\n");

  // Test 1: Get team info
  console.log("1️⃣ Getting team information...");
  try {
    const teamResponse = await fetch("https://slack.com/api/team.info", {
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      },
    });

    const teamData = await teamResponse.json();
    console.log("🏢 Team info:", teamData);

    if (teamData.ok) {
      console.log(`   Team: ${teamData.team.name}`);
      console.log(`   Domain: ${teamData.team.domain}`);
    }
  } catch (error) {
    console.error("❌ Team info failed:", error.message);
  }

  console.log("\n2️⃣ Getting list of all channels...");

  // Test 2: Get all public channels
  try {
    const channelsResponse = await fetch(
      "https://slack.com/api/conversations.list?types=public_channel&limit=1000",
      {
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        },
      },
    );

    const channelsData = await channelsResponse.json();
    console.log("📋 Channels list result:", channelsData);

    if (channelsData.ok) {
      console.log(
        `   ✅ Found ${channelsData.channels.length} public channels`,
      );

      // Show channel names and member counts
      for (const channel of channelsData.channels.slice(0, 5)) {
        // Show first 5
        console.log(`      - ${channel.name}: ${channel.num_members} members`);
      }

      if (channelsData.channels.length > 5) {
        console.log(
          `      ... and ${channelsData.channels.length - 5} more channels`,
        );
      }

      // Calculate total unique members across all channels (rough estimate)
      const totalChannelMembers = channelsData.channels.reduce(
        (sum, ch) => sum + (ch.num_members || 0),
        0,
      );
      console.log(
        `   📊 Total channel memberships: ${totalChannelMembers} (includes duplicates)`,
      );
    } else {
      console.log(`   ❌ Cannot list channels: ${channelsData.error}`);
    }
  } catch (error) {
    console.error("❌ Channels list failed:", error.message);
  }

  console.log("\n3️⃣ Getting user statistics...");

  // Test 3: Get users list to count total team members
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
    console.log("👥 Users list result summary:", {
      ok: usersData.ok,
      total_members: usersData.members?.length || 0,
      error: usersData.error,
    });

    if (usersData.ok && usersData.members) {
      const realUsers = usersData.members.filter(
        (member) =>
          !member.deleted && !member.is_bot && member.id !== "USLACKBOT",
      );

      console.log(`   ✅ Total team members: ${realUsers.length} real users`);
      console.log(
        `   🤖 Bots and deleted users: ${usersData.members.length - realUsers.length}`,
      );
    } else {
      console.log(`   ❌ Cannot list users: ${usersData.error}`);
    }
  } catch (error) {
    console.error("❌ Users list failed:", error.message);
  }

  console.log("\n💡 Team-wide message counting strategy:");
  console.log("   📊 For total team messages, we could:");
  console.log(
    "   1. Count messages across all public channels (requires joining each)",
  );
  console.log("   2. Use team analytics APIs (requires different scopes)");
  console.log(
    "   3. Focus on key metrics like total members and active channels",
  );
  console.log(
    "   4. Use Slack's admin APIs for workspace-level stats (requires admin)",
  );
}

testSlackTeamStats().catch(console.error);
