#!/usr/bin/env tsx
// Test script for brief sanitization service

import { BriefSanitizationService } from "../src/services/brief-sanitization-service.js";

async function testBriefSanitization() {
  const sanitizer = new BriefSanitizationService();

  // Test cases with various budget information
  const testCases = [
    {
      brief:
        "Launch a premium advertising campaign targeting luxury car buyers aged 35-55 in major metropolitan areas. Budget: $50,000 total with a $2,000 daily cap. Looking for high-quality placements with CPM under $15. Focus on lifestyle and automotive publications.",
      expectedRemoval: true,
      name: "Campaign with explicit budget",
    },
    {
      brief:
        "Promote our new product to tech-savvy millennials with a $25K spend allocation. We're willing to pay up to $8.50 CPM for premium inventory. Target users interested in gadgets and technology.",
      expectedRemoval: true,
      name: "Campaign with pricing mentions",
    },
    {
      brief:
        "Target environmentally conscious consumers aged 25-45 who are interested in sustainable living. Focus on users who engage with eco-friendly content and live in urban areas. Promote our new sustainable product line with emphasis on environmental benefits.",
      expectedRemoval: false,
      name: "Clean campaign brief",
    },
    {
      brief:
        "Drive brand awareness for our financial services with a focus on cost effectiveness and strong ROAS. Target high-income professionals in finance and consulting sectors. Budget optimization is key for this campaign.",
      expectedRemoval: true,
      name: "Campaign with ROI mentions",
    },
    {
      brief:
        "Launch awareness campaign for luxury watches targeting affluent men 40-65. Looking for placements between $10-20 CPM on premium lifestyle sites. Focus on users who read luxury and fashion content. Strong creative emphasis on craftsmanship and heritage.",
      expectedRemoval: true,
      name: "Mixed content with budget range",
    },
  ];

  console.log("🔍 Testing Brief Sanitization Service\n");

  for (const testCase of testCases) {
    console.log(`📝 Test: ${testCase.name}`);
    console.log(`Original Brief: "${testCase.brief}"`);

    try {
      const result = await sanitizer.sanitizeBrief(
        testCase.brief,
        25000,
        100000,
      );

      console.log(`✅ Sanitized Brief: "${result.sanitized_brief}"`);
      console.log(`🔍 Confidence Score: ${result.confidence_score}%`);
      console.log(
        `📊 Context Preserved: ${result.preserves_context ? "Yes" : "No"}`,
      );

      if (result.removed_elements.length > 0) {
        console.log(`🚫 Removed Elements:`);
        result.removed_elements.forEach((element, index) => {
          console.log(`   ${index + 1}. ${element}`);
        });
      } else {
        console.log(`ℹ️  No financial elements detected`);
      }

      // Validate expectations
      const foundFinancialTerms = result.removed_elements.length > 0;
      if (testCase.expectedRemoval && !foundFinancialTerms) {
        console.log(`⚠️  Expected financial terms to be found and removed`);
      } else if (!testCase.expectedRemoval && foundFinancialTerms) {
        console.log(`⚠️  Unexpected financial terms were removed`);
      } else {
        console.log(`✅ Sanitization result matches expectations`);
      }
    } catch (error) {
      console.log(
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    console.log(`${"─".repeat(80)}\n`);
  }

  // Test allocation range context
  console.log("💰 Testing Allocation Range Context\n");

  const allocationTests = [
    { amount: 500, expected: "Small allocation" },
    { amount: 2500, expected: "Medium allocation" },
    { amount: 15000, expected: "Large allocation" },
    { amount: 75000, expected: "Enterprise allocation" },
    { amount: 150000, expected: "Premium allocation" },
  ];

  for (const test of allocationTests) {
    const context = sanitizer.createAllocationRangeContext(test.amount, 200000);
    console.log(`💵 $${test.amount.toLocaleString()}: ${context}`);

    if (context.includes(test.expected)) {
      console.log(`✅ Correct tier: ${test.expected}`);
    } else {
      console.log(`❌ Expected "${test.expected}" but got different tier`);
    }
    console.log();
  }

  console.log("🎉 Brief sanitization testing complete!");
}

// Run the test
testBriefSanitization().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
