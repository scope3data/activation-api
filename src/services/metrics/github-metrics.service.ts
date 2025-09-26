import { Octokit } from "@octokit/core";
import { v4 as uuidv4 } from "uuid";

import type {
  GitHubMetrics,
  GitHubRepoMetrics,
  MetricEntry,
} from "../../types/metrics.js";

export interface GitHubConfig {
  activation_api_repo: string; // Format: "owner/repo"
  adcp_repo: string; // Format: "owner/repo"
  token: string;
}

export class GitHubMetricsService {
  private config: GitHubConfig;
  private octokit: Octokit;
  private unauthenticatedOctokit: Octokit;

  constructor(config: GitHubConfig) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.token,
    });
    this.unauthenticatedOctokit = new Octokit();
  }

  /**
   * Collect GitHub metrics for all configured repositories
   */
  async collectGitHubMetrics(
    customerId?: number,
    refreshSource: "api_call" | "cron" | "manual" = "manual",
  ): Promise<{ githubMetrics: GitHubMetrics; metrics: MetricEntry[] }> {
    const startTime = Date.now();

    try {
      const [adcpRepo, activationRepo] = await Promise.all([
        this.getRepositoryMetrics(this.config.adcp_repo),
        this.getRepositoryMetrics(this.config.activation_api_repo),
      ]);

      const githubMetrics: GitHubMetrics = {
        activation_api_repo: activationRepo,
        adcp_repo: adcpRepo,
      };

      const collectionDuration = Date.now() - startTime;

      const metrics: MetricEntry[] = [
        // ADCP Repository metrics
        this.createMetricEntry(
          "github",
          "adcp_open_prs",
          adcpRepo.open_prs,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "github",
          "adcp_merged_prs_this_week",
          adcpRepo.merged_prs_this_week,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "github",
          "adcp_contributors",
          adcpRepo.contributors,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "github",
          "adcp_stars",
          adcpRepo.stars,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "github",
          "adcp_open_issues",
          adcpRepo.open_issues,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),

        // Activation API Repository metrics
        this.createMetricEntry(
          "github",
          "activation_api_open_prs",
          activationRepo.open_prs,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "github",
          "activation_api_merged_prs_this_week",
          activationRepo.merged_prs_this_week,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "github",
          "activation_api_contributors",
          activationRepo.contributors,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "github",
          "activation_api_stars",
          activationRepo.stars,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "github",
          "activation_api_open_issues",
          activationRepo.open_issues,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),

        // Composite metrics as JSON
        this.createMetricEntry(
          "github",
          "all_repositories",
          undefined,
          githubMetrics as unknown as Record<string, unknown>,
          customerId,
          refreshSource,
          collectionDuration,
        ),
      ];

      // Add release information if available
      if (adcpRepo.latest_release) {
        metrics.push(
          this.createMetricEntry(
            "github",
            "adcp_latest_release",
            adcpRepo.latest_release_days_ago,
            { release_name: adcpRepo.latest_release },
            customerId,
            refreshSource,
            collectionDuration,
          ),
        );
      }

      if (activationRepo.latest_release) {
        metrics.push(
          this.createMetricEntry(
            "github",
            "activation_api_latest_release",
            activationRepo.latest_release_days_ago,
            { release_name: activationRepo.latest_release },
            customerId,
            refreshSource,
            collectionDuration,
          ),
        );
      }

      return { githubMetrics, metrics };
    } catch (error) {
      throw new Error(
        `Failed to collect GitHub metrics: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Test GitHub API connection
   */
  async testConnection(): Promise<{
    error?: string;
    success: boolean;
    user?: string;
  }> {
    try {
      const { data } = await this.octokit.request("GET /user");
      return { success: true, user: data.login };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        success: false,
      };
    }
  }

  /**
   * Helper to create metric entries
   */
  private createMetricEntry(
    category: string,
    name: string,
    value?: number,
    json?: Record<string, unknown>,
    customerId?: number,
    refreshSource: "api_call" | "cron" | "manual" = "manual",
    collectionDuration?: number,
  ): MetricEntry {
    return {
      collected_at: new Date(),
      collection_duration_ms: collectionDuration,
      customer_id: customerId,
      id: uuidv4(),
      metric_category: category,
      metric_json: json,
      metric_name: name,
      metric_value: value,
      refresh_source: refreshSource,
    };
  }

  /**
   * Get comprehensive metrics for a single repository
   */
  private async getRepositoryMetrics(repo: string): Promise<GitHubRepoMetrics> {
    const [owner, repoName] = repo.split("/");

    if (!owner || !repoName) {
      throw new Error(
        `Invalid repository format: ${repo}. Expected "owner/repo"`,
      );
    }

    try {
      const results = await this.tryWithFallback([
        {
          params: { owner, repo: repoName },
          path: "GET /repos/{owner}/{repo}",
        },
        {
          params: { owner, repo: repoName, state: "open" },
          path: "GET /repos/{owner}/{repo}/pulls",
        },
        {
          params: {
            direction: "desc",
            owner,
            per_page: 100,
            repo: repoName,
            sort: "updated",
            state: "closed",
          },
          path: "GET /repos/{owner}/{repo}/pulls",
        },
        {
          params: {
            filter: "all",
            owner,
            repo: repoName,
            state: "open",
          },
          path: "GET /repos/{owner}/{repo}/issues",
        },
        {
          params: {
            owner,
            per_page: 100,
            repo: repoName,
          },
          path: "GET /repos/{owner}/{repo}/contributors",
        },
        {
          params: { owner, repo: repoName },
          path: "GET /repos/{owner}/{repo}/releases/latest",
        },
      ]);

      const [
        repoInfo,
        openPulls,
        recentMergedPulls,
        openIssues,
        contributors,
        latestRelease,
      ] = results;

      // Extract basic repo info
      let stars = 0;
      if (repoInfo.status === "fulfilled") {
        stars = (repoInfo.value.data as { stargazers_count: number })
          .stargazers_count;
      }

      // Count open PRs
      let openPrs = 0;
      if (openPulls.status === "fulfilled") {
        openPrs = (openPulls.value.data as unknown[]).length;
      }

      // Count merged PRs from last week
      let mergedPrsThisWeek = 0;
      if (recentMergedPulls.status === "fulfilled") {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        mergedPrsThisWeek = (
          recentMergedPulls.value.data as {
            merged_at?: string;
            state: string;
          }[]
        ).filter(
          (pr: { merged_at?: string; state: string }) =>
            pr.merged_at &&
            new Date(pr.merged_at) > oneWeekAgo &&
            pr.state === "closed",
        ).length;
      }

      // Count open issues (excluding PRs)
      let openIssuesCount = 0;
      if (openIssues.status === "fulfilled") {
        openIssuesCount = (
          openIssues.value.data as { pull_request?: unknown }[]
        ).filter(
          (issue: { pull_request?: unknown }) => !issue.pull_request,
        ).length;
      }

      // Count contributors
      let contributorsCount = 0;
      if (contributors.status === "fulfilled") {
        contributorsCount = (contributors.value.data as unknown[]).length;
      }

      // Get latest release info
      let latestReleaseInfo: {
        latest_release?: string;
        latest_release_days_ago?: number;
      } = {};

      if (latestRelease.status === "fulfilled") {
        const releaseData = latestRelease.value.data as {
          created_at?: string;
          published_at?: string;
          tag_name: string;
        };
        const releaseDate = new Date(
          releaseData.published_at ||
            releaseData.created_at ||
            new Date().toISOString(),
        );
        const daysAgo = Math.floor(
          (Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        latestReleaseInfo = {
          latest_release: releaseData.tag_name,
          latest_release_days_ago: daysAgo,
        };
      }

      return {
        contributors: contributorsCount,
        merged_prs_this_week: mergedPrsThisWeek,
        open_issues: openIssuesCount,
        open_prs: openPrs,
        stars,
        ...latestReleaseInfo,
      };
    } catch (error) {
      console.error(`Error fetching metrics for ${repo}:`, error);
      // Return zeros for failed repositories rather than failing completely
      return {
        contributors: 0,
        merged_prs_this_week: 0,
        open_issues: 0,
        open_prs: 0,
        stars: 0,
      };
    }
  }

  /**
   * Try API requests with authenticated client, fallback to unauthenticated for public repos
   */
  private async tryWithFallback(
    requests: Array<{ params: Record<string, unknown>; path: string }>,
  ): Promise<PromiseSettledResult<{ data: unknown }>[]> {
    // Try with authenticated client first
    const authResults = await Promise.allSettled(
      requests.map((req) =>
        this.octokit.request(req.path as string, req.params),
      ),
    );

    // Check if any requests failed due to authentication issues
    const hasAuthFailures = authResults.some(
      (result) =>
        result.status === "rejected" &&
        result.reason?.status === 403 &&
        result.reason?.message?.includes(
          "forbids access via a fine-grained personal access token",
        ),
    );

    if (hasAuthFailures) {
      console.warn(
        "Some GitHub requests failed due to organization token policy, falling back to unauthenticated requests",
      );

      // Fallback to unauthenticated requests for public repositories
      return await Promise.allSettled(
        requests.map((req) =>
          this.unauthenticatedOctokit.request(req.path as string, req.params),
        ),
      );
    }

    return authResults;
  }
}
