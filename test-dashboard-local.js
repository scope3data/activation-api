import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

async function testDashboardLocally() {
  console.log("🏠 Testing dashboard locally...\n");

  const serverUrl = "http://localhost:3001/mcp";
  const apiKey = "scope3_demo_test_key_12345678901234567890_secret123"; // Demo API key

  console.log("📋 Configuration:");
  console.log(`  Server URL: ${serverUrl}`);
  console.log(`  API Key: ${apiKey.substring(0, 20)}...\n`);

  try {
    // Test health endpoint first
    console.log("🏥 Testing health endpoint...");
    const healthResponse = await fetch("http://localhost:3001/health");
    const healthData = await healthResponse.text();
    console.log(`✅ Health check: ${healthData}\n`);

    // Test metrics refresh tool
    console.log("🔄 Testing metrics refresh...");
    const refreshResult = await callMCPTool(
      serverUrl,
      apiKey,
      "refresh_platform_metrics",
      {
        include_github: true,
        include_slack: true,
      },
    );

    if (refreshResult.success) {
      console.log("✅ Metrics refresh successful");
      console.log(`📊 Result: ${refreshResult.content.text}\n`);
    } else {
      console.log("❌ Metrics refresh failed");
      console.log(`Error: ${refreshResult.error}\n`);
    }

    // Test dashboard display
    console.log("📊 Testing dashboard display...");
    const dashboardResult = await callMCPTool(
      serverUrl,
      apiKey,
      "show_agentic_metrics",
      {
        refresh: false,
        include_github: true,
        include_slack: true,
        max_age_minutes: 60,
      },
    );

    if (dashboardResult.success) {
      console.log("✅ Dashboard display successful");
      console.log("🎯 Dashboard Output:");
      console.log("━".repeat(80));
      console.log(dashboardResult.content.text);
      console.log("━".repeat(80));
    } else {
      console.log("❌ Dashboard display failed");
      console.log(`Error: ${dashboardResult.error}`);
    }
  } catch (error) {
    console.error("❌ Local dashboard test failed:");
    console.error(`  Error: ${error.message}`);
  }
}

async function callMCPTool(serverUrl, apiKey, toolName, arguments_) {
  try {
    const response = await fetch(serverUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-scope3-api-key": apiKey,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: toolName,
          arguments: arguments_,
        },
      }),
    });

    const data = await response.json();

    if (data.error) {
      return {
        success: false,
        error: data.error.message || JSON.stringify(data.error),
      };
    }

    return { success: true, content: data.result.content[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

testDashboardLocally().catch(console.error);
