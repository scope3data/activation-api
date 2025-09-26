#!/usr/bin/env node

/**
 * MCP over HTTP transport test for asset upload
 * 
 * IMPORTANT: This is NOT a REST API test. This demonstrates how to use
 * the Model Context Protocol (MCP) over HTTP transport (SSE) rather than
 * stdin/stdout. The server is still an MCP server providing MCP tools,
 * but accessible via HTTP transport for integration flexibility.
 * 
 * Uses SSE (Server-Sent Events) transport to send MCP requests over HTTP
 */

import { readFileSync } from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { config } from 'dotenv';

// Load environment variables
config();

async function testAssetUploadHTTP() {
  console.log('🌐 Testing MCP Asset Upload via HTTP Transport (SSE)');
  
  const apiKey = process.env.SCOPE3_API_KEY;
  if (!apiKey) {
    console.error('❌ SCOPE3_API_KEY not found in environment');
    process.exit(1);
  }

  try {
    // Read and encode the image file
    console.log('📖 Reading wonderstruck_shroom_300x250.jpg...');
    const imageBuffer = readFileSync('./wonderstruck_shroom_300x250.jpg');
    const base64Data = imageBuffer.toString('base64');
    
    console.log(`📊 File size: ${imageBuffer.length} bytes`);
    console.log(`📝 Base64 length: ${base64Data.length} characters`);
    
    // Start the MCP server as a background process
    console.log('🚀 Starting MCP server...');
    const { spawn } = await import('child_process');
    const serverProcess = spawn('node', ['dist/server.js'], {
      env: { ...process.env, NODE_ENV: 'development' },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create MCP client with HTTP/SSE transport
    console.log('🔌 Connecting to MCP server via HTTP/SSE transport...');
    const transport = new SSEClientTransport(
      new URL('http://localhost:3000/sse'),
      {
        headers: {
          'x-scope3-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const client = new Client({
      name: 'asset-upload-test-http',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
    
    await client.connect(transport);
    console.log('✅ Connected to MCP server via HTTP/SSE transport');
    
    // Test the assets_upload MCP tool
    console.log('🚀 Testing assets_upload MCP tool...');
    
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
    
    await client.close();
    serverProcess.kill();
    console.log('🎉 MCP over HTTP transport test completed successfully!');
    
  } catch (error) {
    console.error('❌ MCP over HTTP transport test failed:', error);
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
testAssetUploadHTTP().catch(console.error);