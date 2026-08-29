/**
 * pinterest-ads-mcp-server: an open-source MCP server for the Pinterest Ads API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PinterestConfig } from "../../config.js";
import { formatMcpToolError, PinterestMcpError } from "../../core/errors.js";
import { PinterestClient } from "./client.js";
import type {
  PinterestAd,
  PinterestAdGroup,
  PinterestAsyncReportLevel,
  PinterestAsyncReportRequest,
  PinterestCampaign,
  PinterestGranularity,
  PinterestPin,
  PinterestProductGroupPromotion,
  PinterestReportLevel,
  PinterestReportRow,
} from "./types.js";

const levelSchema = z.enum(["AD_ACCOUNT", "CAMPAIGN", "AD_GROUP", "AD", "PRODUCT_GROUP"]);
const granularitySchema = z.enum(["TOTAL", "DAY", "WEEK", "MONTH", "HOUR"]);
const executionModeSchema = z.enum(["auto", "sync", "async"]);
const conversionReportTimeSchema = z.enum(["TIME_OF_AD_ACTION", "TIME_OF_CONVERSION"]);
const attributionTypeSchema = z.enum(["INDIVIDUAL", "HOUSEHOLD"]);

const defaultReportColumns = [
  "SPEND_IN_DOLLAR",
  "IMPRESSION_1",
  "CLICKTHROUGH_1",
  "OUTBOUND_CLICK_1",
  "REPIN_1",
  "TOTAL_CHECKOUT",
  "TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR",
  "CHECKOUT_ROAS",
];

const defaultCreativeColumns = [
  "AD_ID",
  "AD_NAME",
  "PIN_ID",
  "SPEND_IN_DOLLAR",
  "IMPRESSION_1",
  "CLICKTHROUGH_1",
  "OUTBOUND_CLICK_1",
  "REPIN_1",
  "TOTAL_CHECKOUT",
  "TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR",
  "CHECKOUT_ROAS",
  "TOTAL_ADD_TO_CART",
  "TOTAL_VIDEO_P0_COMBINED",
];

const defaultProductGroupColumns = [
  "PRODUCT_GROUP_ID",
  "PRODUCT_GROUP_STATUS",
  "PRODUCT_GROUP_AD_IMAGE_TAG",
  "PRODUCT_GROUP_AD_VIDEO_TAG",
  ...defaultReportColumns,
  "TOTAL_ADD_TO_CART",
];

const defaultProductItemColumns = [
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
  ...defaultReportColumns,
  "TOTAL_ADD_TO_CART",
];

export function registerPinterestTools(server: McpServer, config: PinterestConfig): void {
  const client = new PinterestClient(config);

  server.tool(
    "pinterest_health_check",
    "Read-only Pinterest Ads health check. Verifies configured credentials, account access, delivery metrics access, and optional default account readability without exposing OAuth tokens.",
    { adAccountId: z.string().optional().describe("Optional Pinterest ad account ID. Defaults to PINTEREST_AD_ACCOUNT_ID when configured.") },
    async ({ adAccountId }) => {
      try {
        const selectedAccountId = resolveAdAccountId(config, adAccountId, false);
        const checks: Array<{ name: string; status: "ok" | "warning" | "error"; detail?: string }> = [];
        const warnings: string[] = [];
        const actions: string[] = [];

        checks.push({
          name: "credentials_configured",
          status: config.accessToken || (config.refreshToken && config.appId && config.appSecret) ? "ok" : "error",
          detail: "Presence checked only; credential values are never returned.",
        });

        let accounts = [];
        try {
          accounts = await client.getAllAdAccounts();
          checks.push({ name: "list_ad_accounts", status: "ok", detail: `${accounts.length} accounts accessible` });
          if (accounts.length === 0) {
            warnings.push("No Pinterest ad accounts were returned for these credentials.");
            actions.push("Grant the authenticated Pinterest user Business Access and ads:read permission on at least one ad account.");
          }
        } catch (error) {
          checks.push({ name: "list_ad_accounts", status: "error", detail: errorMessage(error) });
          actions.push("Verify PINTEREST_ACCESS_TOKEN or refresh credentials and the ads:read scope.");
          return ok({ status: "error", checks, warnings, actions, tokenExposure: "No token values returned." });
        }

        if (selectedAccountId) {
          try {
            const account = await client.getAdAccount(selectedAccountId);
            checks.push({ name: "get_ad_account", status: "ok", detail: `${account.name || selectedAccountId} readable` });
          } catch (error) {
            checks.push({ name: "get_ad_account", status: "warning", detail: errorMessage(error) });
            warnings.push(`Could not read ad account ${selectedAccountId}.`);
          }
        } else {
          checks.push({ name: "get_ad_account", status: "warning", detail: "Skipped because no ad account was provided." });
        }

        try {
          await client.getDeliveryMetrics("ASYNC");
          checks.push({ name: "delivery_metrics", status: "ok", detail: "resources/delivery_metrics is readable" });
        } catch (error) {
          checks.push({ name: "delivery_metrics", status: "warning", detail: errorMessage(error) });
          warnings.push("resources/delivery_metrics could not be read. Reporting can still work with explicit columns.");
        }

        const status = checks.some((check) => check.status === "error")
          ? "error"
          : warnings.length > 0 ? "warning" : "ok";

        return ok({
          status,
          checks,
          warnings,
          actions,
          accounts: accounts.slice(0, 25).map(summarizeAccount),
          accountCount: accounts.length,
          tokenExposure: "No access token or refresh token is returned by this tool.",
        });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_list_ad_accounts",
    "List Pinterest ad accounts accessible to the configured credentials.",
    {},
    async () => {
      try {
        const accounts = await client.getAllAdAccounts();
        return ok({ accounts: accounts.map(summarizeAccount), rowCount: accounts.length });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_get_delivery_metrics",
    "Read Pinterest resources/delivery_metrics. Use this to inspect Pinterest's official delivery metric metadata for sync or async reports.",
    { reportType: z.enum(["SYNC", "ASYNC"]).optional().describe("Optional report type filter.") },
    async ({ reportType }) => {
      try {
        const data = await client.getDeliveryMetrics(reportType);
        return ok({ data, note: "This is Pinterest metric metadata, not advertiser performance data." });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_validate_report",
    "Validate and preview how a Pinterest report will execute. Returns sync/async routing, endpoint, level, columns, attribution settings, and warnings without calling performance endpoints.",
    {
      adAccountId: z.string().optional(),
      level: levelSchema.default("CAMPAIGN"),
      startDate: z.string(),
      endDate: z.string(),
      granularity: granularitySchema.default("DAY"),
      columns: z.array(z.string()).default(defaultReportColumns),
      executionMode: executionModeSchema.default("auto"),
      entityIds: z.array(z.string()).optional(),
      targetingTypes: z.array(z.string()).optional(),
      clickWindowDays: z.number().int().min(0).max(60).default(30),
      engagementWindowDays: z.number().int().min(0).max(60).default(30),
      viewWindowDays: z.number().int().min(0).max(60).default(1),
      conversionReportTime: conversionReportTimeSchema.default("TIME_OF_AD_ACTION"),
      attributionTypes: z.array(attributionTypeSchema).optional(),
    },
    async (input) => {
      try {
        const adAccountId = resolveAdAccountId(config, input.adAccountId);
        const routing = planReportExecution(input);
        return ok({
          valid: true,
          adAccountId,
          routing,
          request: buildPlannedRequest(adAccountId, input, routing.executionMode),
          warnings: routing.warnings,
        });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_run_report",
    "Run a read-only Pinterest Ads report. Auto-routes old/wide or explicit async requests through Pinterest async reports. Uses raw Pinterest reporting column names.",
    {
      adAccountId: z.string().optional(),
      level: levelSchema.default("CAMPAIGN"),
      startDate: z.string(),
      endDate: z.string(),
      granularity: granularitySchema.default("DAY"),
      columns: z.array(z.string()).default(defaultReportColumns),
      executionMode: executionModeSchema.default("auto"),
      entityIds: z.array(z.string()).optional(),
      targetingTypes: z.array(z.string()).optional(),
      filters: z.record(z.unknown()).optional(),
      limit: z.number().int().min(1).max(5000).default(500),
      clickWindowDays: z.number().int().min(0).max(60).default(30),
      engagementWindowDays: z.number().int().min(0).max(60).default(30),
      viewWindowDays: z.number().int().min(0).max(60).default(1),
      conversionReportTime: conversionReportTimeSchema.default("TIME_OF_AD_ACTION"),
      attributionTypes: z.array(attributionTypeSchema).optional(),
      reportingTimezone: z.enum(["PINTEREST_TIME_ZONE", "AD_ACCOUNT_TIME_ZONE"]).default("PINTEREST_TIME_ZONE"),
    },
    async (input) => {
      try {
        const adAccountId = resolveAdAccountId(config, input.adAccountId);
        const routing = planReportExecution(input);
        const rows = routing.executionMode === "async"
          ? await runAsyncReport(client, adAccountId, input)
          : await runSyncReport(client, adAccountId, input);

        return ok({
          success: true,
          rows: rows.slice(0, input.limit),
          rowCount: rows.length,
          returnedRows: Math.min(rows.length, input.limit),
          truncated: rows.length > input.limit,
          executionMode: routing.executionMode,
          warnings: routing.warnings,
          attribution: attributionSummary(input),
          request: buildPlannedRequest(adAccountId, input, routing.executionMode),
        });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_get_creative_assets",
    "Fetch Pinterest creative assets and period performance when available. Returns ads, pins, thumbnails/images/videos, campaign/ad group context, catalog signals, and asset classifications.",
    {
      adAccountId: z.string().optional(),
      startDate: z.string(),
      endDate: z.string(),
      campaignIds: z.array(z.string()).optional(),
      adGroupIds: z.array(z.string()).optional(),
      onlyWithPeriodDelivery: z.boolean().default(true),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async (input) => {
      try {
        const adAccountId = resolveAdAccountId(config, input.adAccountId);
        const [campaigns, adGroups, ads, promotions] = await Promise.all([
          client.getAllCampaigns(adAccountId),
          client.getAllAdGroups(adAccountId, { campaignIds: input.campaignIds }),
          client.getAllAds(adAccountId, { campaignIds: input.campaignIds, adGroupIds: input.adGroupIds }),
          client.getAllProductGroupPromotions(adAccountId).catch(() => []),
        ]);

        const performanceRows = await runAsyncReport(client, adAccountId, {
          ...input,
          level: "AD",
          granularity: "TOTAL",
          columns: defaultCreativeColumns,
          clickWindowDays: 30,
          engagementWindowDays: 30,
          viewWindowDays: 1,
          conversionReportTime: "TIME_OF_AD_ACTION",
        });
        const performanceByAdId = new Map(performanceRows.map((row) => [String(row.AD_ID || row.PIN_PROMOTION_ID || ""), row]));
        const adGroupPerformanceRows = input.onlyWithPeriodDelivery && performanceByAdId.size === 0
          ? await runAsyncReport(client, adAccountId, {
              ...input,
              level: "AD_GROUP",
              granularity: "TOTAL",
              columns: ["AD_GROUP_ID", "AD_GROUP_NAME", "SPEND_IN_DOLLAR", "SPEND_IN_MICRO_DOLLAR", "IMPRESSION_1", "PAID_IMPRESSION", "TOTAL_IMPRESSION", "CLICKTHROUGH_1", "TOTAL_CLICKTHROUGH", "OUTBOUND_CLICK_1"],
              clickWindowDays: 30,
              engagementWindowDays: 30,
              viewWindowDays: 1,
              conversionReportTime: "TIME_OF_AD_ACTION",
              reportingTimezone: "PINTEREST_TIME_ZONE",
            }).then((rows) => rows.filter(rowHasDelivery))
          : [];
        const activeAdGroupIds = new Set(adGroupPerformanceRows.map((row) => String(row.AD_GROUP_ID || "")).filter(Boolean));
        const scopedAds = input.onlyWithPeriodDelivery
          ? performanceByAdId.size > 0
            ? ads.filter((ad) => performanceByAdId.has(ad.id))
            : ads.filter((ad) => activeAdGroupIds.has(String(ad.ad_group_id || "")) && !["ARCHIVED", "DRAFT"].includes(String(ad.status || "ACTIVE")))
          : ads;
        const selectedAds = scopedAds.slice(0, input.limit);
        const selectedPinCount = new Set(selectedAds.map((ad) => ad.pin_id).filter(Boolean)).size;
        const pinsById = await fetchPins(client, adAccountId, selectedAds);

        return ok({
          success: true,
          rows: selectedAds.map((ad) => serializeCreative(ad, campaigns, adGroups, promotions, pinsById, performanceByAdId.get(ad.id))),
          rowCount: scopedAds.length,
          returnedRows: selectedAds.length,
          truncated: scopedAds.length > selectedAds.length,
          periodPerformanceRows: performanceRows.length,
          periodAdGroupRows: adGroupPerformanceRows.length,
          warnings: [
            ...(performanceRows.length === 0
            ? activeAdGroupIds.size > 0
              ? [`No ad-level/PIN_PROMOTION performance rows were returned. Assets are scoped to ${activeAdGroupIds.size} ad groups with async delivery in the selected period and should be treated as metadata-only candidates.`]
              : ["No ad-level/PIN_PROMOTION rows and no ad-group delivery rows were returned. No current inventory is returned because onlyWithPeriodDelivery is enabled."]
            : []),
            ...(selectedPinCount > 100 ? [`Pin media enrichment is capped at 100 unique Pins per call; ${selectedPinCount - 100} returned ad records contain ad metadata but may have blank Pin media fields.`] : []),
          ],
        });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_run_catalog_report",
    "Run Pinterest catalog reporting by PRODUCT_GROUP or PRODUCT_ITEM. Use for Performance+ catalog, catalog product groups, product item image/brand/category/type, and Shopping-like reports.",
    {
      adAccountId: z.string().optional(),
      breakdown: z.enum(["PRODUCT_GROUP", "PRODUCT_ITEM"]).default("PRODUCT_GROUP"),
      startDate: z.string(),
      endDate: z.string(),
      columns: z.array(z.string()).optional(),
      productGroupIds: z.array(z.string()).optional(),
      productItemIds: z.array(z.string()).optional(),
      limit: z.number().int().min(1).max(5000).default(500),
    },
    async (input) => {
      try {
        const adAccountId = resolveAdAccountId(config, input.adAccountId);
        const columns = input.columns?.length
          ? input.columns
          : input.breakdown === "PRODUCT_ITEM" ? defaultProductItemColumns : defaultProductGroupColumns;
        const rows = await runChunkedAsyncReport(client, adAccountId, {
          startDate: input.startDate,
          endDate: input.endDate,
          maxDays: input.breakdown === "PRODUCT_ITEM" ? 31 : 92,
          buildBody: (chunk) => ({
            start_date: chunk.startDate,
            end_date: chunk.endDate,
            granularity: "TOTAL",
            level: input.breakdown,
            columns,
            report_format: "JSON",
            primary_sort: "BY_ID",
            click_window_days: 30,
            engagement_window_days: 30,
            view_window_days: 1,
            conversion_report_time: "TIME_OF_AD_ACTION",
            product_group_ids: input.breakdown === "PRODUCT_ITEM" ? input.productGroupIds : undefined,
            product_item_ids: input.breakdown === "PRODUCT_ITEM" ? input.productItemIds : undefined,
          }),
        });

        return ok({
          success: true,
          breakdown: input.breakdown,
          rows: rows.slice(0, input.limit),
          rowCount: rows.length,
          returnedRows: Math.min(rows.length, input.limit),
          truncated: rows.length > input.limit,
          columns,
          warnings: [
            input.breakdown === "PRODUCT_ITEM"
              ? "PRODUCT_ITEM reporting is async and chunked into 31-day windows. Aggregate repeated rows by product item fields."
              : "PRODUCT_GROUP reporting is the catalog delivery surface. Use conversion product reports for brand/category/SKU conversion attribution.",
          ],
        });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_get_catalog_inventory",
    "List Pinterest catalog inventory surfaces: catalogs, product groups, product group promotions, and optional product samples.",
    {
      adAccountId: z.string().optional(),
      includeProductSamples: z.boolean().default(false),
      sampleProductGroups: z.number().int().min(1).max(20).default(5),
    },
    async (input) => {
      try {
        const adAccountId = resolveAdAccountId(config, input.adAccountId);
        const [catalogs, productGroups, promotions] = await Promise.all([
          client.getCatalogs({ adAccountId }),
          client.getCatalogProductGroups({ adAccountId }),
          client.getAllProductGroupPromotions(adAccountId).catch(() => []),
        ]);
        const samples: Record<string, unknown[]> = {};
        if (input.includeProductSamples) {
          for (const group of (productGroups.items || []).slice(0, input.sampleProductGroups)) {
            const groupId = typeof group.id === "string" ? group.id : "";
            if (!groupId) continue;
            const products = await client.getCatalogProductGroupProducts(groupId, { adAccountId, pageSize: 5 }).catch(() => ({ items: [] }));
            samples[groupId] = products.items || [];
          }
        }

        return ok({
          catalogs: catalogs.items || [],
          productGroups: productGroups.items || [],
          productGroupPromotions: promotions,
          samples,
          counts: {
            catalogs: catalogs.items?.length || 0,
            productGroups: productGroups.items?.length || 0,
            productGroupPromotions: promotions.length,
            sampledProductGroups: Object.keys(samples).length,
          },
        });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_run_conversion_product_report",
    "Run Pinterest async conversion product reporting by brand, category, brand+category, SKU, or SKU group via reports/brand_category_sku.",
    {
      adAccountId: z.string().optional(),
      reportName: z.string().default("Pinterest Conversion Product Report"),
      startDate: z.string(),
      endDate: z.string(),
      granularity: z.enum(["TOTAL", "WEEK", "MONTH"]).default("TOTAL"),
      level: z.enum(["ADVERTISER", "CAMPAIGN", "AD_GROUP"]).default("CAMPAIGN"),
      columns: z.array(z.string()).default(["TOTAL_CHECKOUT", "TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR", "CHECKOUT_ROAS"]),
      conversionProductAttributionType: z.enum(["DEFAULT", "BRAND_ATTRIBUTION"]).default("DEFAULT"),
      conversionProductBreakdown: z.enum(["PRODUCT_BRAND", "PRODUCT_CATEGORY", "PRODUCT_BRAND_AND_CATEGORY", "PRODUCT_SKU", "PRODUCT_SKU_GROUP"]).default("PRODUCT_BRAND_AND_CATEGORY"),
      campaignIds: z.array(z.string()).optional(),
      adGroupIds: z.array(z.string()).optional(),
      productSkuIds: z.array(z.string()).optional(),
      limit: z.number().int().min(1).max(5000).default(500),
      clickWindowDays: z.number().int().min(0).max(60).default(30),
      viewWindowDays: z.number().int().min(0).max(60).default(1),
      conversionReportTime: conversionReportTimeSchema.default("TIME_OF_AD_ACTION"),
    },
    async (input) => {
      try {
        const adAccountId = resolveAdAccountId(config, input.adAccountId);
        const report = await client.createConversionProductReport(adAccountId, {
          report_name: input.reportName,
          start_date: input.startDate,
          end_date: input.endDate,
          granularity: input.granularity,
          level: input.level,
          columns: input.columns,
          conversion_product_attribution_type: input.conversionProductAttributionType,
          conversion_product_breakdown: input.conversionProductBreakdown,
          campaign_ids: input.campaignIds,
          ad_group_ids: input.adGroupIds,
          product_sku_ids: input.productSkuIds,
          click_window_days: input.clickWindowDays,
          view_window_days: input.viewWindowDays,
          conversion_report_time: input.conversionReportTime,
        });
        const status = await waitForConversionProductReport(client, adAccountId, report.token);
        const rows = status.url ? await client.downloadJsonReport(status.url) : [];

        return ok({
          success: true,
          reportStatus: status.report_status,
          rows: rows.slice(0, input.limit),
          rowCount: rows.length,
          returnedRows: Math.min(rows.length, input.limit),
          truncated: rows.length > input.limit,
          attribution: {
            clickWindowDays: input.clickWindowDays,
            viewWindowDays: input.viewWindowDays,
            conversionReportTime: input.conversionReportTime,
            conversionProductAttributionType: input.conversionProductAttributionType,
            conversionProductBreakdown: input.conversionProductBreakdown,
          },
        });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ source: "pinterest_ads", apiVersion: "v5", ...asObject(data) }, null, 2) }] };
}

function asObject(data: unknown): Record<string, unknown> {
  return typeof data === "object" && data !== null && !Array.isArray(data) ? data as Record<string, unknown> : { data };
}

function resolveAdAccountId(config: PinterestConfig, input?: string, required = true): string {
  const adAccountId = input || config.defaultAdAccountId;
  if (!adAccountId && required) {
    throw new PinterestMcpError("adAccountId is required. Pass it in the tool input or set PINTEREST_AD_ACCOUNT_ID.");
  }
  return adAccountId || "";
}

function summarizeAccount(account: { id: string; name?: string; country?: string; currency?: string; permissions?: string[]; owner?: { username?: string } }) {
  return {
    id: account.id,
    name: account.name,
    country: account.country,
    currency: account.currency,
    permissions: account.permissions,
    owner: account.owner?.username,
  };
}

function planReportExecution(input: {
  executionMode: "auto" | "sync" | "async";
  level: PinterestReportLevel;
  startDate: string;
  endDate: string;
  granularity: PinterestGranularity;
  columns: string[];
}) {
  validateDateRange(input.startDate, input.endDate);
  const warnings: string[] = [];
  const forcedAsyncReasons: string[] = [];
  const rangeDays = daysBetween(input.startDate, input.endDate) + 1;
  const olderThanSyncWindow = parseDateUtc(input.startDate).getTime() < Date.now() - 90 * 24 * 60 * 60 * 1000;

  if (rangeDays > 90) forcedAsyncReasons.push("date_range_over_90_days");
  if (olderThanSyncWindow) forcedAsyncReasons.push("historical_range_outside_sync_window");
  if (input.granularity === "HOUR" && rangeDays > 3) forcedAsyncReasons.push("hourly_range_over_3_days");
  if (input.granularity === "HOUR" && parseDateUtc(input.startDate).getTime() < Date.now() - 8 * 24 * 60 * 60 * 1000) {
    forcedAsyncReasons.push("hourly_range_outside_8_day_sync_window");
  }

  if (input.executionMode === "sync" && forcedAsyncReasons.length > 0) {
    warnings.push(`Sync was requested, but Pinterest may reject this query: ${forcedAsyncReasons.join(", ")}.`);
  }

  const executionMode: "sync" | "async" = input.executionMode === "async" || (input.executionMode === "auto" && forcedAsyncReasons.length > 0)
    ? "async"
    : "sync";

  if (executionMode === "async" && input.level === "AD") {
    warnings.push("Pinterest async reports use level=PIN_PROMOTION for ad-level reporting. Some historical catalog-heavy periods can return zero PIN_PROMOTION rows even when campaign/ad group data exists.");
  }

  return {
    executionMode,
    forcedAsyncReasons,
    warnings,
  };
}

function buildPlannedRequest(adAccountId: string, input: {
  level: PinterestReportLevel;
  startDate: string;
  endDate: string;
  granularity: PinterestGranularity;
  columns: string[];
  entityIds?: string[];
  targetingTypes?: string[];
  clickWindowDays: number;
  engagementWindowDays: number;
  viewWindowDays: number;
  conversionReportTime: "TIME_OF_AD_ACTION" | "TIME_OF_CONVERSION";
  attributionTypes?: Array<"INDIVIDUAL" | "HOUSEHOLD">;
}, executionMode: "sync" | "async") {
  if (executionMode === "async") {
    return {
      method: "POST",
      endpoint: `/ad_accounts/${adAccountId}/reports`,
      body: buildAsyncBody(input),
    };
  }
  return {
    method: "GET",
    endpoint: syncEndpoint(adAccountId, input.level, Boolean(input.targetingTypes?.length)),
    params: buildSyncParams(input, input.entityIds, syncIdParam(input.level)),
  };
}

async function runSyncReport(client: PinterestClient, adAccountId: string, input: {
  level: PinterestReportLevel;
  startDate: string;
  endDate: string;
  granularity: PinterestGranularity;
  columns: string[];
  entityIds?: string[];
  targetingTypes?: string[];
  filters?: Record<string, unknown>;
  clickWindowDays: number;
  engagementWindowDays: number;
  viewWindowDays: number;
  conversionReportTime: "TIME_OF_AD_ACTION" | "TIME_OF_CONVERSION";
  attributionTypes?: Array<"INDIVIDUAL" | "HOUSEHOLD">;
  reportingTimezone?: "PINTEREST_TIME_ZONE" | "AD_ACCOUNT_TIME_ZONE";
}): Promise<PinterestReportRow[]> {
  const endpoint = syncEndpoint(adAccountId, input.level, Boolean(input.targetingTypes?.length));
  const ids = await resolveEntityIds(client, adAccountId, input.level, input.entityIds);
  const idParam = syncIdParam(input.level);

  if (!idParam) {
    const payload = await client.runSyncAnalytics(endpoint, buildSyncParams(input));
    return flattenSyncResponse(payload);
  }

  const rows: PinterestReportRow[] = [];
  for (const idChunk of chunk(ids, 100)) {
    const payload = await client.runSyncAnalytics(endpoint, buildSyncParams(input, idChunk, idParam));
    rows.push(...flattenSyncResponse(payload, idParam));
  }
  return rows;
}

async function runAsyncReport(client: PinterestClient, adAccountId: string, input: {
  level: PinterestReportLevel;
  startDate: string;
  endDate: string;
  granularity: PinterestGranularity;
  columns: string[];
  entityIds?: string[];
  targetingTypes?: string[];
  clickWindowDays: number;
  engagementWindowDays: number;
  viewWindowDays: number;
  conversionReportTime: "TIME_OF_AD_ACTION" | "TIME_OF_CONVERSION";
  attributionTypes?: Array<"INDIVIDUAL" | "HOUSEHOLD">;
  reportingTimezone?: "PINTEREST_TIME_ZONE" | "AD_ACCOUNT_TIME_ZONE";
}): Promise<PinterestReportRow[]> {
  const report = await client.createAsyncReport(adAccountId, buildAsyncBody(input));
  const status = await client.waitForAsyncReport(adAccountId, report.token);
  return status.url ? client.downloadJsonReport(status.url) : [];
}

function buildSyncParams(input: {
  startDate: string;
  endDate: string;
  granularity: PinterestGranularity;
  columns: string[];
  filters?: Record<string, unknown>;
  targetingTypes?: string[];
  clickWindowDays: number;
  engagementWindowDays: number;
  viewWindowDays: number;
  conversionReportTime: "TIME_OF_AD_ACTION" | "TIME_OF_CONVERSION";
  attributionTypes?: Array<"INDIVIDUAL" | "HOUSEHOLD">;
  reportingTimezone?: "PINTEREST_TIME_ZONE" | "AD_ACCOUNT_TIME_ZONE";
}, entityIds?: string[], idParam?: string): Record<string, unknown> {
  return {
    start_date: input.startDate,
    end_date: input.endDate,
    granularity: input.granularity,
    columns: input.columns,
    click_window_days: input.clickWindowDays,
    engagement_window_days: input.engagementWindowDays,
    view_window_days: input.viewWindowDays,
    conversion_report_time: input.conversionReportTime,
    attribution_types: input.attributionTypes,
    reporting_timezone: input.reportingTimezone,
    targeting_types: input.targetingTypes,
    ...input.filters,
    ...(entityIds && idParam ? { [idParam]: entityIds } : {}),
  };
}

function buildAsyncBody(input: {
  level: PinterestReportLevel;
  startDate: string;
  endDate: string;
  granularity: PinterestGranularity;
  columns: string[];
  entityIds?: string[];
  targetingTypes?: string[];
  clickWindowDays: number;
  engagementWindowDays: number;
  viewWindowDays: number;
  conversionReportTime: "TIME_OF_AD_ACTION" | "TIME_OF_CONVERSION";
  attributionTypes?: Array<"INDIVIDUAL" | "HOUSEHOLD">;
  reportingTimezone?: "PINTEREST_TIME_ZONE" | "AD_ACCOUNT_TIME_ZONE";
}): PinterestAsyncReportRequest {
  const body: PinterestAsyncReportRequest = {
    start_date: input.startDate,
    end_date: input.endDate,
    granularity: input.granularity,
    level: asyncLevel(input.level, Boolean(input.targetingTypes?.length)),
    columns: input.columns,
    report_format: "JSON",
    primary_sort: input.granularity === "TOTAL" ? "BY_ID" : "BY_DATE",
    click_window_days: input.clickWindowDays,
    engagement_window_days: input.engagementWindowDays,
    view_window_days: input.viewWindowDays,
    conversion_report_time: input.conversionReportTime,
    attribution_types: input.attributionTypes,
    reporting_timezone: input.reportingTimezone,
    targeting_types: input.targetingTypes,
  };

  const idField = asyncIdField(input.level);
  if (idField && input.entityIds?.length) body[idField] = input.entityIds;
  return body;
}

function syncEndpoint(adAccountId: string, level: PinterestReportLevel, targeting = false): string {
  const base = `/ad_accounts/${adAccountId}`;
  switch (level) {
    case "AD_ACCOUNT": return `${base}/${targeting ? "targeting_analytics" : "analytics"}`;
    case "CAMPAIGN": return `${base}/campaigns/${targeting ? "targeting_analytics" : "analytics"}`;
    case "AD_GROUP": return `${base}/ad_groups/${targeting ? "targeting_analytics" : "analytics"}`;
    case "AD": return `${base}/ads/${targeting ? "targeting_analytics" : "analytics"}`;
    case "PRODUCT_GROUP": return `${base}/product_groups/analytics`;
  }
}

function syncIdParam(level: PinterestReportLevel): string | undefined {
  switch (level) {
    case "CAMPAIGN": return "campaign_ids";
    case "AD_GROUP": return "ad_group_ids";
    case "AD": return "ad_ids";
    case "PRODUCT_GROUP": return "product_group_ids";
    default: return undefined;
  }
}

function asyncIdField(level: PinterestReportLevel): string | undefined {
  switch (level) {
    case "CAMPAIGN": return "campaign_ids";
    case "AD_GROUP": return "ad_group_ids";
    case "AD": return "ad_ids";
    case "PRODUCT_GROUP": return "product_group_ids";
    default: return undefined;
  }
}

function asyncLevel(level: PinterestReportLevel, targeting: boolean): PinterestAsyncReportLevel {
  const mapped = level === "AD_ACCOUNT" ? "ADVERTISER" : level === "AD" ? "PIN_PROMOTION" : level;
  if (targeting && ["ADVERTISER", "CAMPAIGN", "AD_GROUP", "PIN_PROMOTION", "PRODUCT_GROUP"].includes(mapped)) {
    return `${mapped}_TARGETING` as PinterestAsyncReportLevel;
  }
  return mapped as PinterestAsyncReportLevel;
}

async function resolveEntityIds(client: PinterestClient, adAccountId: string, level: PinterestReportLevel, explicit?: string[]): Promise<string[]> {
  if (explicit?.length) return explicit;
  switch (level) {
    case "CAMPAIGN": return (await client.getAllCampaigns(adAccountId)).map((item) => item.id);
    case "AD_GROUP": return (await client.getAllAdGroups(adAccountId)).map((item) => item.id);
    case "AD": return (await client.getAllAds(adAccountId)).map((item) => item.id);
    case "PRODUCT_GROUP": {
      const promotions = await client.getAllProductGroupPromotions(adAccountId).catch(() => []);
      return [...new Set(promotions.map((item) => item.catalog_product_group_id).filter((id): id is string => Boolean(id)))];
    }
    default: return [];
  }
}

function flattenSyncResponse(payload: unknown, idParam?: string): PinterestReportRow[] {
  const entityFieldByParam: Record<string, string> = {
    campaign_ids: "CAMPAIGN_ID",
    ad_group_ids: "AD_GROUP_ID",
    ad_ids: "AD_ID",
    product_group_ids: "PRODUCT_GROUP_ID",
  };
  const entityField = idParam ? entityFieldByParam[idParam] : undefined;
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload.items)) return payload.items.filter(isRecord);

  return Object.entries(payload).flatMap(([entityId, value]) => {
    if (!Array.isArray(value)) return [];
    return value.filter(isRecord).map((row) => ({
      ...row,
      ...(entityField && row[entityField] === undefined ? { [entityField]: entityId } : {}),
    }));
  });
}

function serializeCreative(
  ad: PinterestAd,
  campaigns: PinterestCampaign[],
  adGroups: PinterestAdGroup[],
  promotions: PinterestProductGroupPromotion[],
  pinsById: Map<string, PinterestPin>,
  metrics?: PinterestReportRow
) {
  const adGroup = adGroups.find((item) => item.id === ad.ad_group_id);
  const campaign = adGroup ? campaigns.find((item) => item.id === adGroup.campaign_id) : undefined;
  const promotion = promotions.find((item) => item.ad_group_id === ad.ad_group_id);
  const pin = ad.pin_id ? pinsById.get(ad.pin_id) : undefined;
  const media = summarizePinMedia(pin);
  const isCatalog = Boolean(
    promotion ||
    ad.creative_type === "SHOPPING" ||
    ad.creative_type === "SHOP_THE_PIN" ||
    campaign?.intended_promotion_type === "CATALOG" ||
    ["CATALOG_SALES", "SHOPPING", "SALES"].includes(String(campaign?.objective_type || "")) ||
    adGroup?.feed_profile_id
  );

  return {
    adId: ad.id,
    adName: ad.name,
    status: ad.status,
    creativeType: ad.creative_type,
    createdTime: ad.created_time,
    pinId: ad.pin_id,
    campaignId: campaign?.id,
    campaignName: campaign?.name,
    campaignObjective: campaign?.objective_type,
    campaignStatus: campaign?.status,
    isPerformancePlus: campaign?.is_performance_plus === true,
    adGroupId: adGroup?.id,
    adGroupName: adGroup?.name,
    destinationUrl: ad.destination_url,
    pinTitle: pin?.title,
    pinDescription: pin?.description,
    pinLink: pin?.link,
    thumbnailUrl: media.thumbnailUrl,
    videoUrl: media.videoUrl,
    imageUrls: media.imageUrls,
    mediaType: media.mediaType,
    assetType: classifyAssetType(ad, media.mediaType, isCatalog),
    isCatalog,
    catalogProductGroupId: promotion?.catalog_product_group_id,
    catalogProductGroupName: promotion?.catalog_product_group_name,
    productGroupPromotionId: promotion?.id,
    metrics: metrics ? pickMetrics(metrics) : {},
  };
}

async function fetchPins(client: PinterestClient, adAccountId: string, ads: PinterestAd[]): Promise<Map<string, PinterestPin>> {
  const pinsById = new Map<string, PinterestPin>();
  const pinIds = [...new Set(ads.map((ad) => ad.pin_id).filter((id): id is string => Boolean(id)))].slice(0, 100);
  await Promise.all(pinIds.map(async (pinId) => {
    try {
      pinsById.set(pinId, await client.getPin(pinId, { adAccountId, pinMetrics: false }));
    } catch {
      // Missing pin details are returned as blank media fields.
    }
  }));
  return pinsById;
}

function summarizePinMedia(pin?: PinterestPin) {
  const media = pin?.media;
  const itemImages = (media?.items || []).flatMap((item) => [item.cover_image_url, firstImage(item.images)]).filter((url): url is string => Boolean(url));
  const imageUrls = [...new Set([media?.cover_image_url, firstImage(media?.images), ...itemImages].filter((url): url is string => Boolean(url)))];
  const videoUrl = media?.video_url || media?.items?.find((item) => item.video_url)?.video_url;
  const rawType = String(media?.media_type || "").toLowerCase();
  const itemTypes = (media?.items || []).map((item) => String(item.media_type || "").toLowerCase());
  const hasVideo = Boolean(videoUrl) || rawType.includes("video") || itemTypes.some((type) => type.includes("video"));
  const hasMultiple = (media?.items?.length || 0) > 1 || rawType.includes("multiple");
  const mediaType = hasMultiple
    ? hasVideo ? "MIXED" : "CAROUSEL"
    : hasVideo ? "VIDEO"
      : imageUrls.length > 0 ? "IMAGE" : "UNKNOWN";
  return { mediaType, thumbnailUrl: media?.cover_image_url || imageUrls[0], videoUrl, imageUrls };
}

function firstImage(images?: Record<string, { url?: string }>): string | undefined {
  if (!images) return undefined;
  return images["1200x"]?.url || images["600x"]?.url || images["400x300"]?.url || Object.values(images).find((image) => image.url)?.url;
}

function classifyAssetType(ad: PinterestAd, mediaType: string, isCatalog: boolean): string {
  if (isCatalog) return "CATALOG";
  if (["VIDEO", "MAX_VIDEO"].includes(String(ad.creative_type)) || mediaType === "VIDEO") return "VIDEO";
  if (ad.creative_type === "CAROUSEL" || mediaType === "CAROUSEL" || mediaType === "MIXED") return "CAROUSEL";
  if (String(ad.creative_type || "").includes("COLLECTION")) return "COLLECTION";
  if (["IDEA", "SHOWCASE", "QUIZ"].includes(String(ad.creative_type))) return String(ad.creative_type);
  if (ad.creative_type === "REGULAR" || mediaType === "IMAGE") return "IMAGE";
  return "UNKNOWN";
}

function pickMetrics(row: PinterestReportRow) {
  return {
    spend: numberValue(row.SPEND_IN_DOLLAR) || numberValue(row.SPEND_IN_MICRO_DOLLAR) / 1_000_000,
    impressions: numberValue(row.IMPRESSION_1 || row.PAID_IMPRESSION || row.TOTAL_IMPRESSION),
    clicks: numberValue(row.CLICKTHROUGH_1 || row.TOTAL_CLICKTHROUGH),
    outboundClicks: numberValue(row.OUTBOUND_CLICK_1 || row.TOTAL_OUTBOUND_CLICK),
    saves: numberValue(row.REPIN_1 || row.REPIN_2),
    checkout: numberValue(row.TOTAL_CHECKOUT),
    checkoutValue: numberValue(row.TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR) / 1_000_000,
    checkoutRoas: numberValue(row.CHECKOUT_ROAS),
    addToCart: numberValue(row.TOTAL_ADD_TO_CART || row.TOTAL_CLICK_ADD_TO_CART),
    videoStarts: numberValue(row.TOTAL_VIDEO_P0_COMBINED),
  };
}

function rowHasDelivery(row: PinterestReportRow): boolean {
  const spend = numberValue(row.SPEND_IN_DOLLAR) + numberValue(row.SPEND_IN_MICRO_DOLLAR) / 1_000_000;
  const impressions = numberValue(row.IMPRESSION_1 || row.PAID_IMPRESSION || row.TOTAL_IMPRESSION);
  const clicks = numberValue(row.CLICKTHROUGH_1 || row.TOTAL_CLICKTHROUGH || row.OUTBOUND_CLICK_1);
  return spend > 0 || impressions > 0 || clicks > 0;
}

async function runChunkedAsyncReport(client: PinterestClient, adAccountId: string, options: {
  startDate: string;
  endDate: string;
  maxDays: number;
  buildBody: (chunk: { startDate: string; endDate: string }) => PinterestAsyncReportRequest;
}) {
  const rows: PinterestReportRow[] = [];
  for (const chunk of chunkDateRange(options.startDate, options.endDate, options.maxDays)) {
    const report = await client.createAsyncReport(adAccountId, options.buildBody(chunk));
    const status = await client.waitForAsyncReport(adAccountId, report.token);
    if (!status.url) continue;
    const chunkRows = await client.downloadJsonReport(status.url);
    rows.push(...chunkRows.map((row) => ({ ...row, _chunk_start_date: chunk.startDate, _chunk_end_date: chunk.endDate })));
  }
  return rows;
}

async function waitForConversionProductReport(client: PinterestClient, adAccountId: string, token: string) {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const status = await client.getConversionProductReport(adAccountId, token);
    if (status.report_status === "FINISHED" && status.url) return status;
    if (["FAILED", "CANCELLED", "EXPIRED", "DOES_NOT_EXIST"].includes(status.report_status)) {
      throw new PinterestMcpError(`Pinterest conversion product report ${status.report_status.toLowerCase()}`, 400, status.report_status);
    }
    await delay(3_000);
  }
  throw new PinterestMcpError("Pinterest conversion product report did not finish after 60 attempts", 408, "timeout");
}

function attributionSummary(input: {
  clickWindowDays?: number;
  engagementWindowDays?: number;
  viewWindowDays?: number;
  conversionReportTime?: string;
  attributionTypes?: string[];
  reportingTimezone?: string;
}) {
  return {
    clickWindowDays: input.clickWindowDays,
    engagementWindowDays: input.engagementWindowDays,
    viewWindowDays: input.viewWindowDays,
    conversionReportTime: input.conversionReportTime,
    attributionTypes: input.attributionTypes,
    reportingTimezone: input.reportingTimezone,
  };
}

function daysBetween(startDate: string, endDate: string): number {
  return Math.round((parseDateUtc(endDate).getTime() - parseDateUtc(startDate).getTime()) / (24 * 60 * 60 * 1000));
}

function validateDateRange(startDate: string, endDate: string): void {
  const start = parseDateUtc(startDate);
  const end = parseDateUtc(endDate);
  const validStart = Number.isFinite(start.getTime()) && formatDateUtc(start) === startDate;
  const validEnd = Number.isFinite(end.getTime()) && formatDateUtc(end) === endDate;
  if (!validStart || !validEnd || start > end) {
    throw new PinterestMcpError("startDate and endDate must be valid YYYY-MM-DD dates, with startDate on or before endDate.", 400, "invalid_date_range");
  }
}

function parseDateUtc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function chunkDateRange(startDate: string, endDate: string, maxDays: number): Array<{ startDate: string; endDate: string }> {
  const chunks: Array<{ startDate: string; endDate: string }> = [];
  const finalEnd = parseDateUtc(endDate);
  let cursor = parseDateUtc(startDate);
  while (cursor <= finalEnd) {
    const chunkEnd = new Date(Math.min(addDays(cursor, maxDays - 1).getTime(), finalEnd.getTime()));
    chunks.push({ startDate: formatDateUtc(cursor), endDate: formatDateUtc(chunkEnd) });
    cursor = addDays(chunkEnd, 1);
  }
  return chunks;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
