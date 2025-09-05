#!/usr/bin/env node

import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const specPath = join(__dirname, "..", "openapi.yaml");

async function validateSpec() {
  try {
    console.log("🔍 Validating OpenAPI specification with Redocly...");

    // Use Redocly CLI to lint and validate the OpenAPI spec
    const result = execSync(
      `npx @redocly/cli lint "${specPath}" --format=stylish`,
      {
        encoding: "utf8",
        stdio: "pipe",
      },
    );

    console.log("✅ OpenAPI spec is valid!");

    // Show any warnings or recommendations
    if (result.trim()) {
      console.log("\n📋 Redocly output:");
      console.log(result);
    }

    // Get basic spec info using Redocly's stats command
    try {
      const statsResult = execSync(
        `npx @redocly/cli stats "${specPath}" --format=json`,
        {
          encoding: "utf8",
          stdio: "pipe",
        },
      );

      const stats = JSON.parse(statsResult);
      console.log(
        `📋 API: ${stats.info?.title || "Unknown"} v${stats.info?.version || "Unknown"}`,
      );
      console.log(`🔗 Paths: ${stats.paths?.count || 0} endpoints`);
      console.log(
        `📦 Components: ${stats.components?.schemas?.count || 0} schemas`,
      );
    } catch (statsError) {
      // Stats command is optional, continue if it fails
      console.log("📊 Stats not available");
    }

    console.log("\n🎉 Validation complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ OpenAPI validation failed:");

    // Redocly CLI provides detailed error information in stderr
    if (error.stderr) {
      console.error(error.stderr.toString());
    } else if (error.stdout) {
      console.error(error.stdout.toString());
    } else {
      console.error(error.message);
    }

    process.exit(1);
  }
}

validateSpec();
