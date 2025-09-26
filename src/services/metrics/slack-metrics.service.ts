import { v4 as uuidv4 } from "uuid";

import type { MetricEntry, SlackMetrics } from "../../types/metrics.js";

export interface SlackConfig {
  bot_token: string;
}

interface _SlackChannelInfo {
  channel: {
    id: string;
    name: string;
    num_members: number;
    purpose: {
      creator: string;
      last_set: number;
      value: string;
    };
    topic: {
      creator: string;
      last_set: number;
      value: string;
    };
  };
  error?: string;
  ok: boolean;
}

interface SlackChannelsList {
  channels: Array<{
    id: string;
    is_archived: boolean;
    is_member: boolean;
    is_private: boolean;
    name: string;
    num_members: number;
  }>;
  error?: string;
  ok: boolean;
}

interface SlackUsersList {
  error?: string;
  members: Array<{
    deleted: boolean;
    id: string;
    is_app_user?: boolean;
    is_bot: boolean;
    name: string;
    profile?: {
      display_name?: string;
      real_name?: string;
    };
  }>;
  ok: boolean;
}

export class SlackMetricsService {
  private baseUrl = "https://slack.com/api";
  private config: SlackConfig;

  constructor(config: SlackConfig) {
    this.config = config;
  }

  /**
   * Collect Slack team-wide metrics
   */
  async collectSlackMetrics(
    customerId?: number,
    refreshSource: "api_call" | "cron" | "manual" = "manual",
  ): Promise<{ metrics: MetricEntry[]; slackMetrics: SlackMetrics }> {
    const startTime = Date.now();

    try {
      const [channelsList, usersList] = await Promise.all([
        this.getChannelsList(),
        this.getUsersList(),
      ]);

      // Get message counts for channels where bot is a member
      const messageCounts = await this.getChannelMessageCounts(
        channelsList.channels,
      );

      // Calculate team metrics (note: only public channels are fetched)
      const activeChannels = channelsList.channels.filter(
        (ch: { is_archived: boolean }) => !ch.is_archived,
      );
      const publicChannels = activeChannels; // All fetched channels are public
      const realUsers = usersList.members.filter(
        (user: { deleted: boolean; id: string; is_bot: boolean }) =>
          !user.deleted && !user.is_bot && user.id !== "USLACKBOT",
      );

      const totalChannelMemberships = activeChannels.reduce(
        (sum: number, ch: { num_members: number }) => sum + ch.num_members,
        0,
      );
      const avgMembersPerChannel =
        activeChannels.length > 0
          ? Math.round(totalChannelMemberships / activeChannels.length)
          : 0;

      const slackMetrics: SlackMetrics = {
        active_participants_today: messageCounts.active_participants_today,
        avg_members_per_channel: avgMembersPerChannel,
        largest_channel_size: Math.max(
          ...activeChannels.map(
            (ch: { num_members: number }) => ch.num_members,
          ),
          0,
        ),
        messages_this_week: messageCounts.messages_this_week,
        messages_today: messageCounts.messages_today,
        most_active_channel: messageCounts.most_active_channel,
        public_channels: publicChannels.length,
        team_members: realUsers.length,
        total_channels: activeChannels.length,
      };

      const collectionDuration = Date.now() - startTime;

      const metrics: MetricEntry[] = [
        this.createMetricEntry(
          "slack",
          "team_members",
          slackMetrics.team_members,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "slack",
          "total_channels",
          slackMetrics.total_channels,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "slack",
          "public_channels",
          slackMetrics.public_channels,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "slack",
          "avg_members_per_channel",
          slackMetrics.avg_members_per_channel,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "slack",
          "largest_channel_size",
          slackMetrics.largest_channel_size,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "slack",
          "messages_today",
          slackMetrics.messages_today,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "slack",
          "messages_this_week",
          slackMetrics.messages_this_week,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "slack",
          "active_participants_today",
          slackMetrics.active_participants_today,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "slack",
          "team_overview",
          undefined,
          slackMetrics as unknown as Record<string, unknown>,
          customerId,
          refreshSource,
          collectionDuration,
        ),
      ];

      return { metrics, slackMetrics };
    } catch (error) {
      throw new Error(
        `Failed to collect Slack metrics: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Test Slack API connection
   */
  async testConnection(): Promise<{
    error?: string;
    success: boolean;
    user?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/auth.test`, {
        headers: {
          Authorization: `Bearer ${this.config.bot_token}`,
          "Content-Type": "application/json",
        },
        method: "GET",
      });

      const data = (await response.json()) as {
        error?: string;
        ok: boolean;
        user?: string;
      };

      if (!data.ok) {
        return { error: data.error, success: false };
      }

      return { success: true, user: data.user };
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
   * Get message counts across channels where the bot is a member
   */
  private async getChannelMessageCounts(
    channels: Array<{
      id: string;
      is_archived: boolean;
      is_member: boolean;
      name: string;
    }>,
  ): Promise<{
    active_participants_today: number;
    messages_this_week: number;
    messages_today: number;
    most_active_channel?: string;
  }> {
    let totalMessagesToday = 0;
    let totalMessagesWeek = 0;
    const allParticipantsToday = new Set<string>();
    let mostActiveChannel: string | undefined;
    let maxChannelMessages = 0;

    // Only check channels where bot is a member or try all if we want to attempt
    const channelsToCheck = channels.filter((ch) => !ch.is_archived);

    console.log(
      `📊 Checking messages in ${channelsToCheck.length} channels...`,
    );

    for (const channel of channelsToCheck.slice(0, 5)) {
      // Limit to first 5 channels to avoid rate limits
      try {
        const [todayMessages, weekMessages] = await Promise.all([
          this.getChannelMessages(channel.id, 1), // Last 24 hours
          this.getChannelMessages(channel.id, 7), // Last 7 days
        ]);

        totalMessagesToday += todayMessages.total_messages;
        totalMessagesWeek += weekMessages.total_messages;

        // Track participants from today's messages
        todayMessages.participants.forEach((participant) =>
          allParticipantsToday.add(participant),
        );

        // Track most active channel
        if (weekMessages.total_messages > maxChannelMessages) {
          maxChannelMessages = weekMessages.total_messages;
          mostActiveChannel = channel.name;
        }

        console.log(
          `   ✅ ${channel.name}: ${todayMessages.total_messages} today, ${weekMessages.total_messages} this week`,
        );
      } catch (error) {
        console.log(
          `   ⚠️  ${channel.name}: ${error instanceof Error ? error.message : "Failed to fetch"}`,
        );
        // Continue with other channels even if one fails
      }
    }

    if (channelsToCheck.length > 5) {
      console.log(
        `   ℹ️  Note: Limited to first 5 channels to avoid rate limits. Total channels: ${channelsToCheck.length}`,
      );
    }

    return {
      active_participants_today: allParticipantsToday.size,
      messages_this_week: totalMessagesWeek,
      messages_today: totalMessagesToday,
      most_active_channel: mostActiveChannel,
    };
  }

  /**
   * Get messages from a specific channel for the specified number of days back
   */
  private async getChannelMessages(
    channelId: string,
    daysBack: number,
  ): Promise<{
    participants: string[];
    total_messages: number;
  }> {
    try {
      const oldest = Math.floor(
        (Date.now() - daysBack * 24 * 60 * 60 * 1000) / 1000,
      );

      const url = new URL(`${this.baseUrl}/conversations.history`);
      url.searchParams.append("channel", channelId);
      url.searchParams.append("oldest", oldest.toString());
      url.searchParams.append("limit", "100"); // Limit to avoid rate limits

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.config.bot_token}`,
          "Content-Type": "application/json",
        },
        method: "GET",
      });

      const data = (await response.json()) as {
        error?: string;
        messages: Array<{
          text?: string;
          ts: string;
          type: string;
          user?: string;
        }>;
        ok: boolean;
      };

      if (!data.ok) {
        throw new Error(`Slack API error: ${data.error}`);
      }

      const messages = data.messages.filter(
        (msg) =>
          msg.type === "message" && msg.user && !msg.text?.startsWith("<"),
      );

      const participants = [
        ...new Set(messages.map((msg) => msg.user).filter(Boolean)),
      ];

      return {
        participants: participants as string[],
        total_messages: messages.length,
      };
    } catch {
      // Return zeros instead of throwing to allow other channels to be processed
      return {
        participants: [],
        total_messages: 0,
      };
    }
  }

  /**
   * Get list of all channels in the workspace
   */
  private async getChannelsList(): Promise<{
    channels: Array<{
      id: string;
      is_archived: boolean;
      is_member: boolean;
      is_private: boolean;
      name: string;
      num_members: number;
    }>;
  }> {
    try {
      const url = new URL(`${this.baseUrl}/conversations.list`);
      url.searchParams.append("types", "public_channel");
      url.searchParams.append("limit", "1000");

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.config.bot_token}`,
          "Content-Type": "application/json",
        },
        method: "GET",
      });

