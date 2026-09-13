/** Copyright 2026 GetMCPAds. SPDX-License-Identifier: Apache-2.0 */
// ============================================
// PINTEREST ADS DIMENSION CATALOG
// Complete catalog of Pinterest Ads dimensions
// Including entity and targeting dimensions
// ============================================

import { PinterestDimensionDefinition, DimensionCategory, DataLevel } from "./types.js";
import {
  PINTEREST_REPORTING_COLUMN_SET,
  PINTEREST_TARGETING_TYPE_SET,
} from "./api-v5.generated.js";

// ============================================
// ENTITY DIMENSIONS
// ============================================

const ENTITY_DIMENSIONS: PinterestDimensionDefinition[] = [
  {
    key: "adAccountId",
    name: "Ad Account ID",
    description: "Pinterest ad account identifier",
    category: "id",
    apiField: "AD_ACCOUNT_ID",
    requiredLevel: "ADVERTISER",
  },
  {
    key: "advertiserId",
    name: "Advertiser ID",
    description: "Advertiser identifier (same as ad account)",
    category: "id",
    apiField: "ADVERTISER_ID",
    requiredLevel: "ADVERTISER",
  },
  {
    key: "campaignId",
    name: "Campaign ID",
    description: "Campaign identifier",
    category: "id",
    apiField: "CAMPAIGN_ID",
    requiredLevel: "CAMPAIGN",
  },
  {
    key: "campaignName",
    name: "Campaign Name",
    description: "Campaign name",
    category: "id",
    apiField: "CAMPAIGN_NAME",
    requiredLevel: "CAMPAIGN",
  },
  {
    key: "campaignStatus",
    name: "Campaign Status",
    description: "Campaign status (ACTIVE, PAUSED, ARCHIVED)",
    category: "id",
    apiField: "CAMPAIGN_STATUS",
    requiredLevel: "CAMPAIGN",
  },
  {
    key: "adGroupId",
    name: "Ad Group ID",
    description: "Ad group identifier",
    category: "id",
    apiField: "AD_GROUP_ID",
    requiredLevel: "AD_GROUP",
  },
  {
    key: "adGroupName",
    name: "Ad Group Name",
    description: "Ad group name",
    category: "id",
    apiField: "AD_GROUP_NAME",
    requiredLevel: "AD_GROUP",
  },
  {
    key: "adGroupStatus",
    name: "Ad Group Status",
    description: "Ad group status (ACTIVE, PAUSED, ARCHIVED)",
    category: "id",
    apiField: "AD_GROUP_STATUS",
    requiredLevel: "AD_GROUP",
  },
  {
    key: "adId",
    name: "Ad ID",
    description: "Ad identifier",
    category: "id",
    apiField: "AD_ID",
    requiredLevel: "AD",
  },
  {
    key: "adName",
    name: "Ad Name",
    description: "Ad name",
    category: "id",
    apiField: "AD_NAME",
    requiredLevel: "AD",
  },
  {
    key: "adStatus",
    name: "Ad Status",
    description: "Ad status (ACTIVE, PAUSED, ARCHIVED)",
    category: "id",
    apiField: "AD_STATUS",
    requiredLevel: "AD",
  },
  {
    key: "pinId",
    name: "Pin ID",
    description: "Pin identifier",
    category: "id",
    apiField: "PIN_ID",
    requiredLevel: "AD",
  },
  {
    key: "pinPromotionId",
    name: "Pin Promotion ID",
    description: "Pin promotion identifier",
    category: "id",
    apiField: "PIN_PROMOTION_ID",
    requiredLevel: "PIN_PROMOTION",
  },
  {
    key: "pinPromotionName",
    name: "Pin Promotion Name",
    description: "Pin promotion name",
    category: "id",
    apiField: "PIN_PROMOTION_NAME",
    requiredLevel: "PIN_PROMOTION",
  },
  {
    key: "pinPromotionStatus",
    name: "Pin Promotion Status",
    description: "Pin promotion status",
    category: "id",
    apiField: "PIN_PROMOTION_STATUS",
    requiredLevel: "PIN_PROMOTION",
  },
  {
    key: "productGroupId",
    name: "Product Group ID",
    description: "Product group identifier (for shopping campaigns)",
    category: "id",
    apiField: "PRODUCT_GROUP_ID",
  },
  {
    key: "productGroupStatus",
    name: "Product Group Status",
    description: "Product group status",
    category: "id",
    apiField: "PRODUCT_GROUP_STATUS",
  },
  {
    key: "orderLineId",
    name: "Order Line ID",
    description: "Order line identifier",
    category: "id",
    apiField: "ORDER_LINE_ID",
  },
  {
    key: "orderLineName",
    name: "Order Line Name",
    description: "Order line name",
    category: "id",
    apiField: "ORDER_LINE_NAME",
  },
];

