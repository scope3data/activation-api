export interface ApiUsageMetrics {
  avg_response_time_ms: number;
  cache_hit_rate?: number;
  most_used_tool: string;
  most_used_tool_count: number;
  success_rate: number;
  tool_breakdown: Record<string, number>;
  total_api_calls: number;
  unique_customers: number;
}

export interface ComprehensiveMetrics {
  api_usage: ApiUsageMetrics;
  collected_at: Date;
  collection_duration_ms: number;
  fun_facts: string[];
  github?: GitHubMetrics;
  platform: PlatformMetrics;
  refresh_sources: string[];
  slack?: SlackMetrics;
  trends?: MetricsTrends;
}

export interface GitHubMetrics {
  activation_api_repo: GitHubRepoMetrics;
  adcp_repo: GitHubRepoMetrics;
}

export interface GitHubRepoMetrics {
  contributors: number;
  latest_release?: string;
  latest_release_days_ago?: number;
  merged_prs_this_week: number;
  open_issues: number;
  open_prs: number;
  stars: number;
}

export interface MetricEntry {
  collected_at: Date;
  collection_duration_ms?: number;
  customer_id?: number;
  id: string;
  metric_category: string;
  metric_json?: Record<string, unknown>;
  metric_name: string;
  metric_value?: number;
  refresh_source: "api_call" | "cron" | "manual";
}

export interface MetricsConfig {
  collection_timeout_ms: number;
  github_activation_repo: string;
  github_adcp_repo: string;
  github_token?: string;
  max_cache_age_minutes: number;
  posthog_project_id?: string;
  slack_bot_token?: string;
}

export interface MetricsTrends {
  api_calls_day: TrendData;
  brand_agents_week: TrendData;
  campaigns_week: TrendData;
  slack_members_week: TrendData;
}

export interface PlatformMetrics {
  active_campaigns: number;
  active_sales_agents: number;
  brand_agents: number;
  customers: number;
  deployed_tactics: number;
  display_creatives: number;
  draft_campaigns: number;
  products_discovered?: number;
  total_creatives: number;
  video_creatives: number;
}

export interface RefreshMetricsParams extends Record<string, unknown> {
  force_refresh?: boolean;
  include_github?: boolean;
  include_slack?: boolean;
}

export interface ShowMetricsParams extends Record<string, unknown> {
  include_github?: boolean;
  include_slack?: boolean;
  max_age_minutes?: number;
  refresh?: boolean;
}

export interface SlackMetrics {
  active_participants_today: number;
  avg_members_per_channel: number;
  largest_channel_size: number;
  messages_this_week: number;
  messages_today: number;
  most_active_channel?: string;
  public_channels: number;
  team_members: number;
  total_channels: number;
}

export interface TrendData {
  change_percent: number;
  current: number;
  previous: number;
  trend_direction: "down" | "flat" | "up";
  trend_emoji: "➡️" | "📈" | "📉";
}
