import type { BigQuery } from "@google-cloud/bigquery";

export interface FunFact {
  category: "achievement" | "growth" | "performance" | "usage";
  emoji: string;
  text: string;
}

export class FunFactsGeneratorService {
  private bigQuery: BigQuery;
  private dataset: string;
  private projectId: string;

  constructor(
    bigQuery: BigQuery,
    projectId = "bok-playground",
    dataset = "agenticapi",
  ) {
    this.bigQuery = bigQuery;
    this.projectId = projectId;
    this.dataset = dataset;
  }

  /**
   * Generate dynamic fun facts based on actual business data
   */
  async generateFunFacts(): Promise<FunFact[]> {
    const facts: FunFact[] = [];

    try {
      // Generate business insights from different data sources
      facts.push(...(await this.generateCampaignInsights()));
      facts.push(...(await this.generateCreativeInsights()));
      facts.push(...(await this.generateSalesAgentInsights()));
      facts.push(...(await this.generateTacticsInsights()));
      facts.push(...(await this.generateToolUsageInsights()));
      facts.push(...(await this.generateSlackInsights()));
      facts.push(...(await this.generateGitHubInsights()));

      // Return up to 3 random facts (only if we have data)
      return this.selectRandomFacts(facts, 3);
    } catch (error) {
      console.error("Error generating fun facts:", error);
      return []; // No fallbacks - if we can't get real data, show nothing
    }
  }

  /**
   * Generate insights from campaign data
   */
  private async generateCampaignInsights(): Promise<FunFact[]> {
    const facts: FunFact[] = [];

    try {
      const [results] = await this.bigQuery.query({
        query: `
          SELECT 
            COUNT(*) as total_campaigns,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_campaigns,
            ROUND(SUM(budget_total), 0) as total_budget,
            MAX(budget_total) as highest_budget,
            COUNT(DISTINCT brand_agent_id) as unique_brand_agents
          FROM \`${this.projectId}.${this.dataset}.campaigns\`
          WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)
            OR created_at IS NULL
        `,
      });

      if (results.length > 0) {
        const data = results[0];

        if (data.total_budget && data.total_budget > 10000) {
          facts.push({
            category: "achievement",
            emoji: "💎",
            text: `$${data.total_budget.toLocaleString()} in campaign budgets allocated this month! 💰`,
          });
        }

        if (data.highest_budget && data.highest_budget > 5000) {
          facts.push({
            category: "achievement",
            emoji: "🎯",
            text: `Highest campaign budget this month: $${data.highest_budget.toLocaleString()} - someone's going big! 🚀`,
          });
        }

        if (data.active_campaigns && data.active_campaigns > 10) {
          facts.push({
            category: "usage",
            emoji: "🔥",
            text: `${data.active_campaigns} campaigns actively running - the ad engines are firing! ⚡`,
          });
        }
      }
    } catch (error) {
      console.error("Error generating campaign insights:", error);
    }

    return facts;
  }

  /**
   * Generate insights from creative data
   */
  private async generateCreativeInsights(): Promise<FunFact[]> {
    const facts: FunFact[] = [];

    try {
      const [results] = await this.bigQuery.query({
        query: `
          SELECT 
            COUNT(*) as total_creatives,
            format_type,
            COUNT(*) as format_count
          FROM \`${this.projectId}.${this.dataset}.creatives\`
          WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)
            OR created_at IS NULL
          GROUP BY format_type
          ORDER BY format_count DESC
        `,
      });

      if (results.length > 0) {
        const topFormat = results[0];
        const totalCreatives = results.reduce(
          (sum, row) => sum + row.format_count,
          0,
        );

        if (totalCreatives > 20) {
          facts.push({
            category: "achievement",
            emoji: "🎭",
            text: `${totalCreatives} creative assets produced this month - the content factory is humming! 🎨`,
          });
        }

        if (topFormat.format_type && topFormat.format_count > 5) {
          const percentage = Math.round(
            (topFormat.format_count / totalCreatives) * 100,
          );
          facts.push({
            category: "usage",
            emoji: "🏆",
            text: `${topFormat.format_type} creatives dominate with ${percentage}% market share this month! 📊`,
          });
        }
      }
    } catch (error) {
      console.error("Error generating creative insights:", error);
    }

    return facts;
  }

  /**
   * Generate insights from GitHub metrics
   */
  private async generateGitHubInsights(): Promise<FunFact[]> {
    const facts: FunFact[] = [];

    try {
      const [recentMetrics] = await this.bigQuery.query({
        query: `
          SELECT 
            metric_name,
            metric_value
          FROM \`${this.projectId}.${this.dataset}.latest_metrics\`
          WHERE metric_category = 'github'
            AND collected_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
        `,
      });

      const adcpStars = recentMetrics.find(
        (m) => m.metric_name === "adcp_stars",
      )?.metric_value;
      const totalContributors = recentMetrics.find(
        (m) => m.metric_name === "total_contributors",
      )?.metric_value;

      if (adcpStars && adcpStars > 20) {
        facts.push({
          category: "achievement",
          emoji: "🌟",
          text: `ADCP protocol has ${adcpStars} GitHub stars - the community is growing! ⭐`,
        });
      }

      if (totalContributors && totalContributors > 10) {
        facts.push({
          category: "growth",
          emoji: "👩‍💻",
          text: `${totalContributors} developers contributing to the ecosystem - open source power! 💪`,
        });
      }
    } catch (error) {
      console.error("Error generating GitHub insights:", error);
    }

    return facts;
  }