// ============================================
// TIME DIMENSIONS
// ============================================

const TIME_DIMENSIONS: PinterestDimensionDefinition[] = [
  {
    key: "date",
    name: "Date",
    description: "The date of the data point (used with DAY granularity)",
    category: "time",
    apiField: "DATE",
  },
  {
    key: "week",
    name: "Week",
    description: "The week of the data point (used with WEEK granularity)",
    category: "time",
    apiField: "WEEK",
  },
  {
    key: "month",
    name: "Month",
    description: "The month of the data point (used with MONTH granularity)",
    category: "time",
    apiField: "MONTH",
  },
];

// ============================================
// TARGETING DIMENSIONS
// These dimensions require the targeting_analytics endpoint
// ============================================

const TARGETING_DIMENSIONS: PinterestDimensionDefinition[] = [
  {
    key: "age",
    name: "Age",
    description: "User age group bucket",
    category: "targeting",
    apiField: "AGE_BUCKET",
    possibleValues: ["13-17", "18-24", "25-34", "35-44", "45-49", "50-54", "55-64", "65+", "unknown"],
    requiresTargetingEndpoint: true,
  },
  {
    key: "gender",
    name: "Gender",
    description: "User gender",
    category: "targeting",
    apiField: "GENDER",
    possibleValues: ["male", "female", "unknown"],
    requiresTargetingEndpoint: true,
  },
  {
    key: "ageAndGender",
    name: "Age & Gender",
    description: "Combined age bucket and gender breakdown",
    category: "targeting",
    apiField: "AGE_BUCKET_AND_GENDER",
    requiresTargetingEndpoint: true,
  },
  {
    key: "country",
    name: "Country",
    description: "User country (ISO country code)",
    category: "targeting",
    apiField: "COUNTRY",
    requiresTargetingEndpoint: true,
  },
  {
    key: "region",
    name: "Region",
    description: "User region/state",
    category: "targeting",
    apiField: "REGION",
    requiresTargetingEndpoint: true,
  },
  {
    key: "geo",
    name: "Geo",
    description: "Geographic location",
    category: "targeting",
    apiField: "GEO",
    requiresTargetingEndpoint: true,
  },
  {
    key: "location",
    name: "Location",
    description: "User location (more granular than geo)",
    category: "targeting",
    apiField: "LOCATION",
    requiresTargetingEndpoint: true,
  },
  {
    key: "device",
    name: "Device",
    description: "User device type",
    category: "targeting",
    apiField: "APPTYPE",
    possibleValues: ["android_mobile", "android_tablet", "ipad", "iphone", "web", "web_mobile"],
    requiresTargetingEndpoint: true,
  },
  {
    key: "placement",
    name: "Placement",
    description: "Ad placement location",
    category: "targeting",
    apiField: "PLACEMENT",
    possibleValues: ["BROWSE", "SEARCH", "ALL"],
    requiresTargetingEndpoint: true,
  },
  {
    key: "targetedInterest",
    name: "Targeted Interest",
    description: "Interest targeting used for the ad",
    category: "targeting",
    apiField: "TARGETED_INTEREST",
    requiresTargetingEndpoint: true,
  },
  {
    key: "pinnerInterest",
    name: "Pinner Interest",
    description: "Pinner's actual interest",
    category: "targeting",
    apiField: "PINNER_INTEREST",
    requiresTargetingEndpoint: true,
  },
  {
    key: "keyword",
    name: "Keyword",
    description: "Search keyword that triggered the ad",
    category: "targeting",
    apiField: "KEYWORD",
    requiresTargetingEndpoint: true,
  },
  {
    key: "appType",
    name: "App Type",
    description: "Application type (web, ios, android)",
    category: "targeting",
    apiField: "APPTYPE",
    possibleValues: ["android_mobile", "android_tablet", "ipad", "iphone", "web", "web_mobile"],
    requiresTargetingEndpoint: true,
  },
  {
    key: "audienceInclude",
    name: "Audience Include",
    description: "Included audience segment",
    category: "targeting",
    apiField: "AUDIENCE_INCLUDE",
    requiresTargetingEndpoint: true,
  },
];

