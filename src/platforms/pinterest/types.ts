/**
 * pinterest-ads-mcp-server: an open-source MCP server for the Pinterest Ads API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
export type PinterestReportLevel =
  | "AD_ACCOUNT"
  | "CAMPAIGN"
  | "AD_GROUP"
  | "AD"
  | "PRODUCT_GROUP";

export type PinterestAsyncReportLevel =
  | "ADVERTISER"
  | "ADVERTISER_TARGETING"
  | "CAMPAIGN"
  | "CAMPAIGN_TARGETING"
  | "AD_GROUP"
  | "AD_GROUP_TARGETING"
  | "PIN_PROMOTION"
  | "PIN_PROMOTION_TARGETING"
  | "PRODUCT_GROUP"
  | "PRODUCT_GROUP_TARGETING"
  | "PRODUCT_ITEM"
  | "PRODUCT_ITEM_TARGETING";

export type PinterestGranularity = "TOTAL" | "DAY" | "HOUR" | "WEEK" | "MONTH";
export type PinterestReportStatus = "DOES_NOT_EXIST" | "FINISHED" | "IN_PROGRESS" | "EXPIRED" | "FAILED" | "CANCELLED";
export type PinterestConversionReportTime = "TIME_OF_AD_ACTION" | "TIME_OF_CONVERSION";
export type PinterestAttributionType = "INDIVIDUAL" | "HOUSEHOLD";

export interface PinterestAdAccount {
  id: string;
  name: string;
  owner?: { username?: string };
  country?: string;
  currency?: string;
  permissions?: string[];
}

export interface PinterestListResponse<T> {
  items: T[];
  bookmark?: string;
}

export interface PinterestCampaign {
  id: string;
  name: string;
  status?: string;
  objective_type?: string;
  intended_promotion_type?: string | null;
  is_performance_plus?: boolean;
  created_time?: number;
  updated_time?: number;
}

export interface PinterestAdGroup {
  id: string;
  campaign_id: string;
  name: string;
  status?: string;
  feed_profile_id?: string;
  promotion_application_level?: string | null;
  is_creative_optimization?: boolean | string;
  created_time?: number;
  updated_time?: number;
}

export interface PinterestAd {
  id: string;
  ad_group_id: string;
  name: string;
  pin_id?: string;
  status?: string;
  creative_type?: string;
  destination_url?: string;
  created_time?: number;
  updated_time?: number;
}

export interface PinterestProductGroupPromotion {
  id: string;
  ad_group_id?: string;
  catalog_product_group_id?: string;
  catalog_product_group_name?: string;
  creative_type?: string;
  preferred_media_type?: string | null;
  selected_image_tag?: string;
  selected_video_tag?: string;
  status?: string;
  [key: string]: unknown;
}

export interface PinterestPinImage {
  url?: string;
  width?: number;
  height?: number;
}

export interface PinterestPin {
  id?: string;
  title?: string;
  description?: string;
  link?: string;
  media?: {
    media_type?: string;
    cover_image_url?: string;
    video_url?: string;
    images?: Record<string, PinterestPinImage>;
    items?: Array<{
      media_type?: string;
      cover_image_url?: string;
      video_url?: string;
      images?: Record<string, PinterestPinImage>;
    }>;
  };
}

export interface PinterestAsyncReportRequest {
  start_date: string;
  end_date: string;
  granularity: PinterestGranularity;
  level: PinterestAsyncReportLevel;
  columns: string[];
  report_format?: "JSON" | "CSV";
  primary_sort?: "BY_DATE" | "BY_ID";
  click_window_days?: number;
  engagement_window_days?: number;
  view_window_days?: number;
  conversion_report_time?: PinterestConversionReportTime;
  attribution_types?: PinterestAttributionType[];
  reporting_timezone?: "PINTEREST_TIME_ZONE" | "AD_ACCOUNT_TIME_ZONE";
  campaign_ids?: string[];
  ad_group_ids?: string[];
  ad_ids?: string[];
  product_group_ids?: string[];
  product_item_ids?: string[];
  targeting_types?: string[];
  [key: string]: unknown;
}

export interface PinterestAsyncReportCreateResponse {
  message?: string | null;
  report_status: PinterestReportStatus;
  token: string;
}

export interface PinterestAsyncReportStatusResponse {
  report_status: PinterestReportStatus;
  size?: number | null;
  url?: string | null;
}

export type PinterestReportRow = Record<string, unknown>;

export type PinterestPublicTargetingType =
  | "APPTYPE"
  | "GENDER"
  | "LOCALE"
  | "AGE_BUCKET"
  | "LOCATION"
  | "GEO"
  | "INTEREST"
  | "KEYWORD"
  | "AUDIENCE_INCLUDE"
  | "AUDIENCE_EXCLUDE";

export type PinterestTrendType = "growing" | "monthly" | "yearly" | "seasonal";

export interface PinterestAudience {
  id: string;
  ad_account_id?: string;
  name?: string;
  audience_type?: string;
  status?: string;
  size?: number;
  created_timestamp?: number;
  updated_timestamp?: number;
  [key: string]: unknown;
}

export interface PinterestKeywordMetric {
  keyword?: string;
  country_code?: string;
  avg_monthly_searches?: number;
  monthly_searches?: Array<Record<string, unknown>>;
  competition?: string;
  [key: string]: unknown;
}

export interface PinterestConversionTag {
  id?: string;
  ad_account_id?: string;
  name?: string;
  status?: string;
  last_fired_time_ms?: number;
  [key: string]: unknown;
}

export interface PinterestCatalogFeed {
  id?: string;
  catalog_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface PinterestReadPage<T = Record<string, unknown>> {
  items: T[];
  bookmark?: string | null;
}
