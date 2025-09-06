import type {
  BitmapTargetingProfilePromptResult,
  TargetingDimension,
  TargetingProfile,
} from "../../types/scope3.js";

export async function getTargetingDimensionsMap(
  client: {
    getTargetingDimensions: (apiKey: string) => Promise<TargetingDimension[]>;
  },
  apiKey: string,
): Promise<Map<string, TargetingDimension>> {
  try {
    const dimensions = await client.getTargetingDimensions(apiKey);
    const map = new Map<string, TargetingDimension>();

    dimensions.forEach((dimension: TargetingDimension) => {
      map.set(dimension.name, dimension);
    });

    return map;
  } catch (error) {
    console.warn("Failed to fetch targeting dimensions:", error);
    return new Map();
  }
}

export function transformTargetingProfiles(
  profiles: BitmapTargetingProfilePromptResult[] | null,
  dimensionsMap?: Map<string, TargetingDimension>,
): TargetingProfile[] {
  if (!profiles) return [];

  return profiles.map((profile) => {
    const dimension = dimensionsMap?.get(profile.dimensionName);

    return {
      category: dimension?.name || profile.dimensionName,
      categoryDescription:
        dimension?.description || `Targeting based on ${profile.dimensionName}`,
      excludeTargets: (profile.noneOfItems || []).map((item) => ({
        description:
          item.description ||
          `Exclude ${item.displayName || item.key} from targeting`,
        id: item.id,
        name: item.displayName || item.key,
      })),
      includeTargets: (profile.anyOfItems || []).map((item) => ({
        description:
          item.description ||
          `${item.displayName || item.key} targeting option`,
        id: item.id,
        name: item.displayName || item.key,
      })),
      issues: (profile.errors || []).map(
        (error) => `${error.code}: ${error.message}`,
      ),
    };
  });
}
