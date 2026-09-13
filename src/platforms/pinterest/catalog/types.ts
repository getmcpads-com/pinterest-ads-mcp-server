/** Copyright 2026 GetMCPAds. SPDX-License-Identifier: Apache-2.0 */
// Types des catalogues Pinterest, extraits de la source de référence.
// Seuls ceux dont dépendent metrics.ts et dimensions.ts.

export interface PinterestMetricDefinition {
  key: string;
  name: string;
  description: string;
  category: MetricCategory;
  format: MetricFormat;
  apiField: string;
  type: "api" | "calculated";
  formula?: string;
  dependencies?: string[];
  dataLevels?: PinterestDataLevel[];
}

export interface PinterestDimensionDefinition {
  key: string;
  name: string;
  description: string;
  category: DimensionCategory;
  apiField: string;
  requiredLevel?: DataLevel;
  requiresTargetingEndpoint?: boolean;
  incompatibleWith?: string[];
  possibleValues?: string[];
}

export type MetricCategory =
  | "core"
  | "spend"
  | "video"
  | "engagement"
  | "conversion"
  | "web"
  | "app"
  | "shopping"
  | "awareness"
  | "calculated";

export type DimensionCategory = "id" | "time" | "targeting" | "creative";

export type DataLevel =
  | "ADVERTISER"
  | "CAMPAIGN"
  | "AD_GROUP"
  | "AD"
  | "PIN_PROMOTION"
  | "PRODUCT_GROUP";

export type MetricFormat =
  | "number"
  | "currency"
  | "percentage"
  | "duration"
  | "ratio"
  | "string";

/**
 * Data level for reporting (alias for consistency)
 */
export type PinterestDataLevelType =
  | "AD_ACCOUNT"
  | "CAMPAIGN"
  | "AD_GROUP"
  | "AD"
  | "PIN"
  | "PRODUCT_GROUP";

/**
 * Metric categories for organization
 */

export type PinterestDataLevel = "AD_ACCOUNT" | "CAMPAIGN" | "AD_GROUP" | "AD" | "PRODUCT_GROUP";
