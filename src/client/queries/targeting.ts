export const GET_TARGETING_DIMENSIONS_QUERY = `
  query GetTargetingDimensions {
    targetingDimensions {
      id
      name
      type
      description
    }
  }
`;

export const CREATE_BITMAP_TARGETING_PROFILE_MUTATION = `
  mutation CreateBitmapTargetingProfile(
    $anyOf: [BigInt!]!
    $customerId: BigInt!
    $dimensionName: String!
    $noneOf: [BigInt!]!
    $strategyId: BigInt!
  ) {
    createBitmapTargetingProfile(
      anyOf: $anyOf
      customerId: $customerId
      dimensionName: $dimensionName
      noneOf: $noneOf
      strategyId: $strategyId
    ) {
      id
      dimensionName
      anyOf
      noneOf
      strategyId
      createdAt
      updatedAt
      anyOfItems {
        id
        key
        displayName
        dimensionName
        description
      }
      noneOfItems {
        id
        key
        displayName
        dimensionName
        description
      }
    }
  }
`;