// ============================================
// CREATIVE DIMENSIONS
// ============================================

const CREATIVE_DIMENSIONS: PinterestDimensionDefinition[] = [
  {
    key: "creativeType",
    name: "Creative Type",
    description: "Type of creative (REGULAR, VIDEO, CAROUSEL, etc.)",
    category: "creative",
    apiField: "CREATIVE_TYPE",
    possibleValues: ["REGULAR", "VIDEO", "SHOPPING", "CAROUSEL", "MAX_VIDEO", "SHOP_THE_PIN", "COLLECTION", "IDEA", "SHOWCASE", "QUIZ"],
  },
  {
    key: "pinFormat",
    name: "Pin Format",
    description: "Format of the pin",
    category: "creative",
    apiField: "PIN_FORMAT",
    possibleValues: ["static", "video", "carousel", "idea", "collection"],
  },
];

// ============================================
// COMBINE ALL DIMENSIONS
// ============================================

export const PINTEREST_RAW_DIMENSION_CATALOG: PinterestDimensionDefinition[] = [
  ...ENTITY_DIMENSIONS,
  ...TIME_DIMENSIONS,
  ...TARGETING_DIMENSIONS,
  ...CREATIVE_DIMENSIONS,
];

export function isPinterestDimensionSupported(dimension: PinterestDimensionDefinition): boolean {
  if (dimension.category === "time") return true;
  if (dimension.requiresTargetingEndpoint) {
    return PINTEREST_TARGETING_TYPE_SET.has(dimension.apiField);
  }
  return PINTEREST_REPORTING_COLUMN_SET.has(dimension.apiField);
}

export const PINTEREST_UNSUPPORTED_DIMENSION_CATALOG: PinterestDimensionDefinition[] =
  PINTEREST_RAW_DIMENSION_CATALOG.filter((dimension) => !isPinterestDimensionSupported(dimension));

export const PINTEREST_DIMENSION_CATALOG: PinterestDimensionDefinition[] =
  PINTEREST_RAW_DIMENSION_CATALOG.filter(isPinterestDimensionSupported);

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get all Pinterest dimensions
 */
export function getPinterestDimensions(): PinterestDimensionDefinition[] {
  return PINTEREST_DIMENSION_CATALOG;
}

/**
 * Get dimension definition by key
 */
export function getPinterestDimensionByKey(key: string): PinterestDimensionDefinition | undefined {
  return PINTEREST_DIMENSION_CATALOG.find((d) => d.key === key);
}

/**
 * Get dimensions by category
 */
export function getPinterestDimensionsByCategory(category: DimensionCategory): PinterestDimensionDefinition[] {
  return PINTEREST_DIMENSION_CATALOG.filter((d) => d.category === category);
}

/**
 * Get targeting dimensions that require the targeting_analytics endpoint
 */
export function getPinterestTargetingDimensions(): PinterestDimensionDefinition[] {
  return PINTEREST_DIMENSION_CATALOG.filter((d) => d.requiresTargetingEndpoint === true);
}

/**
 * Get standard dimensions that work with the regular analytics endpoint
 */
export function getPinterestStandardDimensions(): PinterestDimensionDefinition[] {
  return PINTEREST_DIMENSION_CATALOG.filter((d) => d.requiresTargetingEndpoint !== true);
}

