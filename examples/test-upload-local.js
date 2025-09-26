#!/usr/bin/env node

/**
 * Local test script for MCP asset upload
 * Tests the assets_upload tool with the wonderstruck_shroom_300x250.jpg file
 */

import { readFileSync } from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testAssetUpload() {
  console.log('🧪 Testing MCP Asset Upload Interface');
  
  try {
    // Read and encode the image file
    console.log('📖 Reading wonderstruck_shroom_300x250.jpg...');
    const imageBuffer = readFileSync('./wonderstruck_shroom_300x250.jpg');
    const base64Data = imageBuffer.toString('base64');
    
    console.log(`📊 File size: ${imageBuffer.length} bytes`);
    console.log(`📝 Base64 length: ${base64Data.length} characters`);
    
    // Create MCP client
    console.log('🔌 Connecting to MCP server...');
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['dist/server.js']
    });
    
    const client = new Client({
      name: 'asset-upload-test',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
    
    await client.connect(transport);
    console.log('✅ Connected to MCP server');
    
    // Test the assets_upload tool
    console.log('🚀 Testing assets_upload tool...');
    
    const uploadRequest = {
      name: 'assets_upload',
      arguments: {
        assets: [{
          assetType: 'image',
          base64Data: base64Data,
          contentType: 'image/jpeg',
          filename: 'wonderstruck_shroom_300x250.jpg',
          metadata: {
            buyerAgentId: 'test-brand-agent-123',
            tags: ['test', 'mushroom', 'banner']
          }
        }]
      }
    };
    
    console.log('📤 Uploading asset...');
    const result = await client.callTool(uploadRequest);
    
    console.log('✅ Upload completed!');
    console.log('📋 Result:');
    console.log(result.content[0].text);
    
    // Test assets_list_uploads tool
    console.log('\n🔍 Testing assets_list_uploads tool...');
    const listResult = await client.callTool({
      name: 'assets_list_uploads',
      arguments: {
        buyerAgentId: 'test-brand-agent-123'
      }
    });
    
    console.log('📋 Listed assets:');
    console.log(listResult.content[0].text);
    
    // Test assets_analytics tool
    console.log('\n📊 Testing assets_analytics tool...');
    const analyticsResult = await client.callTool({
      name: 'assets_analytics',
      arguments: {
        scope: 'customers'
      }
    });
    
    console.log('📈 Analytics:');
    console.log(analyticsResult.content[0].text);
    
    await client.close();
    console.log('🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.message) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  }
}

// Run the test
testAssetUpload().catch(console.error);