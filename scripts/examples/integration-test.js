#!/usr/bin/env node

/**
 * Real GCS Upload Test Script
 * Tests actual upload to Google Cloud Storage with wonderstruck_shroom_300x250.jpg
 */

import { readFileSync, existsSync } from "fs";
import { AssetStorageService } from "./dist/services/asset-storage-service.js";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testRealUpload() {
  console.log();
  log("cyan", "🔧 Scope3 Asset Upload - Real GCS Test");
  log("cyan", "=====================================");
  console.log();

  // Check if image file exists
  const imageFile = "./wonderstruck_shroom_300x250.jpg";
  if (!existsSync(imageFile)) {
    log("red", `❌ Image file not found: ${imageFile}`);
    log(
      "yellow",
      "💡 Make sure wonderstruck_shroom_300x250.jpg is in the current directory",
    );
    return;
  }

  // Check if build exists
  if (!existsSync("./dist/services/asset-storage-service.js")) {
    log("red", "❌ Compiled service not found. Please run: npm run build");
    return;
  }

  // Check environment variables
  const requiredEnvVars = ["GCS_PROJECT_ID", "GCS_BUCKET_NAME"];
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName],
  );

  if (missingVars.length > 0) {
    log("red", `❌ Missing environment variables: ${missingVars.join(", ")}`);
    log("yellow", "💡 Please create .env file or set environment variables");
    log("yellow", "💡 Run ./setup-gcs.sh to automatically configure GCS");
    return;
  }

  // Check credentials
  const credentialsPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS || "./gcs-credentials.json";
  if (!existsSync(credentialsPath)) {
    log("red", `❌ GCS credentials not found: ${credentialsPath}`);
    log(
      "yellow",
      "💡 Run ./setup-gcs.sh to create service account credentials",
    );
    return;
  }

  try {
    // Initialize storage service
    log("blue", "🔧 Initializing AssetStorageService...");
    const storageService = new AssetStorageService();

    // Read and analyze image
    log("blue", "📁 Reading wonderstruck_shroom_300x250.jpg...");
    const imageBuffer = readFileSync(imageFile);
    const base64Data = imageBuffer.toString("base64");

    log("green", `✅ File read successfully:`);
    console.log(`   • Size: ${imageBuffer.length.toLocaleString()} bytes`);
    console.log(
      `   • Base64 length: ${base64Data.length.toLocaleString()} characters`,
    );

    // Test configuration
    const testConfig = {
      customerId: process.env.CUSTOMER_ID || "12345",
      buyerAgentId: process.env.TEST_BUYER_AGENT_ID || "agent-001",
      filename: "wonderstruck_shroom_300x250.jpg",
      contentType: "image/jpeg",
      assetType: "image",
    };

    log("blue", "🚀 Uploading to GCS...");
    console.log(`   • Customer ID: ${testConfig.customerId}`);
    console.log(`   • Buyer Agent ID: ${testConfig.buyerAgentId}`);
    console.log(`   • Bucket: ${process.env.GCS_BUCKET_NAME}`);
    console.log();

    // Perform actual upload
    const uploadResult = await storageService.uploadAsset(
      base64Data,
      testConfig.filename,
      testConfig.contentType,
      testConfig.customerId,
      {
        assetType: testConfig.assetType,
        buyerAgentId: testConfig.buyerAgentId,
        tags: ["test", "wonderstruck", "demo"],
      },
    );

    // Success!
    log("green", "🎉 Upload successful!");
    console.log();
    log("bright", "📊 Upload Results:");
    console.log(`   • Asset ID: ${uploadResult.assetId}`);
    console.log(
      `   • File Size: ${uploadResult.fileSize.toLocaleString()} bytes`,
    );
    console.log(`   • Uploaded At: ${uploadResult.uploadedAt}`);
    console.log();
    log("bright", "🌐 Public URL:");
    log("cyan", `   ${uploadResult.publicUrl}`);
    console.log();

    // Test public access
    log("blue", "🌍 Testing public access...");
    try {
      const response = await fetch(uploadResult.publicUrl, { method: "HEAD" });
      if (response.ok) {
        log("green", `✅ Public access confirmed (HTTP ${response.status})`);
        console.log(
          `   • Content-Type: ${response.headers.get("content-type")}`,
        );
        console.log(
          `   • Content-Length: ${response.headers.get("content-length")}`,
        );
      } else {
        log("yellow", `⚠️  Public access returned HTTP ${response.status}`);
      }
    } catch (fetchError) {
      log("yellow", `⚠️  Could not test public access: ${fetchError.message}`);
    }

    console.log();
    log("green", "✅ Real upload test completed successfully!");
    log("yellow", "💡 You can now share this URL with sales agents");
    console.log();
  } catch (error) {
    console.log();
    log("red", "❌ Upload failed:");
    console.error(error.message);

    if (error.message.includes("authentication")) {
      log(
        "yellow",
        "💡 Authentication issue - check your service account credentials",
      );
    } else if (error.message.includes("bucket")) {
      log(
        "yellow",
        "💡 Bucket issue - make sure the bucket exists and has proper permissions",
      );
    } else if (error.message.includes("permission")) {
      log(
        "yellow",
        "💡 Permission issue - ensure service account has Storage Admin role",
      );
    }

    console.log();
    log("yellow", "🔧 Troubleshooting:");
    console.log("   1. Run ./setup-gcs.sh to configure GCS properly");
    console.log("   2. Check .env file has correct values");
    console.log("   3. Verify service account has Storage Admin permissions");
    console.log();
  }
}

// Check if running as script
if (import.meta.url === `file://${process.argv[1]}`) {
  // Load environment variables if .env exists
  if (existsSync(".env")) {
    const dotenv = await import("dotenv");
    dotenv.config();
  }

  testRealUpload().catch((error) => {
    console.error("Script error:", error);
    process.exit(1);
  });
}
