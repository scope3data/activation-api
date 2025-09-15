#!/usr/bin/env node

/**
 * Local API Reference Link Validator
 *
 * Validates API reference links by checking against the OpenAPI spec
 * and expected Mintlify URL generation patterns - no HTTP requests needed!
 */

import fs from "fs";
import yaml from "yaml";
import { execSync } from "child_process";

async function loadOpenAPISpec() {
  try {
    const openApiContent = fs.readFileSync("openapi.yaml", "utf8");
    return yaml.parse(openApiContent);
  } catch (error) {
    console.error("Error loading OpenAPI spec:", error.message);
    return null;
  }
}

function generateExpectedApiLinks(openApiSpec) {
  const expectedLinks = [];

  if (!openApiSpec?.paths) {
    return expectedLinks;
  }

  for (const [path, methods] of Object.entries(openApiSpec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (operation.tags && operation.summary) {
        // Generate expected Mintlify URL based on tag and summary (how Mintlify actually works)
        const tag = operation.tags[0]; // Use first tag
        const tagSlug = tag
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/&/g, "&");

        // Use summary for URL slug (Mintlify's actual behavior)
        const summarySlug = operation.summary
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");

        const expectedUrl = `/api-reference/${tagSlug}/${summarySlug}`;

        expectedLinks.push({
          path,
          method: method.toUpperCase(),
          operationId: operation.operationId,
          tag,
          summary: operation.summary,
          expectedUrl,
        });
      }
    }
  }

  return expectedLinks;
}

async function getActualApiReferenceLinks() {
  try {
    const output = execSync("npm run docs:validate:links 2>&1", {
      encoding: "utf8",
    });
    const lines = output.split("\n");

    const apiLinks = [];
    let currentFile = null;

    for (const line of lines) {
      if (line.endsWith(".mdx")) {
        currentFile = line.trim();
      } else if (line.includes("⎿") && line.includes("/api-reference/")) {
        const linkMatch = line.match(/⎿\s+(\/api-reference\/[^\s]+)/);
        if (linkMatch) {
          apiLinks.push({
            file: currentFile,
            actualUrl: linkMatch[1],
          });
        }
      }
    }

    return apiLinks;
  } catch (error) {
    console.error("Error getting broken links:", error.message);
    return [];
  }
}

function validateApiLinks(expectedLinks, actualLinks) {
  const results = {
    validLinks: [],
    invalidLinks: [],
    missingFromSpec: [],
  };

  // Create a Set of expected URLs for fast lookup
  const expectedUrls = new Set(expectedLinks.map((link) => link.expectedUrl));

  for (const actualLink of actualLinks) {
    if (expectedUrls.has(actualLink.actualUrl)) {
      // Find the matching expected link for more details
      const matchingExpected = expectedLinks.find(
        (e) => e.expectedUrl === actualLink.actualUrl,
      );
      results.validLinks.push({
        ...actualLink,
        ...matchingExpected,
        status: "valid",
      });
    } else {
      // Check if it's a different valid pattern (maybe old naming convention)
      const isKnownPattern = actualLink.actualUrl.match(
        /^\/api-reference\/[a-z-]+\/[a-z-]+$/,
      );

      if (isKnownPattern) {
        results.invalidLinks.push({
          ...actualLink,
          status: "invalid",
          reason: "Does not match OpenAPI spec expectations",
        });
      } else {
        results.missingFromSpec.push({
          ...actualLink,
          status: "unknown",
          reason: "Unusual URL pattern",
        });
      }
    }
  }

  return results;
}

async function main() {
  console.log("🔗 Local API Reference Link Validator");
  console.log("====================================\n");

  console.log("📋 Loading OpenAPI specification...");
  const openApiSpec = await loadOpenAPISpec();

  if (!openApiSpec) {
    console.log("❌ Failed to load OpenAPI spec");
    process.exit(1);
  }

  console.log(
    "🔍 Generating expected API reference links from OpenAPI spec...",
  );
  const expectedLinks = generateExpectedApiLinks(openApiSpec);
  console.log(`📊 Found ${expectedLinks.length} expected API endpoints`);

  console.log("🔍 Getting actual API reference links from documentation...");
  const actualLinks = await getActualApiReferenceLinks();
  console.log(`📊 Found ${actualLinks.length} API reference links in docs`);

  if (actualLinks.length === 0) {
    console.log("✅ No API reference links flagged as broken");
    process.exit(0);
  }

  console.log("🧪 Validating links against OpenAPI spec...");
  const results = validateApiLinks(expectedLinks, actualLinks);

  console.log(`\n📊 Validation Results:`);
  console.log(`✅ Valid links: ${results.validLinks.length}`);
  console.log(`❌ Invalid links: ${results.invalidLinks.length}`);
  console.log(`❓ Unknown patterns: ${results.missingFromSpec.length}`);

  if (results.validLinks.length > 0) {
    console.log(`\n✅ Valid API reference links:`);
    results.validLinks.forEach((link) => {
      console.log(`   ${link.actualUrl} → ${link.operationId} in ${link.file}`);
    });
  }

  if (results.invalidLinks.length > 0) {
    console.log(`\n❌ Invalid API reference links:`);
    results.invalidLinks.forEach((link) => {
      console.log(`   ${link.actualUrl} in ${link.file}`);
      console.log(`     Reason: ${link.reason}`);
    });
  }

  if (results.missingFromSpec.length > 0) {
    console.log(`\n❓ Unknown API reference patterns:`);
    results.missingFromSpec.forEach((link) => {
      console.log(`   ${link.actualUrl} in ${link.file}`);
      console.log(`     Reason: ${link.reason}`);
    });
  }

  // Show some expected links for reference
  if (expectedLinks.length > 0) {
    console.log(`\n📋 Expected API reference URL patterns (first 5):`);
    expectedLinks.slice(0, 5).forEach((link) => {
      console.log(`   ${link.expectedUrl} ← ${link.operationId} (${link.tag})`);
    });
    if (expectedLinks.length > 5) {
      console.log(`   ... and ${expectedLinks.length - 5} more`);
    }
  }

  if (results.invalidLinks.length > 0 || results.missingFromSpec.length > 0) {
    console.log(
      `\n❌ Found ${results.invalidLinks.length + results.missingFromSpec.length} problematic API reference links!`,
    );
    process.exit(1);
  } else {
    console.log(
      `\n✅ All API reference links are valid according to OpenAPI spec`,
    );
    process.exit(0);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { validateApiLinks, generateExpectedApiLinks };
