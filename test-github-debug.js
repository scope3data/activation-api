#!/usr/bin/env node

// Debug script for GitHub metrics
import dotenv from "dotenv";
import { Octokit } from "@octokit/core";

// Load environment variables
dotenv.config({ path: ".env.local" });

async function debugGitHub() {
  console.log("🔍 Debugging GitHub API access...\n");

  const token = process.env.GITHUB_TOKEN;
  console.log(
    `GitHub Token: ${token ? token.substring(0, 10) + "..." : "NOT SET"}\n`,
  );

  // Test unauthenticated access to public repo
  console.log("1️⃣ Testing unauthenticated access to adcontextprotocol/adcp...");
  try {
    const unauthOctokit = new Octokit();
    const repo = await unauthOctokit.request("GET /repos/{owner}/{repo}", {
      owner: "adcontextprotocol",
      repo: "adcp",
    });
    console.log(
      `✅ Repo found! Stars: ${repo.data.stargazers_count}, Open Issues: ${repo.data.open_issues_count}`,
    );
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
  }

  // Test authenticated access
  if (token) {
    console.log("\n2️⃣ Testing authenticated access...");
    try {
      const authOctokit = new Octokit({ auth: token });
      const repo = await authOctokit.request("GET /repos/{owner}/{repo}", {
        owner: "adcontextprotocol",
        repo: "adcp",
      });
      console.log(
        `✅ Authenticated access works! Stars: ${repo.data.stargazers_count}`,
      );
    } catch (error) {
      console.log(`❌ Authenticated access failed: ${error.message}`);
    }
  }

  // Test conductor/activation-api
  console.log("\n3️⃣ Testing conductor/activation-api access...");
  try {
    const unauthOctokit = new Octokit();
    const repo = await unauthOctokit.request("GET /repos/{owner}/{repo}", {
      owner: "conductor",
      repo: "activation-api",
    });
    console.log(
      `✅ Conductor repo found! Stars: ${repo.data.stargazers_count}, Open Issues: ${repo.data.open_issues_count}`,
    );
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
  }
}

debugGitHub().catch(console.error);
