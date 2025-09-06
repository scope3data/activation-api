// GraphQL queries and mutations for inventory options management

// Mutation to create a new inventory option
export const CREATE_INVENTORY_OPTION_MUTATION = `
  mutation CreateInventoryOption($input: InventoryOptionInput!) {
    createInventoryOption(input: $input) {
      id
      campaignId
      name
      description
      mediaProduct {
        id
        publisherId
        publisherName
        productId
        name
        description
        formats
        deliveryType
        inventoryType
        basePricing {
          model
          fixedCpm
          floorCpm
          targetCpm
        }
        supportedTargeting
        createdAt
        updatedAt
      }
      targeting {
        signalType
        signalProvider
        signalConfiguration {
          audienceIds
          segments
          customParameters
        }
        inheritFromCampaign
        overrides {
          geo
          demographics
          interests
        }
      }
      effectivePricing {
        cpm
        signalCost
        totalCpm
        currency
      }
      budgetAllocation {
        amount
        percentage
        dailyCap
        pacing
        currency
      }
      status
      createdAt
      updatedAt
    }
  }
`;

// Mutation to update an existing inventory option
export const UPDATE_INVENTORY_OPTION_MUTATION = `
  mutation UpdateInventoryOption($id: String!, $input: InventoryOptionUpdateInput!) {
    updateInventoryOption(id: $id, input: $input) {
      id
      campaignId
      name
      description
      mediaProduct {
        id
        publisherId
        publisherName
        productId
        name
        description
        formats
        deliveryType
        inventoryType
        basePricing {
          model
          fixedCpm
          floorCpm
          targetCpm
        }
        supportedTargeting
        createdAt
        updatedAt
      }
      targeting {
        signalType
        signalProvider
        signalConfiguration {
          audienceIds
          segments
          customParameters
        }
        inheritFromCampaign
        overrides {
          geo
          demographics
          interests
        }
      }
      effectivePricing {
        cpm
        signalCost
        totalCpm
        currency
      }
      budgetAllocation {
        amount
        percentage
        dailyCap
        pacing
        currency
      }
      status
      performance {
        impressions
        clicks
        conversions
        spend
        ctr
        cvr
        cpm
        cpc
        cpa
        lastUpdated
      }
      createdAt
      updatedAt
    }
  }
`;

// Query to list all inventory options for a campaign
export const LIST_INVENTORY_OPTIONS_QUERY = `
  query ListInventoryOptions($campaignId: String!) {
    inventoryOptions(campaignId: $campaignId) {
      inventoryOptions {
        id
        campaignId
        name
        description
        mediaProduct {
          id
          publisherId
          publisherName
          productId
          name
          description
          formats
          deliveryType
          inventoryType
          basePricing {
            model
            fixedCpm
            floorCpm
            targetCpm
          }
          supportedTargeting
          createdAt
          updatedAt
        }
        targeting {
          signalType
          signalProvider
          signalConfiguration {
            audienceIds
            segments
            customParameters
          }
          inheritFromCampaign
          overrides {
            geo
            demographics
            interests
          }
        }
        effectivePricing {
          cpm
          signalCost
          totalCpm
          currency
        }
        budgetAllocation {
          amount
          percentage
          dailyCap
          pacing
          currency
        }
        status
        performance {
          impressions
          clicks
          conversions
          spend
          ctr
          cvr
          cpm
          cpc
          cpa
          lastUpdated
        }
        createdAt
        updatedAt
      }
    }
  }
`;

// Mutation to delete an inventory option
export const DELETE_INVENTORY_OPTION_MUTATION = `
  mutation DeleteInventoryOption($id: String!) {
    deleteInventoryOption(id: $id) {
      success
    }
  }
`;

// Query to get inventory performance metrics for a campaign
export const GET_INVENTORY_PERFORMANCE_QUERY = `
  query GetInventoryPerformance($campaignId: String!) {
    inventoryPerformance(campaignId: $campaignId) {
      campaign {
        id
        name
      }
      options {
        option {
          id
          name
          mediaProduct {
            publisherName
            name
          }
          targeting {
            signalType
            signalProvider
          }
          budgetAllocation {
            amount
            percentage
            currency
          }
        }
        performance {
          impressions
          clicks
          conversions
          spend
          ctr
          cvr
          cpm
          cpc
          cpa
          lastUpdated
        }
      }
      summary {
        totalSpend
        totalImpressions
        averageCpm
        totalClicks
        totalConversions
      }
    }
  }
`;

// Query to get optimization recommendations for a campaign
export const GET_OPTIMIZATION_RECOMMENDATIONS_QUERY = `
  query GetOptimizationRecommendations($campaignId: String!, $goal: OptimizationGoal!) {
    optimizationRecommendations(campaignId: $campaignId, goal: $goal) {
      goal
      suggestions {
        currentOptionId
        suggestedBudgetChange
        reason
        expectedImpact
        confidence
      }
      projectedImprovement {
        metric
        currentValue
        projectedValue
        improvement
      }
      generatedAt
    }
  }
`;

// Query to discover available publisher media products
export const DISCOVER_PRODUCTS_QUERY = `
  query DiscoverProducts($input: ProductDiscoveryInput!) {
    discoverProducts(input: $input) {
      publisherMediaProducts {
        id
        publisherId
        publisherName
        productId
        name
        description
        formats
        deliveryType
        inventoryType
        basePricing {
          model
          fixedCpm
          floorCpm
          targetCpm
        }
        supportedTargeting
        createdAt
        updatedAt
      }
    }
  }
`;

// Query to get a specific inventory option by ID
export const GET_INVENTORY_OPTION_QUERY = `
  query GetInventoryOption($id: String!) {
    inventoryOption(id: $id) {
      id
      campaignId
      name
      description
      mediaProduct {
        id
        publisherId
        publisherName
        productId
        name
        description
        formats
        deliveryType
        inventoryType
        basePricing {
          model
          fixedCpm
          floorCpm
          targetCpm
        }
        supportedTargeting
        createdAt
        updatedAt
      }
      targeting {
        signalType
        signalProvider
        signalConfiguration {
          audienceIds
          segments
          customParameters
        }
        inheritFromCampaign
        overrides {
          geo
          demographics
          interests
        }
      }
      effectivePricing {
        cpm
        signalCost
        totalCpm
        currency
      }
      budgetAllocation {
        amount
        percentage
        dailyCap
        pacing
        currency
      }
      status
      performance {
        impressions
        clicks
        conversions
        spend
        ctr
        cvr
        cpm
        cpc
        cpa
        lastUpdated
      }
      createdAt
      updatedAt
    }
  }
`;

// Query to get budget allocation summary for a campaign
export const GET_BUDGET_ALLOCATION_SUMMARY_QUERY = `
  query GetBudgetAllocationSummary($campaignId: String!) {
    budgetAllocationSummary(campaignId: $campaignId) {
      campaign {
        id
        name
        totalBudget
        currency
      }
      allocations {
        inventoryOption {
          id
          name
          mediaProduct {
            publisherName
            name
          }
          targeting {
            signalType
          }
        }
        allocation {
          amount
          percentage
          dailyCap
          pacing
        }
        utilization {
          spent
          remaining
          pacingStatus
        }
      }
      summary {
        totalAllocated
        totalRemaining
        allocationPercentage
        averageCpm
      }
    }
  }
`;