      const data = (await response.json()) as SlackChannelsList;

      if (!data.ok) {
        throw new Error(`Slack API error: ${data.error}`);
      }

      return {
        channels: data.channels.map((ch) => ({
          id: ch.id,
          is_archived: ch.is_archived,
          is_member: ch.is_member,
          is_private: ch.is_private,
          name: ch.name,
          num_members: ch.num_members,
        })),
      };
    } catch (error) {
      console.error("Error fetching Slack channels list:", error);
      return { channels: [] };
    }
  }

  /**
   * Get list of all users in the workspace
   */
  private async getUsersList(): Promise<{
    members: Array<{
      deleted: boolean;
      id: string;
      is_app_user?: boolean;
      is_bot: boolean;
      name: string;
      profile?: { display_name?: string; real_name?: string };
    }>;
  }> {
    try {
      const url = new URL(`${this.baseUrl}/users.list`);
      url.searchParams.append("limit", "1000");

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.config.bot_token}`,
          "Content-Type": "application/json",
        },
        method: "GET",
      });

      const data = (await response.json()) as SlackUsersList;

      if (!data.ok) {
        throw new Error(`Slack API error: ${data.error}`);
      }

      return {
        members: data.members.map((member) => ({
          deleted: member.deleted,
          id: member.id,
          is_app_user: member.is_app_user,
          is_bot: member.is_bot,
          name: member.name,
          profile: member.profile,
        })),
      };
    } catch (error) {
      console.error("Error fetching Slack users list:", error);
      return { members: [] };
    }
  }
}
