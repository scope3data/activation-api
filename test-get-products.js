// Test script for get_products tool
import { getProductsTool } from "./dist/tools/products/get-products.js";

async function testGetProducts() {
  console.log("🧪 Testing get_products tool...\n");

  const tool = getProductsTool();

  // Mock context (not used in current implementation)
  const mockContext = {};

  try {
    const result = await tool.execute(
      {
        promoted_offering: "Nike running shoes for athletes",
        brief:
          "Looking for premium athletic footwear inventory for sports brand campaign",
      },
      mockContext,
    );

    console.log("✅ Tool executed successfully!");
    console.log("📄 Response:");
    console.log("─".repeat(80));
    console.log(result);
    console.log("─".repeat(80));
  } catch (error) {
    console.error("❌ Error executing tool:", error.message);
    console.error("Stack trace:", error.stack);
  }
}

testGetProducts().catch(console.error);
