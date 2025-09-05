#!/usr/bin/env node

import SwaggerParser from "@apidevtools/swagger-parser";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const specPath = join(__dirname, "..", "openapi.yaml");

async function validateSpec() {
  try {
    console.log("🔍 Validating OpenAPI specification...");

    // Parse and validate the OpenAPI spec
    const api = await SwaggerParser.validate(specPath);

    console.log("✅ OpenAPI spec is valid!");
    console.log(`📋 API: ${api.info.title} v${api.info.version}`);
    console.log(`🔗 Paths: ${Object.keys(api.paths).length} endpoints`);
    console.log(
      `📦 Components: ${Object.keys(api.components?.schemas || {}).length} schemas`,
    );

    // Additional checks
    const warnings = [];

    // Check for missing examples
    const pathsWithoutExamples = [];
    for (const [path, methods] of Object.entries(api.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (typeof operation === "object" && operation.responses) {
          for (const [status, response] of Object.entries(
            operation.responses,
          )) {
            if (
              response.content &&
              !response.content["application/json"]?.examples
            ) {
              pathsWithoutExamples.push(
                `${method.toUpperCase()} ${path} (${status})`,
              );
            }
          }
        }
      }
    }

    if (pathsWithoutExamples.length > 0) {
      warnings.push(
        `Missing examples in responses: ${pathsWithoutExamples.slice(0, 3).join(", ")}${pathsWithoutExamples.length > 3 ? "..." : ""}`,
      );
    }

    // Check for missing descriptions
    const operationsWithoutDescriptions = [];
    for (const [path, methods] of Object.entries(api.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (typeof operation === "object" && !operation.description) {
          operationsWithoutDescriptions.push(`${method.toUpperCase()} ${path}`);
        }
      }
    }

    if (operationsWithoutDescriptions.length > 0) {
      warnings.push(
        `Operations missing descriptions: ${operationsWithoutDescriptions.slice(0, 2).join(", ")}${operationsWithoutDescriptions.length > 2 ? "..." : ""}`,
      );
    }

    // Display warnings
    if (warnings.length > 0) {
      console.log("\n⚠️  Recommendations:");
      warnings.forEach((warning) => console.log(`   • ${warning}`));
    }

    console.log("\n🎉 Validation complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ OpenAPI validation failed:");

    if (error.details) {
      // Swagger parser provides detailed error information
      console.error(`\n📍 Error details:`);
      error.details.forEach((detail, index) => {
        console.error(`   ${index + 1}. ${detail.message}`);
        if (detail.path) {
          console.error(`      Path: ${detail.path}`);
        }
      });
    } else {
      console.error(`\n💥 ${error.message}`);
    }

    process.exit(1);
  }
}

validateSpec();