/**
 * Get dimensions available for a specific data level
 */
export function getPinterestDimensionsForLevel(level: DataLevel): PinterestDimensionDefinition[] {
  const levelOrder: DataLevel[] = ["ADVERTISER", "CAMPAIGN", "AD_GROUP", "AD", "PIN_PROMOTION", "PRODUCT_GROUP"];
  const levelIndex = levelOrder.indexOf(level);

  return PINTEREST_DIMENSION_CATALOG.filter((d) => {
    if (!d.requiredLevel) return true; // Non-entity dimensions are always available
    const dimensionLevelIndex = levelOrder.indexOf(d.requiredLevel);
    return dimensionLevelIndex <= levelIndex;
  });
}

/**
 * Get the primary ID dimension for a data level
 */
export function getPinterestPrimaryDimensionForLevel(level: DataLevel): string {
  switch (level) {
    case "ADVERTISER":
      return "adAccountId";
    case "CAMPAIGN":
      return "campaignId";
    case "AD_GROUP":
      return "adGroupId";
    case "AD":
      return "adId";
    case "PIN_PROMOTION":
      return "pinPromotionId";
    default:
      return "adAccountId";
  }
}

/**
 * Check if a dimension requires the targeting_analytics endpoint
 */
export function requiresTargetingEndpoint(dimensionKey: string): boolean {
  const dimension = getPinterestDimensionByKey(dimensionKey);
  return dimension?.requiresTargetingEndpoint === true;
}

/**
 * Check if any dimension in a list requires the targeting_analytics endpoint
 */
export function anyRequiresTargetingEndpoint(dimensionKeys: string[]): boolean {
  return dimensionKeys.some((key) => requiresTargetingEndpoint(key));
}

/**
 * Validate dimension combination
 */
export function validatePinterestDimensionCombination(dimensions: string[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  requiresTargetingEndpoint: boolean;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  let needsTargeting = false;

  // Check for valid dimensions
  for (const dim of dimensions) {
    const definition = getPinterestDimensionByKey(dim);
    if (!definition) {
      errors.push(`Unknown dimension: ${dim}`);
    } else if (definition.requiresTargetingEndpoint) {
      needsTargeting = true;
    }
  }

  // Check for redundant ID dimensions at the same level
  const idDimensions = dimensions.filter((d) => {
    const def = getPinterestDimensionByKey(d);
    return def?.category === "id";
  });

  if (idDimensions.length > 1) {
    warnings.push(
      `Multiple ID dimensions selected (${idDimensions.join(", ")}). ` +
      `Consider using a single ID dimension for cleaner results.`
    );
  }

  // Check for mixing targeting and non-targeting dimensions
  const targetingDims = dimensions.filter((d) => requiresTargetingEndpoint(d));
  const standardDims = dimensions.filter((d) => {
    const def = getPinterestDimensionByKey(d);
    return def && !def.requiresTargetingEndpoint && def.category === "targeting";
  });

  if (targetingDims.length > 0 && standardDims.length > 0) {
    warnings.push(
      `Mixing targeting dimensions that require targeting_analytics endpoint ` +
      `(${targetingDims.join(", ")}) with standard dimensions may require multiple API calls.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    requiresTargetingEndpoint: needsTargeting,
  };
}

/**
 * Get all dimension categories
 */
export function getPinterestDimensionCategories(): DimensionCategory[] {
  return [...new Set(PINTEREST_DIMENSION_CATALOG.map((d) => d.category))];
}

/**
 * Convert dimension keys to API fields
 */
export function pinterestDimensionKeysToApiFields(keys: string[]): string[] {
  return keys
    .map((key) => {
      const dimension = getPinterestDimensionByKey(key);
      return dimension?.apiField || null;
    })
    .filter((field): field is string => field !== null);
}

/**
 * Get count of dimensions by category
 */
export function getPinterestDimensionCountByCategory(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const dimension of PINTEREST_DIMENSION_CATALOG) {
    counts[dimension.category] = (counts[dimension.category] || 0) + 1;
  }
  return counts;
}

export default PINTEREST_DIMENSION_CATALOG;
