/**
 * GraphQL queries and mutations for creative management
 * Following AdCP Creative/Asset hierarchy with human-readable field names
 */

/**
 * Get creatives for a buyer agent with full asset details and campaign assignments
 * Optimized to include all related data in single query to reduce API calls
 */
export const GET_CREATIVES_QUERY = `
  query GetCreatives(
    $buyerAgentId: String!
    $filter: CreativeFilterInput
    $pagination: PaginationInput
  ) {
    creatives(
      buyerAgentId: $buyerAgentId
      filter: $filter
      pagination: $pagination
    ) {
      items {
        creativeId
        creativeName
        creativeDescription
        version
        buyerAgentId
        customerId
        
        # Assets that make up this creative (AdCP structure)
        assets {
          assetId
          assetName
          assetDescription
          assetType
          fileFormat
          fileSizeBytes
          fileUrl
          thumbnailUrl
          widthPixels
          heightPixels
          aspectRatio
          durationSeconds
          textContent {
            headline
            bodyText
            callToAction
            sponsoredByText
            brandName
            disclaimer
          }
          supportedAPIs
          supportedProtocols
          mimeTypes
          assetRole
          placementHints
          tags
          customMetadata
        }
        
        primaryAssetId
        
        # Metadata with human-readable names
        advertiserDomains
        contentCategories
        targetAudience
        
        # Status
        status
        
        # Campaign assignments (included to reduce API calls)
        campaignAssignments {
          campaignId
          campaignName
          assignedDate
          isActive
          performance {
            impressions
            clicks
            clickThroughRate
          }
        }
        
        # Tracking
        createdDate
        lastModifiedDate
        createdBy
        lastModifiedBy
      }
      
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      
      # Summary to reduce follow-up queries
      summary {
        totalCreatives
        byStatus
        byAssetType
        totalCampaigns
        averageAssetsPerCreative
      }
    }
  }
`;

/**
 * Get a single creative with full details
 */
export const GET_CREATIVE_QUERY = `
  query GetCreative($creativeId: String!) {
    creative(creativeId: $creativeId) {
      creativeId
      creativeName
      creativeDescription
      version
      buyerAgentId
      customerId
      
      assets {
        assetId
        assetName
        assetDescription
        assetType
        fileFormat
        fileSizeBytes
        fileUrl
        thumbnailUrl
        widthPixels
        heightPixels
        aspectRatio
        durationSeconds
        textContent {
          headline
          bodyText
          callToAction
          sponsoredByText
          brandName
          disclaimer
        }
        supportedAPIs
        supportedProtocols
        mimeTypes
        assetRole
        placementHints
        tags
        customMetadata
      }
      
      primaryAssetId
      advertiserDomains
      contentCategories
      targetAudience
      status
      
      campaignAssignments {
        campaignId
        campaignName
        assignedDate
        isActive
        performance {
          impressions
          clicks
          clickThroughRate
        }
      }
      
      createdDate
      lastModifiedDate
      createdBy
      lastModifiedBy
    }
  }
`;

/**
 * Create a new creative with assets
 * This will pass through to AdCP publishers when backend is implemented
 */
export const CREATE_CREATIVE_MUTATION = `
  mutation CreateCreative($input: CreateCreativeInput!) {
    createCreative(input: $input) {
      ... on Creative {
        creativeId
        creativeName
        creativeDescription
        version
        buyerAgentId
        
        assets {
          assetId
          assetName
          assetType
          fileUrl
          fileSizeBytes
          assetRole
        }
        
        advertiserDomains
        contentCategories
        targetAudience
        status
        
        campaignAssignments {
          campaignId
          campaignName
          assignedDate
        }
        
        createdDate
      }
      ... on CreativeError {
        errorCode
        errorMessage
        details
      }
    }
  }
`;

/**
 * Update existing creative
 */
export const UPDATE_CREATIVE_MUTATION = `
  mutation UpdateCreative(
    $creativeId: String!
    $input: UpdateCreativeInput!
  ) {
    updateCreative(creativeId: $creativeId, input: $input) {
      ... on Creative {
        creativeId
        creativeName
        version
        lastModifiedDate
        lastModifiedBy
      }
      ... on CreativeError {
        errorCode
        errorMessage
      }
    }
  }
`;

/**
 * Upload individual asset (can be used independently)
 * Will delegate to appropriate AdCP publisher based on asset type
 */
