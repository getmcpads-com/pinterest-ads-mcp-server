/**
 * pinterest-ads-mcp-server: an open-source MCP server for the Pinterest Ads API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const CORE_REPORTING_COLUMNS = [
  "SPEND_IN_DOLLAR",
  "SPEND_IN_MICRO_DOLLAR",
  "IMPRESSION_1",
  "PAID_IMPRESSION",
  "TOTAL_IMPRESSION",
  "CLICKTHROUGH_1",
  "TOTAL_CLICKTHROUGH",
  "OUTBOUND_CLICK_1",
  "TOTAL_OUTBOUND_CLICK",
  "CTR",
  "CPC_IN_DOLLAR",
  "CPC_IN_MICRO_DOLLAR",
  "CPM_IN_DOLLAR",
  "CPM_IN_MICRO_DOLLAR",
  "TOTAL_REACH",
  "FREQUENCY",
  "ENGAGEMENT_1",
  "TOTAL_ENGAGEMENT",
  "SAVE_1",
  "TOTAL_SAVE",
  "PIN_CLICK_1",
  "TOTAL_PIN_CLICK",
  "TOTAL_CHECKOUT",
  "TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR",
  "CHECKOUT_ROAS",
  "TOTAL_ADD_TO_CART",
  "TOTAL_PAGE_VISIT",
  "TOTAL_LEAD",
  "TOTAL_SIGNUP",
  "TOTAL_VIDEO_P0_COMBINED",
  "TOTAL_VIDEO_P25_COMBINED",
  "TOTAL_VIDEO_P50_COMBINED",
  "TOTAL_VIDEO_P75_COMBINED",
  "TOTAL_VIDEO_P100_COMPLETE",
];

const ENTITY_COLUMNS = [
  "AD_ACCOUNT_ID",
  "ADVERTISER_ID",
  "CAMPAIGN_ID",
  "CAMPAIGN_NAME",
  "CAMPAIGN_STATUS",
  "AD_GROUP_ID",
  "AD_GROUP_NAME",
  "AD_GROUP_STATUS",
  "AD_ID",
  "AD_NAME",
  "AD_STATUS",
  "PIN_ID",
  "PIN_PROMOTION_ID",
  "PIN_PROMOTION_NAME",
  "PRODUCT_GROUP_ID",
  "PRODUCT_GROUP_STATUS",
  "DATE",
  "WEEK",
  "MONTH",
];

export function registerPinterestResources(server: McpServer, enableWrites = false): void {
  server.resource("pinterest-manifest", "pinterest://manifest", async () => ({
    contents: [{
      uri: "pinterest://manifest",
      mimeType: "application/json",
      text: JSON.stringify({
        name: "pinterest-ads-mcp",
        platform: "pinterest_ads",
        apiVersion: "Pinterest API v5",
        readOnly: !enableWrites,
        writesEnabled: enableWrites,
        writePolicy: enableWrites
          ? "Write tools are enabled. They can change campaign and ad group status and budgets, and create paused campaigns. Every write returns a preview and applies only when the caller repeats the call with confirm: true."
          : "Read-only. Write tools exist but are disabled unless PINTEREST_ENABLE_WRITES is set.",
        tools: [
          "pinterest_health_check",
          "pinterest_list_ad_accounts",
          "pinterest_get_delivery_metrics",
          "pinterest_validate_report",
          "pinterest_run_report",
          "pinterest_get_creative_assets",
          "pinterest_run_catalog_report",
          "pinterest_get_catalog_inventory",
          "pinterest_run_conversion_product_report",
          "pinterest_get_account_entities",
          "pinterest_run_targeting_report",
          "pinterest_get_targeting_options",
          "pinterest_get_keyword_intelligence",
          "pinterest_get_audiences",
          "pinterest_get_audience_insights",
          "pinterest_estimate_delivery",
          "pinterest_get_conversion_setup",
          "pinterest_get_catalog_diagnostics",
          "pinterest_run_specialized_export",
          "pinterest_get_lead_assets",
          "pinterest_get_business_assets",
          "pinterest_get_billing_and_orders",
          "pinterest_get_pin_analytics",
          "pinterest_get_organic_inventory",
          "pinterest_get_trends",
          "pinterest_get_platform_resources",
        ],
        resources: [
          "pinterest://manifest",
          "pinterest://reporting-columns",
          "pinterest://attribution",
          "pinterest://creative-assets",
          "pinterest://catalog-reporting",
          "pinterest://surface-map",
          "pinterest://recipes",
        ],
        safety: [
          "No write or mutate endpoints are registered.",
          "OAuth access and refresh tokens are never returned in tool responses.",
          "Historical/wide reports automatically use async report creation and download.",
        ],
      }, null, 2),
    }],
  }));

  server.resource("pinterest-reporting-columns", "pinterest://reporting-columns", async () => ({
    contents: [{
      uri: "pinterest://reporting-columns",
      mimeType: "application/json",
      text: JSON.stringify({
        note: "This MCP accepts Pinterest raw reporting column names, exactly as the API names them.",
        entityColumns: ENTITY_COLUMNS,
        coreColumns: CORE_REPORTING_COLUMNS,
        productGroupColumns: [
          "PRODUCT_GROUP_ID",
          "PRODUCT_GROUP_STATUS",
          "PRODUCT_GROUP_AD_IMAGE_TAG",
          "PRODUCT_GROUP_AD_VIDEO_TAG",
        ],
        productItemColumns: [
          "PRODUCT_ITEM_NAME",
          "PRODUCT_ITEM_IMAGE_URL",
          "PRODUCT_ITEM_PRICE",
          "PRODUCT_ITEM_PRODUCT_URL",
          "PRODUCT_ITEM_PIN_URL",
          "PRODUCT_ITEM_BRAND",
          "PRODUCT_ITEM_DESCRIPTION",
          "PRODUCT_ITEM_SALE_PRICE",
          "PRODUCT_ITEM_PRODUCT_TYPE",
          "PRODUCT_ITEM_PRODUCT_CATEGORY",
          "PRODUCT_ITEM_CURRENCY",
          "STANDARD_AD_FEED_ITEM_ID",
        ],
      }, null, 2),
    }],
  }));

  server.resource("pinterest-attribution", "pinterest://attribution", async () => ({
    contents: [{
      uri: "pinterest://attribution",
      mimeType: "application/json",
      text: JSON.stringify({
        parameters: {
          click_window_days: [0, 1, 7, 14, 30, 60],
          engagement_window_days: [0, 1, 7, 14, 30, 60],
          view_window_days: [0, 1, 7, 14, 30, 60],
          conversion_report_time: ["TIME_OF_AD_ACTION", "TIME_OF_CONVERSION"],
          attribution_types: ["INDIVIDUAL", "HOUSEHOLD"],
          reporting_timezone: ["PINTEREST_TIME_ZONE", "AD_ACCOUNT_TIME_ZONE"],
        },
        defaults: { click: 30, engagement: 30, view: 1, conversionReportTime: "TIME_OF_AD_ACTION" },
        liveAcceptedPresets: ["60/60/60", "60/60/30", "60/60/7", "60/60/1", "30/30/30", "30/30/7", "30/30/1", "7/7/7", "7/7/1", "7/0/0", "1/1/1", "1/0/0"],
        liveRejectedExamples: ["30/0/0", "0/0/1"],
        rule: "Attribution windows are request parameters, not dimensions. Run separate reports when comparing windows.",
      }, null, 2),
    }],
  }));

  server.resource("pinterest-creative-assets", "pinterest://creative-assets", async () => ({
    contents: [{
      uri: "pinterest://creative-assets",
      mimeType: "application/json",
      text: JSON.stringify({
        assetSources: [
          "Ads list for ad id/name/status/creative_type/pin_id/destination_url/created_time",
          "Pin detail for title/description/link/images/video/carousel media",
          "Campaign and ad group lists for objective, status, Performance+ and catalog signals",
          "Product group promotions for catalog product group name/id, selected image/video tags and preferred media type",
        ],
        normalizedTypes: ["IMAGE", "VIDEO", "CAROUSEL", "COLLECTION", "CATALOG", "IDEA", "SHOWCASE", "QUIZ", "UNKNOWN"],
        caveat: "Current inventory alone is not a historical delivery filter. Prefer period performance rows when available.",
      }, null, 2),
    }],
  }));

  server.resource("pinterest-catalog-reporting", "pinterest://catalog-reporting", async () => ({
    contents: [{
      uri: "pinterest://catalog-reporting",
      mimeType: "application/json",
      text: JSON.stringify({
        productGroup: "Use PRODUCT_GROUP async reports for catalog spend, impressions, clicks, conversions and product group metadata.",
        productItem: "Use PRODUCT_ITEM async reports for item name, image URL, brand, product type/category, price, product URL, pin URL and performance.",
        conversionProductReport: "Use reports/brand_category_sku for conversion product reporting by brand/category/SKU. This is separate from spend by product item.",
      }, null, 2),
    }],
  }));

  server.resource("pinterest-surface-map", "pinterest://surface-map", async () => ({
    contents: [{
      uri: "pinterest://surface-map",
      mimeType: "application/json",
      text: JSON.stringify({
        specBaseline: "Pinterest REST API v5; audited against the official pinterest/api-description OpenAPI v5.28.0 surface.",
        surfaces: {
          deliveryAnalytics: ["pinterest_run_report", "pinterest_run_targeting_report", "pinterest_run_catalog_report", "pinterest_run_conversion_product_report"],
          accountInventory: ["pinterest_list_ad_accounts", "pinterest_get_account_entities"],
          creativesAndOrganic: ["pinterest_get_creative_assets", "pinterest_get_pin_analytics", "pinterest_get_organic_inventory"],
          targetingAndPlanning: ["pinterest_get_targeting_options", "pinterest_get_keyword_intelligence", "pinterest_get_audiences", "pinterest_get_audience_insights", "pinterest_estimate_delivery"],
          measurement: ["pinterest_get_conversion_setup", "pinterest_get_delivery_metrics", "pinterest_get_platform_resources"],
          commerce: ["pinterest_get_catalog_inventory", "pinterest_get_catalog_diagnostics", "pinterest_run_specialized_export"],
          administration: ["pinterest_get_business_assets", "pinterest_get_billing_and_orders", "pinterest_get_lead_assets"],
          marketIntelligence: ["pinterest_get_trends", "pinterest_get_keyword_intelligence"],
        },
        intentionallyExcluded: [
          "Campaign, ad-group, ad, audience, catalog, conversion-event, and other mutations.",
          "Lead-record export because it can contain end-user personally identifiable information; lead-form and subscription configuration remain readable.",
          "OAuth token generation/revocation and credential values.",
        ],
        businessReadSafety: {
          selectedAccountBoundary: "businessId must expose the selected ad account as an AD_ACCOUNT asset, otherwise allowCrossBusinessRead=true is required",
          personalIdentifiers: "member/invite IDs, email and username are redacted unless includePersonalIdentifiers=true",
        },
        paging: "Inventory tools return one page plus Pinterest bookmark/hasMore where applicable. Continue with bookmark instead of unbounded account-wide downloads.",
      }, null, 2),
    }],
  }));

  server.resource("pinterest-recipes", "pinterest://recipes", async () => ({
    contents: [{
      uri: "pinterest://recipes",
      mimeType: "application/json",
      text: JSON.stringify({
        recipes: [
          {
            name: "Classic campaign report",
            tool: "pinterest_run_report",
            input: {
              level: "CAMPAIGN",
              granularity: "DAY",
              columns: ["CAMPAIGN_ID", "CAMPAIGN_NAME", "DATE", "SPEND_IN_DOLLAR", "IMPRESSION_1", "CLICKTHROUGH_1", "TOTAL_CHECKOUT", "CHECKOUT_ROAS"],
              startDate: "2025-11-01",
              endDate: "2025-12-31",
            },
          },
          {
            name: "Creative asset preview",
            tool: "pinterest_get_creative_assets",
            input: { startDate: "2025-11-01", endDate: "2025-12-31", onlyWithPeriodDelivery: true },
          },
          {
            name: "Catalog product item report",
            tool: "pinterest_run_catalog_report",
            input: { breakdown: "PRODUCT_ITEM", startDate: "2025-11-01", endDate: "2025-12-31" },
          },
          {
            name: "Brand/category/SKU conversion report",
            tool: "pinterest_run_conversion_product_report",
            input: {
              startDate: "2025-11-01",
              endDate: "2025-12-31",
              level: "CAMPAIGN",
              conversionProductBreakdown: "PRODUCT_BRAND_AND_CATEGORY",
            },
          },
          {
            name: "Keyword country metrics",
            tool: "pinterest_get_keyword_intelligence",
            input: { mode: "COUNTRY_METRICS", countryCode: "FR", keywords: ["canape design", "decoration salon"] },
          },
          {
            name: "Targeting performance by keyword and interest",
            tool: "pinterest_run_targeting_report",
            input: {
              level: "AD_GROUP",
              entityIds: ["123456789"],
              startDate: "2026-06-01",
              endDate: "2026-06-30",
              targetingTypes: ["KEYWORD", "INTEREST"],
            },
          },
          {
            name: "Catalog feed issues",
            tool: "pinterest_get_catalog_diagnostics",
            input: { mode: "PROCESSING_RESULTS", feedId: "123456789" },
          },
          {
            name: "Start an MMM export",
            tool: "pinterest_run_specialized_export",
            input: {
              exportType: "MMM",
              action: "START",
              request: {
                report_name: "Conversion report",
                start_date: "2025-01-01",
                end_date: "2025-12-31",
                granularity: "WEEK",
                level: "CAMPAIGN_TARGETING",
                targeting_types: ["PLACEMENT"],
                columns: ["CAMPAIGN_ID", "SPEND_IN_DOLLAR", "IMPRESSION_1", "CLICKTHROUGH_1"],
              },
            },
          },
        ],
      }, null, 2),
    }],
  }));
}
