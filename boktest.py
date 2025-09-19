"""
Scope3 Campaign API Agent with Claude

This example demonstrates how to create an interactive agent that can use the Scope3 Campaign API
via Model Context Protocol (MCP) with Claude as the reasoning engine.

Requirements:
- Python 3.8+
- API keys for both Scope3 and Anthropic (Claude)

Installation:
    pip install langchain-mcp-adapters langgraph langchain-anthropic python-dotenv

Environment Setup:
    Create a .env file with:
    SCOPE3_API_KEY=your_scope3_api_key_here
    ANTHROPIC_API_KEY=your_anthropic_api_key_here
"""

import asyncio
import os
from dotenv import load_dotenv
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent
from langchain_anthropic import ChatAnthropic

# Load environment variables
load_dotenv()


async def main():
    """Main function to run the Scope3 agent with Claude."""

    # Validate API keys
    scope3_key = os.getenv('SCOPE3_API_KEY')
    anthropic_key = os.getenv('ANTHROPIC_API_KEY')

    if not scope3_key:
        print("Error: SCOPE3_API_KEY not found in .env file")
        print("Please add your Scope3 API key to the .env file")
        return

    if not anthropic_key:
        print("Error: ANTHROPIC_API_KEY not found in .env file")
        print("Please add your Anthropic API key to the .env file")
        return

    print("Connecting to Scope3 Campaign API...")

    # Initialize MCP client for Scope3 API
    client = MultiServerMCPClient(
        {
            "scope3": {
                "transport": "streamable_http",
                "url": "https://api.agentic.scope3.com/mcp",
                "headers": {
                    "Authorization": f"Bearer {scope3_key}"
                },
            }
        }
    )

    # Initialize Claude model
    model = ChatAnthropic(
        model="claude-3-5-sonnet-20241022",
        anthropic_api_key=anthropic_key,
        temperature=0,
        max_tokens=4096
    )

    # Load tools from Scope3 API
    tools = await client.get_tools()
    print(f"Successfully loaded {len(tools)} tools from Scope3 API")

    # Create the agent with Claude and Scope3 tools
    agent = create_react_agent(model, tools)

    # Start interactive session
    print("\n🤖 Scope3 Agent Ready!")
    print("You can now interact with your Scope3 Campaign API data.")
    print("Type 'quit', 'exit', or 'bye' to end the session.\n")

    while True:
        try:
            user_input = input("You: ")

            if user_input.lower() in ['quit', 'exit', 'bye']:
                print("Goodbye!")
                break

            # Process user input and get response
            response = await agent.ainvoke({"messages": user_input})

            # Extract and display the agent's response
            ai_message = response['messages'][-1].content
            print(f"\nAgent: {ai_message}\n")

        except KeyboardInterrupt:
            print("\nGoodbye!")
            break
        except Exception as e:
            print(f"\nError: {e}")
            print("Please try again or type 'quit' to exit.\n")


if __name__ == "__main__":
    asyncio.run(main())