export const UPLOAD_ASSET_MUTATION = `
  mutation UploadAsset($input: UploadAssetInput!) {
    uploadAsset(input: $input) {
      ... on CreativeAsset {
        assetId
        assetName
        assetType
        fileUrl
        fileSizeBytes
        widthPixels
        heightPixels
        durationSeconds
        fileFormat
        thumbnailUrl
      }
      ... on CreativeError {
        errorCode
        errorMessage
      }
    }
  }
`;

/**
 * Update existing asset
 */
export const UPDATE_ASSET_MUTATION = `
  mutation UpdateAsset(
    $assetId: String!
    $input: UpdateAssetInput!
  ) {
    updateAsset(assetId: $assetId, input: $input) {
      assetId
      assetName
      lastModifiedDate
    }
  }
`;

/**
 * Delete/archive creative
 */
export const DELETE_CREATIVE_MUTATION = `
  mutation DeleteCreative($creativeId: String!) {
    deleteCreative(creativeId: $creativeId) {
      success
      message
    }
  }
`;

/**
 * Assign creative to campaign (both must have same buyer agent)
 */
export const ASSIGN_CREATIVE_TO_CAMPAIGN_MUTATION = `
  mutation AssignCreativeToCampaign(
    $creativeId: String!
    $campaignId: String!
    $buyerAgentId: String!
  ) {
    assignCreativeToCampaign(
      creativeId: $creativeId
      campaignId: $campaignId
      buyerAgentId: $buyerAgentId
    ) {
      success
      message
      assignment {
        campaignId
        campaignName
        assignedDate
        isActive
      }
    }
  }
`;

/**
 * Unassign creative from campaign
 */
export const UNASSIGN_CREATIVE_FROM_CAMPAIGN_MUTATION = `
  mutation UnassignCreativeFromCampaign(
    $creativeId: String!
    $campaignId: String!
  ) {
    unassignCreativeFromCampaign(
      creativeId: $creativeId
      campaignId: $campaignId
    ) {
      success
      message
    }
  }
`;

/**
 * Get all creatives assigned to a specific campaign
 */
export const GET_CAMPAIGN_CREATIVES_QUERY = `
  query GetCampaignCreatives($campaignId: String!) {
    campaignCreatives(campaignId: $campaignId) {
      creativeId
      creativeName
      version
      status
      
      # Primary asset for preview
      primaryAsset {
        assetId
        assetName
        assetType
        fileUrl
        thumbnailUrl
        widthPixels
        heightPixels
      }
      
      assignedDate
      performance {
        impressions
        clicks
        clickThroughRate
      }
    }
  }
`;

/**
 * Create creative package for multi-format/responsive creatives
 */
export const CREATE_CREATIVE_PACKAGE_MUTATION = `
  mutation CreateCreativePackage($input: CreateCreativePackageInput!) {
    createCreativePackage(input: $input) {
      packageId
      packageName
      buyerAgentId
      baseCreative {
        creativeId
        creativeName
      }
      formatVariants {
        variantId
        targetContext
        creative {
          creativeId
          creativeName
        }
      }
    }
  }
`;

/**
 * Get creative performance metrics
 */
export const GET_CREATIVE_PERFORMANCE_QUERY = `
  query GetCreativePerformance(
    $creativeId: String!
    $timeRange: TimeRangeInput
  ) {
    creativePerformance(
      creativeId: $creativeId
      timeRange: $timeRange
    ) {
      creativeId
      creativeName
      
      metrics {
        impressions
        clicks
        clickThroughRate
        conversions
        conversionRate
        costPerClick
        costPerConversion
        viewabilityRate
      }
      
      # Breakdown by different dimensions
      breakdown {
        byDevice {
          deviceType
          metrics {
            impressions
            clicks
            clickThroughRate
          }
        }
        byCampaign {
          campaignId
          campaignName
          metrics {
            impressions
            clicks
            clickThroughRate
          }
        }
        byAsset {
          assetId
          assetName
          metrics {
            impressions
            clicks
            clickThroughRate
          }
        }
      }
      
      timeRange {
        startDate
        endDate
      }
    }
  }
`;

/**
 * Search creatives across buyer agents (for admin use)
 */
export const SEARCH_CREATIVES_QUERY = `
  query SearchCreatives(
    $searchTerm: String!
    $filters: CreativeSearchFilters
    $pagination: PaginationInput
  ) {
    searchCreatives(
      searchTerm: $searchTerm
      filters: $filters
      pagination: $pagination
    ) {
      items {
        creativeId
        creativeName
        buyerAgentId
        status
        primaryAsset {
          assetName
          assetType
          thumbnailUrl
        }
        campaignCount
        lastModifiedDate
      }
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;