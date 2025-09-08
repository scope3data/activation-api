// GraphQL queries for reporting operations

// Campaign delivery data
export const GET_CAMPAIGN_DELIVERY_DATA_QUERY = `
  query GetCampaignDeliveryData($campaignId: ID!, $startDate: String!, $endDate: String!) {
    campaignDeliveryData(campaignId: $campaignId, startDate: $startDate, endDate: $endDate) {
      campaignId
      dailyDeliveries {
        date
        tacticId
        spend
        currency
        deliveryUnit
        unitsDelivered
        currentPrice
        signalBreakdown
        storyBreakdown
        publisherBreakdown
        lastUpdated
      }
      summary {
        totalSpend
        totalImpressions
        averageCpm
        pacing {
          status
          budgetUtilized
          projectedCompletion
        }
      }
    }
  }
`;

// Tactic breakdown
export const GET_TACTIC_BREAKDOWN_QUERY = `
  query GetTacticBreakdown($campaignId: ID!, $startDate: String!, $endDate: String!) {
    tacticBreakdown(campaignId: $campaignId, startDate: $startDate, endDate: $endDate) {
      tacticId
      name
      spend
      impressions
      conversions
      efficiency
      signals
      stories
      publisherProducts
    }
  }
`;

// Scoring outcomes
export const GET_SCORING_OUTCOMES_QUERY = `
  query GetScoringOutcomes($campaignId: ID!, $startDate: String!, $endDate: String!) {
    scoringOutcomes(campaignId: $campaignId, startDate: $startDate, endDate: $endDate) {
      id
      externalId
      campaignId
      tacticId
      creativeId
      signals
      stories
      exposureRange {
        start
        end
      }
      performanceIndex
      scoring {
        immediate
        delayed
        components
        confidence
      }
      source
      timestamp
      receivedAt
    }
  }
`;

// Campaign tactics
export const GET_CAMPAIGN_TACTICS_QUERY = `
  query GetCampaignTactics($campaignId: ID!) {
    campaignTactics(campaignId: $campaignId) {
      id
      externalId
      campaignId
      startDate
      endDate
      signals
      stories
      publisherProducts
      targetPrice
      dailyBudget
      status
      createdAt
      updatedAt
    }
  }
`;

// Tactic performance
export const GET_TACTIC_PERFORMANCE_QUERY = `
  query GetTacticPerformance($tacticId: ID!, $startDate: String!, $endDate: String!) {
    tacticPerformance(tacticId: $tacticId, startDate: $startDate, endDate: $endDate) {
      tacticId
      totalSpend
      totalImpressions
      totalClicks
      totalConversions
      firstTouchConversions
      lastTouchConversions
      assistedConversions
      averageCpm
      ctr
      cvr
      fillRate
      winRate
      qualityScore
      lastUpdated
    }
  }
`;

// Budget allocations
export const GET_BUDGET_ALLOCATIONS_QUERY = `
  query GetBudgetAllocations($campaignId: ID!, $startDate: String!, $endDate: String!) {
    budgetAllocations(campaignId: $campaignId, startDate: $startDate, endDate: $endDate) {
      campaignId
      tacticId
      date
      allocatedBudget
      utilizedBudget
      utilizationRate
    }
  }
`;

// Webhook subscription mutations
export const CREATE_WEBHOOK_SUBSCRIPTION_MUTATION = `
  mutation CreateWebhookSubscription($input: WebhookSubscriptionInput!) {
    createWebhookSubscription(input: $input) {
      id
      brandAgentId
      endpoint {
        url
        method
        headers
        authentication {
          type
        }
      }
      eventTypes
      filters {
        campaigns
        minSeverity
        metrics
      }
      retryPolicy {
        maxRetries
        backoffMultiplier
        maxBackoffSeconds
      }
      status
      lastDelivery
      consecutiveFailures
      createdAt
      updatedAt
    }
  }
`;

// List webhook subscriptions
export const LIST_WEBHOOK_SUBSCRIPTIONS_QUERY = `
  query ListWebhookSubscriptions($brandAgentId: ID!) {
    webhookSubscriptions(brandAgentId: $brandAgentId) {
      id
      brandAgentId
      endpoint {
        url
        method
      }
      eventTypes
      status
      lastDelivery
      consecutiveFailures
      createdAt
      updatedAt
    }
  }
`;

// Update webhook subscription
export const UPDATE_WEBHOOK_SUBSCRIPTION_MUTATION = `
  mutation UpdateWebhookSubscription($id: ID!, $input: WebhookSubscriptionUpdateInput!) {
    updateWebhookSubscription(id: $id, input: $input) {
      id
      status
      updatedAt
    }
  }
`;

// Delete webhook subscription
export const DELETE_WEBHOOK_SUBSCRIPTION_MUTATION = `
  mutation DeleteWebhookSubscription($id: ID!) {
    deleteWebhookSubscription(id: $id) {
      success
    }
  }
`;

// Create scoring outcome
export const CREATE_SCORING_OUTCOME_MUTATION = `
  mutation CreateScoringOutcome($input: ScoringOutcomeInput!) {
    createScoringOutcome(input: $input) {
      id
      campaignId
      tacticId
      exposureRange {
        start
        end
      }
      performanceIndex
      timestamp
      receivedAt
    }
  }
`;

// Get brand agent campaign with delivery summary
export const GET_BRAND_AGENT_CAMPAIGN_WITH_DELIVERY_QUERY = `
  query GetBrandAgentCampaignWithDelivery($id: ID!) {
    brandAgentCampaign(id: $id) {
      id
      brandAgentId
      name
      prompt
      budget {
        total
        currency
        dailyCap
        pacing
      }
      creativeIds
      audienceIds
      status
      createdAt
      updatedAt
      
      # NEW: Delivery summary
      deliverySummary {
        status
        healthScore
        lastUpdated
        today {
          spend
          impressions
          averagePrice
        }
        pacing {
          budgetUtilized
          daysRemaining
          projectedCompletion
          status
        }
        alerts {
          id
          type
          severity
          message
          details
          actionRequired
          tacticId
          timestamp
          acknowledged
          resolvedAt
        }
      }
      
      # NEW: Notification thresholds
      notificationThresholds {
        spend {
          dailyMax
          totalMax
          pacingVariance
        }
        performance {
          minCtr
          maxCpm
          minConversionRate
        }
        delivery {
          minDailyImpressions
          fillRateThreshold
        }
      }
    }
  }
`;
