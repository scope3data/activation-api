#!/usr/bin/env node

/**
 * Smart API Reference Link Validator
 *
 * Tests API reference links flagged by Mintlify to distinguish between:
 * - False positives (working links that Mintlify incorrectly flags)
 * - Genuine broken links (that actually return 404s)
 */

import https from "https";
import { execSync } from "child_process";

const BASE_URL = "https://docs.agentic.scope3.com";
const TIMEOUT = 10000; // Increased timeout for slow server responses

async function testUrl(url) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ url, status: "timeout", working: false });
    }, TIMEOUT);

    const req = https.get(url, { timeout: TIMEOUT }, (res) => {
      clearTimeout(timeout);
      const working = res.statusCode >= 200 && res.statusCode < 400;
      resolve({
        url,
        status: res.statusCode,
        working,
        redirect: res.headers.location,
      });
      res.destroy();
    });

    req.on("error", (err) => {
      clearTimeout(timeout);
      resolve({
        url,
        status: "error",
        working: false,
        error: err.message,
      });
    });

    req.on("timeout", () => {
      clearTimeout(timeout);
      req.destroy();
      resolve({ url, status: "timeout", working: false });
    });
  });
}

async function getApiReferenceLinks() {
  console.log(
    "🔍 Getting API reference links from Mintlify broken-links output...",
  );

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
          const link = {
            file: currentFile,
            path: linkMatch[1],
            url: BASE_URL + linkMatch[1],
          };
          apiLinks.push(link);
        }
      }
    }

    console.log(`📊 Found ${apiLinks.length} API reference links`);
    return apiLinks;
  } catch (error) {
    console.error("Error getting broken links:", error.message);
    return [];
  }
}

async function validateApiLinks() {
  const apiLinks = await getApiReferenceLinks();

  if (apiLinks.length === 0) {
    console.log("✅ No API reference links flagged by Mintlify");
    return { working: [], broken: [] };
  }

  console.log(`🧪 Testing ${apiLinks.length} API reference links...`);

  const results = [];
  const BATCH_SIZE = 5; // Test in small batches to avoid overwhelming the server

  for (let i = 0; i < apiLinks.length; i += BATCH_SIZE) {
    const batch = apiLinks.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((link) =>
        testUrl(link.url).then((result) => ({ ...link, ...result })),
      ),
    );
    results.push(...batchResults);

    // Small delay between batches
    if (i + BATCH_SIZE < apiLinks.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const working = results.filter((r) => r.working);
  const broken = results.filter((r) => !r.working);

  console.log(`\n📊 Results:`);
  console.log(`✅ Working links (false positives): ${working.length}`);
  console.log(`❌ Actually broken links: ${broken.length}`);

  if (working.length > 0) {
    console.log(`\n✅ Working API reference links (Mintlify false positives):`);
    working.forEach((link) => {
      console.log(`   ${link.path} (${link.status}) in ${link.file}`);
    });
  }

  if (broken.length > 0) {
    console.log(`\n❌ Actually broken API reference links:`);
    broken.forEach((link) => {
      console.log(`   ${link.path} (${link.status}) in ${link.file}`);
    });
  }

  return { working, broken };
}

async function main() {
  console.log("🔗 Smart API Reference Link Validator");
  console.log("=====================================\n");

  const { working, broken } = await validateApiLinks();

  if (broken.length > 0) {
    console.log(
      `\n❌ Found ${broken.length} genuinely broken API reference links!`,
    );
    process.exit(1);
  } else {
    console.log(
      `\n✅ All API reference links are working (${working.length} false positives filtered out)`,
    );
    process.exit(0);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { validateApiLinks, testUrl };
