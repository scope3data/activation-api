#!/usr/bin/env node

import { BigQuery } from "@google-cloud/bigquery";
import { FunFactsGeneratorService } from "./dist/services/metrics/fun-facts-generator.service.js";

async function testBusinessInsights() {
  console.log("🎯 Testing Business Insights Fun Facts Generator...\n");

  try {
    // Initialize BigQuery
    const bigQuery = new BigQuery({
      projectId: "bok-playground",
    });

    // Initialize fun facts generator
    const funFactsGenerator = new FunFactsGeneratorService(bigQuery);

    console.log("🔄 Generating fun facts from real business data...");
    const funFacts = await funFactsGenerator.generateFunFacts();

    if (funFacts.length === 0) {
      console.log(
        "😕 No fun facts generated - either no data or thresholds not met",
      );
      return;
    }

    console.log(`\n✨ Generated ${funFacts.length} business insights:\n`);

    funFacts.forEach((fact, index) => {
      console.log(`${index + 1}. ${fact.emoji} ${fact.text}`);
      console.log(`   Category: ${fact.category}\n`);
    });

    console.log("🎉 Business insights generation completed successfully!");
  } catch (error) {
    console.error("❌ Error testing business insights:", error.message);
    console.error("   Stack:", error.stack);
  }
}

testBusinessInsights();
