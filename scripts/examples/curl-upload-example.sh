#!/bin/bash

# Example curl command for uploading the wonderstruck_shroom_300x250.jpg via HTTP API
# This demonstrates how sales agents or external systems could upload assets

echo "🌐 HTTP API Upload Example for wonderstruck_shroom_300x250.jpg"

# Convert image to base64 (remove newlines for proper JSON)
BASE64_DATA=$(base64 -i wonderstruck_shroom_300x250.jpg | tr -d '\n')

echo "📊 File converted to base64 (${#BASE64_DATA} characters)"

# Create the JSON payload
cat > upload-payload.json << EOF
{
  "assets": [
    {
      "assetType": "image",
      "base64Data": "${BASE64_DATA}",
      "contentType": "image/jpeg",
      "filename": "wonderstruck_shroom_300x250.jpg",
      "metadata": {
        "buyerAgentId": "wonderstruck-media",
        "tags": ["mushroom", "300x250", "banner", "wonderstruck"]
      }
    }
  ]
}
EOF

echo "📋 Created upload-payload.json with the asset data"

# Show the curl command (without actually executing it)
echo ""
echo "🚀 Example curl command for production upload:"
echo ""
echo "curl -X POST 'https://api.agentic.scope3.com/assets_upload' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer YOUR_API_KEY' \\"
echo "  -d @upload-payload.json"
echo ""

# Show what the response would look like
echo "📋 Expected Response:"
cat << 'EOF'
{
  "content": [
    {
      "type": "text",
      "text": "📤 **Asset Upload Results**\n\n🆔 **Summary**\n• Customer ID: 123\n• Total Assets: 1\n• Successful: 1\n• Failed: 0\n\n📋 **Upload Details:**\n✅ **wonderstruck_shroom_300x250.jpg** (78KB)\n   • Asset ID: `abc-123-def`\n   • Public URL: https://storage.googleapis.com/scope3-creative-assets/customers/123/brand-agents/wonderstruck-media/assets/abc-123-def.jpg\n\n💡 **Next Steps**\n• Share public URLs with sales agents\n• Reference assets in creatives using asset IDs\n• Use `assets_add` tool to register in asset management system"
    }
  ]
}
EOF

echo ""
echo "🎯 Benefits of this approach:"
echo "✅ Direct HTTP API access for external integrations"
echo "✅ Organized storage by customer/brand agent"
echo "✅ Public URLs ready for immediate distribution"
echo "✅ Automatic validation and metadata tracking"
echo "✅ Easy cleanup by directory structure"

# Clean up
rm -f upload-payload.json
echo ""
echo "🧹 Cleaned up temporary files"