  /**
   * Generate insights from sales agent data
   */
  private async generateSalesAgentInsights(): Promise<FunFact[]> {
    const facts: FunFact[] = [];

    try {
      const [results] = await this.bigQuery.query({
        query: `
          SELECT 
            COUNT(*) as total_agents,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_agents,
            COUNT(DISTINCT org_id) as unique_orgs
          FROM \`${this.projectId}.${this.dataset}.sales_agents\`
          WHERE added_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)
            OR added_at IS NULL
        `,
      });

      if (results.length > 0) {
        const data = results[0];

        if (data.active_agents && data.active_agents > 10) {
          facts.push({
            category: "achievement",
            emoji: "🚀",
            text: `${data.active_agents} sales agents ready to move inventory - the marketplace is alive! 🤝`,
          });
        }

        if (data.unique_orgs && data.unique_orgs > 5) {
          facts.push({
            category: "growth",
            emoji: "🔗",
            text: `Connected to ${data.unique_orgs} publisher organizations - building the ecosystem! 🌐`,
          });
        }
      }
    } catch (error) {
      console.error("Error generating sales agent insights:", error);
    }

    return facts;
  }

  /**
   * Generate insights from Slack metrics
   */
  private async generateSlackInsights(): Promise<FunFact[]> {
    const facts: FunFact[] = [];

    try {
      const [recentMetrics] = await this.bigQuery.query({
        query: `
          SELECT 
            metric_name,
            metric_value
          FROM \`${this.projectId}.${this.dataset}.latest_metrics\`
          WHERE metric_category = 'slack'
            AND collected_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
        `,
      });

      const teamMembers = recentMetrics.find(
        (m) => m.metric_name === "team_members",
      )?.metric_value;
      const messagesWeek = recentMetrics.find(
        (m) => m.metric_name === "messages_this_week",
      )?.metric_value;

      if (teamMembers && teamMembers > 100) {
        facts.push({
          category: "achievement",
          emoji: "🚀",
          text: `${teamMembers} team members strong - building the future of agentic advertising! 👥`,
        });
      }

      if (messagesWeek && messagesWeek > 100) {
        facts.push({
          category: "usage",
          emoji: "💬",
          text: `${messagesWeek} messages this week - the team collaboration is on fire! 🔥`,
        });
      }
    } catch (error) {
      console.error("Error generating Slack insights:", error);
    }

    return facts;
  }

  /**
   * Generate insights from tactics (media purchases)
   */
  private async generateTacticsInsights(): Promise<FunFact[]> {
    const facts: FunFact[] = [];

    try {
      const [results] = await this.bigQuery.query({
        query: `
          SELECT 
            COUNT(*) as total_tactics,
            ROUND(SUM(budget_amount), 0) as total_media_spend,
            MAX(budget_amount) as largest_tactic_budget,
            COUNT(DISTINCT sales_agent_id) as unique_sales_agents_used
          FROM \`${this.projectId}.${this.dataset}.tactics\`
          WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)
            OR created_at IS NULL
        `,
      });

      if (results.length > 0) {
        const data = results[0];

        if (data.total_media_spend && data.total_media_spend > 50000) {
          facts.push({
            category: "achievement",
            emoji: "💰",
            text: `$${data.total_media_spend.toLocaleString()} in media spend flowing through tactics this month! 💸`,
          });
        }

        if (data.largest_tactic_budget && data.largest_tactic_budget > 10000) {
          facts.push({
            category: "achievement",
            emoji: "🎯",
            text: `Biggest media buy this month: $${data.largest_tactic_budget.toLocaleString()} - someone's making moves! 📈`,
          });
        }

        if (
          data.unique_sales_agents_used &&
          data.unique_sales_agents_used > 5
        ) {
          facts.push({
            category: "usage",
            emoji: "🔥",
            text: `${data.unique_sales_agents_used} different sales agents closing deals - diversified marketplace! 🤝`,
          });
        }
      }
    } catch (error) {
      console.error("Error generating tactics insights:", error);
    }

    return facts;
  }

  /**
   * Generate insights from PostHog tool usage
   */
  private async generateToolUsageInsights(): Promise<FunFact[]> {
    const facts: FunFact[] = [];

    try {
      // Get recent metrics data from our metrics table
      const [recentMetrics] = await this.bigQuery.query({
        query: `
          SELECT 
            metric_name,
            metric_value
          FROM \`${this.projectId}.${this.dataset}.latest_metrics\`
          WHERE metric_category = 'api_usage'
            AND collected_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
        `,
      });

      for (const metric of recentMetrics) {
        if (
          metric.metric_name === "daily_api_calls" &&
          metric.metric_value > 500
        ) {
          facts.push({
            category: "usage",
            emoji: "🚀",
            text: `${metric.metric_value.toLocaleString()} API calls today - developers are building! ⚡`,
          });
        }

        if (
          metric.metric_name === "auth_events_today" &&
          metric.metric_value > 50
        ) {
          facts.push({
            category: "usage",
            emoji: "👥",
            text: `${metric.metric_value} login events today - users are engaged! 🔐`,
          });
        }
      }
    } catch (error) {
      console.error("Error generating tool usage insights:", error);
    }

    return facts;
  }

  private selectRandomFacts(facts: FunFact[], count: number): FunFact[] {
    const shuffled = [...facts].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }
}
