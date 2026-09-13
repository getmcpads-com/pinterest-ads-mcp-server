/**
 * pinterest-ads-mcp-server: an open-source MCP server for the Pinterest Ads API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import { redactPinterestSecrets } from "./privacy.js";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PinterestConfig } from "../../config.js";
import { formatMcpToolError, PinterestMcpError } from "../../core/errors.js";
import { PinterestClient } from "./client.js";
import { redactPinterestBusinessPersonalIdentifiers } from "./privacy.js";

const idSchema = z.string().min(1).max(128);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
const pageSizeSchema = z.number().int().min(1).max(250).default(100);
const bookmarkSchema = z.string().optional();
const querySchema = z.record(z.unknown()).optional().describe("Additional documented query parameters for the selected fixed GET endpoint.");

const targetingTypeSchema = z.enum([
  "APPTYPE",
  "GENDER",
  "LOCALE",
  "AGE_BUCKET",
  "LOCATION",
  "GEO",
  "INTEREST",
  "KEYWORD",
  "AUDIENCE_INCLUDE",
  "AUDIENCE_EXCLUDE",
]);

const trendRegionSchema = z.enum([
  "US",
  "CA",
  "DE",
  "FR",
  "ES",
  "IT",
  "DE+AT+CH",
  "GB+IE",
  "IT+ES+PT+GR+MT",
  "PL+RO+HU+SK+CZ",
  "SE+DK+FI+NO",
  "NL+BE+LU",
  "AR",
  "BR",
  "CO",
  "MX",
  "MX+AR+CO+CL",
  "AU+NZ",
]);

export function registerPinterestSurfaceTools(server: McpServer, config: PinterestConfig): void {
  const client = new PinterestClient(config);

  server.tool(
    "pinterest_get_account_entities",
    "Read Pinterest ad-account entities and configuration. Covers account, campaign, ad group, ad, product-group promotion, promotion, label, schedule, targeting template, and order-line inventory. Returns one API page and its bookmark for predictable live queries.",
    {
      adAccountId: idSchema.optional(),
      entity: z.enum([
        "AD_ACCOUNT",
        "CAMPAIGN",
        "AD_GROUP",
        "AD",
        "PRODUCT_GROUP_PROMOTION",
        "PROMOTION",
        "LABEL",
        "SCHEDULE",
        "TARGETING_TEMPLATE",
        "ORDER_LINE",
      ]),
      entityId: idSchema.optional().describe("Fetch one entity where Pinterest exposes a detail endpoint."),
      adIds: z.array(idSchema).min(1).max(100).optional().describe("For entity AD collections only: restrict to these reporting ad IDs."),
      campaignIds: z.array(idSchema).max(100).optional(),
      adGroupIds: z.array(idSchema).max(100).optional(),
      entityStatuses: z.array(z.string()).max(20).optional(),
      pageSize: pageSizeSchema,
      bookmark: bookmarkSchema,
      query: querySchema,
    },
    async (input) => {
      try {
        if (input.adIds && (input.entity !== "AD" || input.entityId)) throw new Error("adIds requires an AD collection without entityId.");
        const adAccountId = resolveAdAccountId(config, input.adAccountId);
        const base = `/ad_accounts/${segment(adAccountId)}`;
        const page = pageQuery(input.pageSize, input.bookmark, input.query);
        let endpoint: string;
        let query: Record<string, unknown> = page;

        switch (input.entity) {
          case "AD_ACCOUNT":
            endpoint = base;
            query = input.query || {};
            break;
          case "CAMPAIGN":
            endpoint = input.entityId ? `${base}/campaigns/${segment(input.entityId)}` : `${base}/campaigns`;
            query = input.entityId ? input.query || {} : {
              ...page,
              campaign_ids: input.campaignIds,
              entity_statuses: input.entityStatuses,
            };
            break;
          case "AD_GROUP":
            endpoint = input.entityId ? `${base}/ad_groups/${segment(input.entityId)}` : `${base}/ad_groups`;
            query = input.entityId ? input.query || {} : {
              ...page,
              campaign_ids: input.campaignIds,
              ad_group_ids: input.adGroupIds,
              entity_statuses: input.entityStatuses,
            };
            break;
          case "AD":
            endpoint = input.entityId ? `${base}/ads/${segment(input.entityId)}` : `${base}/ads`;
            query = input.entityId ? input.query || {} : {
              ...page,
              campaign_ids: input.campaignIds,
              ad_group_ids: input.adGroupIds,
              ad_ids: input.adIds,
              entity_statuses: input.entityStatuses,
            };
            break;
          case "PRODUCT_GROUP_PROMOTION":
            endpoint = input.entityId
              ? `${base}/product_group_promotions/${segment(input.entityId)}`
              : `${base}/product_group_promotions`;
            query = input.entityId ? input.query || {} : {
              ...page,
              ad_group_id: input.adGroupIds?.[0],
              entity_statuses: input.entityStatuses,
            };
            break;
          case "PROMOTION":
            endpoint = input.entityId ? `${base}/promotions/${segment(input.entityId)}` : `${base}/promotions`;
            query = input.entityId ? input.query || {} : page;
            break;
          case "LABEL":
            endpoint = `${base}/labels`;
            query = page;
            break;
          case "SCHEDULE":
            endpoint = `${base}/schedules`;
            query = page;
            break;
          case "TARGETING_TEMPLATE":
            endpoint = `${base}/targeting_templates`;
            query = page;
            break;
          case "ORDER_LINE":
            endpoint = input.entityId ? `${base}/order_lines/${segment(input.entityId)}` : `${base}/order_lines`;
            query = input.entityId ? input.query || {} : page;
            break;
        }

        const data = await client.getResource(endpoint, query);
        return ok({ entity: input.entity, endpoint, ...shapeResponse(data) });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_run_targeting_report",
    "Run live targeting analytics for an ad account, campaigns, ad groups, or ads, broken down by age, gender, location, interest, keyword, audience, placement, device, or other Pinterest targeting types. For data older than the sync window, use pinterest_run_report with targetingTypes and executionMode=async.",
    {
      adAccountId: idSchema.optional(),
      level: z.enum(["AD_ACCOUNT", "CAMPAIGN", "AD_GROUP", "AD"]).default("AD_GROUP"),
      entityIds: z.array(idSchema).max(100).optional(),
      startDate: dateSchema,
      endDate: dateSchema,
      targetingTypes: z.array(z.string()).min(1).max(20),
      columns: z.array(z.string()).min(1).max(50).default(["SPEND_IN_DOLLAR", "IMPRESSION_1", "CLICKTHROUGH_1", "OUTBOUND_CLICK_1", "TOTAL_CHECKOUT", "CHECKOUT_ROAS"]),
      granularity: z.enum(["TOTAL", "DAY", "HOUR", "WEEK", "MONTH"]).default("DAY"),
      clickWindowDays: z.number().int().min(0).max(60).default(30),
      engagementWindowDays: z.number().int().min(0).max(60).default(30),
      viewWindowDays: z.number().int().min(0).max(60).default(1),
      conversionReportTime: z.enum(["TIME_OF_AD_ACTION", "TIME_OF_CONVERSION"]).default("TIME_OF_AD_ACTION"),
      attributionTypes: z.array(z.enum(["INDIVIDUAL", "HOUSEHOLD"])).optional(),
      reportingTimezone: z.enum(["PINTEREST_TIME_ZONE", "AD_ACCOUNT_TIME_ZONE"]).default("PINTEREST_TIME_ZONE"),
      query: querySchema,
    },
    async (input) => {
      try {
        const adAccountId = resolveAdAccountId(config, input.adAccountId);
        const idParam = targetingIdParam(input.level);
        if (idParam && !input.entityIds?.length) {
          throw new PinterestMcpError(`entityIds is required for ${input.level} targeting analytics.`, 400, "missing_entity_ids");
        }
        validateDateOrder(input.startDate, input.endDate);
        const endpoint = targetingAnalyticsEndpoint(adAccountId, input.level);
        const data = await client.getResource(endpoint, {
          ...(input.query || {}),
          start_date: input.startDate,
          end_date: input.endDate,
          targeting_types: input.targetingTypes,
          columns: input.columns,
          granularity: input.granularity,
          click_window_days: input.clickWindowDays,
          engagement_window_days: input.engagementWindowDays,
          view_window_days: input.viewWindowDays,
          conversion_report_time: input.conversionReportTime,
          attribution_types: input.attributionTypes,
          reporting_timezone: input.reportingTimezone,
          ...(idParam ? { [idParam]: input.entityIds } : {}),
        });
        return ok({
          endpoint,
          level: input.level,
          targetingTypes: input.targetingTypes,
          attribution: attributionFrom(input),
          ...shapeResponse(data),
          limitations: ["Pinterest sync targeting analytics generally supports the most recent 90 days; hourly queries are more restricted."],
        });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_get_targeting_options",
    "Read Pinterest's official targeting option catalog for app type, gender, locale, age, location/geo, interest, keyword, or audience. Can also resolve a specific interest ID.",
    {
      adAccountId: idSchema.optional(),
      targetingType: targetingTypeSchema.default("INTEREST"),
      interestId: idSchema.optional(),
      query: querySchema,
    },
    async (input) => {
      try {
        const adAccountId = resolveAdAccountId(config, input.adAccountId, false);
        const endpoint = input.interestId
          ? `/resources/targeting/interests/${segment(input.interestId)}`
          : `/resources/targeting/${input.targetingType}`;
        const data = await client.getResource(endpoint, {
          ...(input.query || {}),
          ad_account_id: adAccountId || undefined,
        });
        return ok({ endpoint, targetingType: input.targetingType, ...shapeResponse(data) });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_get_keyword_intelligence",
    "Read assigned targeting keywords, Pinterest country-level keyword metrics, suggested terms, or related terms. Country metrics accept up to 2,000 keywords per request.",
    {
      adAccountId: idSchema.optional(),
      mode: z.enum(["ASSIGNED", "COUNTRY_METRICS", "SUGGESTED", "RELATED"]),
      campaignId: idSchema.optional(),
      adGroupId: idSchema.optional(),
      adGroupIds: z.array(idSchema).max(250).optional(),
      matchTypes: z.array(z.enum(["BROAD", "PHRASE", "EXACT", "PHRASE_NEGATIVE", "EXACT_NEGATIVE", "TARGETING_INTERESTS"])).max(5).optional(),
      countryCode: z.string().length(2).optional(),
      keywords: z.array(z.string().min(1)).max(2000).optional(),
      term: z.string().min(1).optional(),
      terms: z.array(z.string().min(1)).max(100).optional(),
      limit: z.number().int().min(1).max(10).default(4),
      pageSize: pageSizeSchema,
      bookmark: bookmarkSchema,
    },
    async (input) => {
      try {
        let endpoint: string;
        let query: Record<string, unknown>;
        if (input.mode === "SUGGESTED") {
          requireValue(input.term, "term", input.mode);
          endpoint = "/terms/suggested";
          query = { term: input.term, limit: input.limit };
        } else if (input.mode === "RELATED") {
          requireList(input.terms, "terms", input.mode);
          endpoint = "/terms/related";
          query = { terms: input.terms };
        } else {
          const adAccountId = resolveAdAccountId(config, input.adAccountId);
          endpoint = `/ad_accounts/${segment(adAccountId)}/keywords${input.mode === "COUNTRY_METRICS" ? "/metrics" : ""}`;
          if (input.mode === "COUNTRY_METRICS") {
            requireValue(input.countryCode, "countryCode", input.mode);
            requireList(input.keywords, "keywords", input.mode);
            query = { country_code: input.countryCode?.toUpperCase(), keywords: input.keywords };
          } else {
            query = {
              campaign_id: input.campaignId,
              ad_group_id: input.adGroupId,
              ad_group_ids: input.adGroupIds,
              match_types: input.matchTypes,
              page_size: input.pageSize,
              bookmark: input.bookmark,
            };
          }
        }
        const data = await client.getResource(endpoint, query);
        return ok({ mode: input.mode, endpoint, ...shapeResponse(data) });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_get_audiences",
    "Read audience, customer-list, sharing, and Business-received audience inventory without uploading or changing audience membership.",
    {
      adAccountId: idSchema.optional(),
      mode: z.enum(["AUDIENCES", "AUDIENCE", "CUSTOMER_LISTS", "CUSTOMER_LIST", "CUSTOMER_SEGMENTS", "SHARED_ACCOUNTS", "BUSINESS_RECEIVED"]),
      audienceId: idSchema.optional(),
      customerListId: idSchema.optional(),
      businessId: idSchema.optional(),
      allowCrossBusinessRead: z.boolean().optional().default(false)
        .describe("Explicit opt-in required if the business cannot be linked to the selected ad account."),
      accountType: z.enum(["AD_ACCOUNT", "BUSINESS_ACCOUNT"]).default("AD_ACCOUNT"),
      ownershipType: z.enum(["OWNED", "RECEIVED"]).optional(),
      excludeNca: z.boolean().optional(),
      pageSize: pageSizeSchema,
      bookmark: bookmarkSchema,
      query: querySchema,
    },
    async (input) => {
      try {
        const page = pageQuery(input.pageSize, input.bookmark, input.query);
        let endpoint: string;
        let query: Record<string, unknown> = page;
        let warnings: string[] = [];
        if (input.mode === "BUSINESS_RECEIVED") {
          requireValue(input.businessId, "businessId", input.mode);
          endpoint = `/businesses/${segment(input.businessId!)}/audiences`;
          warnings = await verifyBusinessReadScope(
            client,
            input.businessId!,
            resolveAdAccountId(config, input.adAccountId, false),
            input.allowCrossBusinessRead
          );
        } else {
          const adAccountId = resolveAdAccountId(config, input.adAccountId);
          const base = `/ad_accounts/${segment(adAccountId)}`;
          switch (input.mode) {
            case "AUDIENCES":
              endpoint = `${base}/audiences`;
              query = { ...page, ownership_type: input.ownershipType, exclude_nca: input.excludeNca };
              break;
            case "AUDIENCE":
              requireValue(input.audienceId, "audienceId", input.mode);
              endpoint = `${base}/audiences/${segment(input.audienceId!)}`;
              query = input.query || {};
              break;
            case "CUSTOMER_LISTS":
              endpoint = `${base}/customer_lists`;
              query = { ...page, exclude_nca: input.excludeNca };
              break;
            case "CUSTOMER_LIST":
              requireValue(input.customerListId, "customerListId", input.mode);
              endpoint = `${base}/customer_lists/${segment(input.customerListId!)}`;
              query = input.query || {};
              break;
            case "CUSTOMER_SEGMENTS":
              endpoint = `${base}/customer_segments`;
              query = page;
              break;
            case "SHARED_ACCOUNTS":
              requireValue(input.audienceId, "audienceId", input.mode);
              endpoint = `${base}/audiences/shared/accounts`;
              query = { ...page, audience_id: input.audienceId, account_type: input.accountType };
              break;
            default:
              throw new PinterestMcpError(`Unsupported audience mode ${input.mode}.`, 400);
          }
        }
        const data = await client.getResource(endpoint, query);
        return ok({ mode: input.mode, endpoint, ...shapeResponse(data), warnings });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_get_audience_insights",
    "Read aggregated Pinterest Audience Insights for the advertiser's total or engaged audience, Pinterest's total audience, or the scope/type endpoint. Pinterest fixes the audience-insights observation window; it is not a custom date-range report.",
    {
      adAccountId: idSchema.optional(),
      mode: z.enum(["AUDIENCE_PROFILE", "SCOPE_AND_TYPE"]).default("AUDIENCE_PROFILE"),
      audienceInsightType: z.enum(["YOUR_TOTAL_AUDIENCE", "YOUR_ENGAGED_AUDIENCE", "PINTEREST_TOTAL_AUDIENCE"]).default("YOUR_TOTAL_AUDIENCE"),
      query: querySchema,
    },
    async (input) => {
      try {
        const adAccountId = resolveAdAccountId(config, input.adAccountId);
        const endpoint = `/ad_accounts/${segment(adAccountId)}/${input.mode === "AUDIENCE_PROFILE" ? "audience_insights" : "insights/audiences"}`;
        const data = await client.getResource(endpoint, {
          ...(input.query || {}),
          audience_insight_type: input.mode === "AUDIENCE_PROFILE" ? input.audienceInsightType : undefined,
        });
        return ok({
          mode: input.mode,
          endpoint,
          observationWindow: "Pinterest-defined; Audience Insights commonly reflects the prior 30 days and does not accept custom dates.",
          ...shapeResponse(data),
        });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_estimate_delivery",
    "Run non-mutating Pinterest planning computations: ad-group audience size, bid floors, or campaign delivery estimates. The request body follows the selected Pinterest v5 schema and no campaign/ad group is created or changed.",
    {
      adAccountId: idSchema.optional(),
      mode: z.enum(["AUDIENCE_SIZE", "BID_FLOOR", "CAMPAIGN_DELIVERY", "ADVANCED_AUCTION_ITEMS"]),
      request: z.record(z.unknown()),
    },
    async (input) => {
      try {
        const adAccountId = resolveAdAccountId(config, input.adAccountId, input.mode !== "ADVANCED_AUCTION_ITEMS");
        const base = `/ad_accounts/${segment(adAccountId)}`;
        const endpoint = input.mode === "ADVANCED_AUCTION_ITEMS" ? "/advanced_auction/items/get" : input.mode === "AUDIENCE_SIZE"
          ? `${base}/ad_groups/audience_sizing`
          : input.mode === "BID_FLOOR" ? `${base}/bid_floor` : `${base}/campaigns/delivery_estimates`;
        const data = await client.postReadQuery(endpoint, input.request);
        return ok({
          mode: input.mode,
          endpoint,
          data,
          dataKind: "estimate",
          caveat: "Planning outputs are estimates based on Pinterest models and do not guarantee delivery or performance.",
        });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_get_conversion_setup",
    "Inspect Pinterest conversion measurement configuration: conversion tags, oCPM-eligible/page-visit tags, Event Quality Score, advertiser-defined events, and conversion-deletion request status. This never sends or deletes conversion events.",
    {
      adAccountId: idSchema.optional(),
      surfaces: z.array(z.enum(["CONVERSION_TAGS", "OCPM_ELIGIBLE", "PAGE_VISIT", "EVENT_QUALITY_SCORE", "ADVERTISER_DEFINED_EVENTS", "DELETION_REQUESTS"])).min(1).default(["CONVERSION_TAGS", "OCPM_ELIGIBLE", "PAGE_VISIT", "EVENT_QUALITY_SCORE", "ADVERTISER_DEFINED_EVENTS"]),
      includeDeletedTags: z.boolean().default(false),
      lookbackPeriod: z.enum(["1d", "14d"]).default("14d"),
      sourcePlatform: z.enum(["WEB", "MOBILE", "MOBILE_ANDROID", "MOBILE_IOS", "OFFLINE", "PINTEREST_WEB", "PINTEREST_ANDROID", "PINTEREST_IOS", "POINT_OF_SALE"]).optional(),
      ingestionSource: z.enum(["TAG", "MMP", "FILE_UPLOAD", "CONVERSIONS_API", "NATIVE"]).optional(),
      pageSize: pageSizeSchema,
      bookmark: bookmarkSchema,
    },
    async (input) => {
      try {
        const adAccountId = resolveAdAccountId(config, input.adAccountId);
        const base = `/ad_accounts/${segment(adAccountId)}`;
        const definitions: Record<string, { endpoint: string; query?: Record<string, unknown> }> = {
          CONVERSION_TAGS: { endpoint: `${base}/conversion_tags`, query: { filter_deleted: input.includeDeletedTags } },
          OCPM_ELIGIBLE: { endpoint: `${base}/conversion_tags/ocpm_eligible` },
          PAGE_VISIT: { endpoint: `${base}/conversion_tags/page_visit` },
          EVENT_QUALITY_SCORE: { endpoint: `${base}/conversion_eqs`, query: { lookback_period: input.lookbackPeriod, source_platform: input.sourcePlatform, ingestion_source: input.ingestionSource } },
          ADVERTISER_DEFINED_EVENTS: { endpoint: `${base}/advertiser_defined_events` },
          DELETION_REQUESTS: { endpoint: `${base}/conversion_deletion_requests`, query: { page_size: input.pageSize, bookmark: input.bookmark } },
        };
        const selected = Object.fromEntries(input.surfaces.map((surface) => [surface, definitions[surface]]));
        const { data, errors } = await collectReads(client, selected);
        return ok({ surfaces: input.surfaces, data, errors, partial: Object.keys(errors).length > 0 });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_get_catalog_diagnostics",
    "Read deep catalog inventory and diagnostics: catalogs, feeds, feed processing results, item issues, product groups, product counts/products, available filter values, and catalog item lookups. ITEMS is a read-only POST lookup.",
    {
      adAccountId: idSchema.optional(),
      mode: z.enum(["CATALOGS", "FEEDS", "FEED", "PROCESSING_RESULTS", "ITEM_ISSUES", "PRODUCT_GROUPS", "PRODUCT_GROUP", "PRODUCT_COUNTS", "PRODUCTS", "AVAILABLE_FILTER_VALUES", "ITEMS", "BATCH_STATUS"]),
      catalogId: idSchema.optional(),
      feedId: idSchema.optional(),
      processingResultId: idSchema.optional(),
      batchId: idSchema.optional().describe("Catalog item batch ID returned by pinterest_batch_catalog_items."),
      productGroupId: idSchema.optional(),
      request: z.record(z.unknown()).optional().describe("Required for ITEMS; Pinterest CatalogsItemsRequest with country, language, and filters."),
      pageSize: pageSizeSchema,
      bookmark: bookmarkSchema,
      query: querySchema,
    },
    async (input) => {
      try {
        const adAccountId = resolveAdAccountId(config, input.adAccountId, false);
        const page = pageQuery(input.pageSize, input.bookmark, input.query);
        let endpoint: string;
        let data: unknown;
        switch (input.mode) {
          case "CATALOGS": endpoint = "/catalogs"; data = await client.getResource(endpoint, { ...page, ad_account_id: adAccountId || undefined }); break;
          case "FEEDS": endpoint = "/catalogs/feeds"; data = await client.getResource(endpoint, { ...page, ad_account_id: adAccountId || undefined, catalog_id: input.catalogId }); break;
          case "FEED":
            requireValue(input.feedId, "feedId", input.mode);
            endpoint = `/catalogs/feeds/${segment(input.feedId!)}`;
            data = await client.getResource(endpoint, { ...(input.query || {}), ad_account_id: adAccountId || undefined });
            break;
          case "PROCESSING_RESULTS":
            requireValue(input.feedId, "feedId", input.mode);
            endpoint = `/catalogs/feeds/${segment(input.feedId!)}/processing_results`;
            data = await client.getResource(endpoint, { ...page, ad_account_id: adAccountId || undefined });
            break;
          case "ITEM_ISSUES":
            requireValue(input.processingResultId, "processingResultId", input.mode);
            endpoint = `/catalogs/processing_results/${segment(input.processingResultId!)}/item_issues`;
            data = await client.getResource(endpoint, { ...page, ad_account_id: adAccountId || undefined });
            break;
          case "PRODUCT_GROUPS": endpoint = "/catalogs/product_groups"; data = await client.getResource(endpoint, { ...page, ad_account_id: adAccountId || undefined, catalog_id: input.catalogId, feed_id: input.feedId }); break;
          case "PRODUCT_GROUP":
            requireValue(input.productGroupId, "productGroupId", input.mode);
            endpoint = `/catalogs/product_groups/${segment(input.productGroupId!)}`;
            data = await client.getResource(endpoint, { ...(input.query || {}), ad_account_id: adAccountId || undefined });
            break;
          case "PRODUCT_COUNTS":
            requireValue(input.productGroupId, "productGroupId", input.mode);
            endpoint = `/catalogs/product_groups/${segment(input.productGroupId!)}/product_counts`;
            data = await client.getResource(endpoint, { ...(input.query || {}), ad_account_id: adAccountId || undefined });
            break;
          case "PRODUCTS":
            requireValue(input.productGroupId, "productGroupId", input.mode);
            endpoint = `/catalogs/product_groups/${segment(input.productGroupId!)}/products`;
            data = await client.getResource(endpoint, { ...page, ad_account_id: adAccountId || undefined });
            break;
          case "AVAILABLE_FILTER_VALUES":
            requireValue(input.catalogId, "catalogId", input.mode);
            endpoint = "/catalogs/available_filter_values";
            data = await client.getResource(endpoint, { ...(input.query || {}), catalog_id: input.catalogId, feed_id: input.feedId, ad_account_id: adAccountId || undefined });
            break;
          case "BATCH_STATUS": {
            requireValue(input.batchId, "batchId", input.mode);
            endpoint = `/catalogs/items/batch/${segment(input.batchId!)}`;
            data = await client.getResource(endpoint, { ad_account_id: adAccountId || undefined });
            const batch = asObject(data);
            const items = Array.isArray(batch.items) ? batch.items as Record<string, unknown>[] : [];
            return ok({ mode: input.mode, endpoint, ...batch,
              fullySucceeded: batch.status === "COMPLETED" && items.length > 0 && items.every(item => item.status === "SUCCESS" && !(Array.isArray(item.errors) && item.errors.length)),
            });
          }
          case "ITEMS":
            if (!input.request) throw new PinterestMcpError("request is required for catalog ITEMS lookup.", 400, "missing_request");
            endpoint = "/catalogs/items";
            data = await client.postReadQuery(endpoint, input.request, { ad_account_id: adAccountId || undefined });
            break;
        }
        return ok({ mode: input.mode, endpoint, ...shapeResponse(data) });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_run_specialized_export",
    "Start or inspect non-mutating Pinterest data jobs for Marketing Mix Modeling (MMM), bulk advertiser entity downloads, or catalog diagnostics. START creates only a report/export artifact; it never updates delivery entities.",
    {
      adAccountId: idSchema.optional(),
      exportType: z.enum(["MMM", "BULK_ENTITIES", "CATALOG_DIAGNOSTICS"]),
      action: z.enum(["START", "STATUS"]).default("START"),
      request: z.record(z.unknown()).optional().describe("Pinterest request body required by START."),
      token: z.string().optional().describe("MMM or catalog report token required by STATUS."),
      bulkRequestId: idSchema.optional().describe("Bulk request ID required by BULK_ENTITIES STATUS."),
      includeDetails: z.boolean().default(true),
    },
    async (input) => {
      try {
        const adAccountId = resolveAdAccountId(config, input.adAccountId);
        const base = `/ad_accounts/${segment(adAccountId)}`;
        let endpoint: string;
        let data: unknown;

        if (input.action === "START") {
          if (!input.request) throw new PinterestMcpError("request is required when action=START.", 400, "missing_request");
          if (input.exportType === "MMM") {
            endpoint = `${base}/mmm_reports`;
            data = await client.postReadQuery(endpoint, input.request);
          } else if (input.exportType === "BULK_ENTITIES") {
            endpoint = `${base}/bulk/download`;
            data = await client.postReadQuery(endpoint, input.request);
          } else {
            endpoint = "/catalogs/reports";
            data = await client.postReadQuery(endpoint, input.request, { ad_account_id: adAccountId });
          }
        } else if (input.exportType === "BULK_ENTITIES") {
          requireValue(input.bulkRequestId, "bulkRequestId", `${input.exportType} STATUS`);
          endpoint = `${base}/bulk/${segment(input.bulkRequestId!)}`;
          data = await client.getResource(endpoint, { include_details: input.includeDetails });
        } else {
          requireValue(input.token, "token", `${input.exportType} STATUS`);
          endpoint = input.exportType === "MMM" ? `${base}/mmm_reports` : "/catalogs/reports";
          data = await client.getResource(endpoint, {
            token: input.token,
            ad_account_id: input.exportType === "CATALOG_DIAGNOSTICS" ? adAccountId : undefined,
          });
        }

        return ok({
          exportType: input.exportType,
          action: input.action,
          endpoint,
          ...shapeResponse(data),
          lifecycle: "Report/export artifact only; poll with action=STATUS using the returned token or bulk request ID.",
        });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_get_lead_assets",
    "Read lead-form definitions and lead subscription configuration. Lead-record export is intentionally excluded because it can contain end-user PII.",
    {
      adAccountId: idSchema.optional(),
      mode: z.enum(["LEAD_FORMS", "LEAD_FORM", "SUBSCRIPTIONS", "SUBSCRIPTION"]),
      leadFormId: idSchema.optional(),
      subscriptionId: idSchema.optional(),
      pageSize: pageSizeSchema,
      bookmark: bookmarkSchema,
      query: querySchema,
    },
    async (input) => {
      try {
        const adAccountId = resolveAdAccountId(config, input.adAccountId);
        const base = `/ad_accounts/${segment(adAccountId)}`;
        let endpoint: string;
        switch (input.mode) {
          case "LEAD_FORMS": endpoint = `${base}/lead_forms`; break;
          case "LEAD_FORM": requireValue(input.leadFormId, "leadFormId", input.mode); endpoint = `${base}/lead_forms/${segment(input.leadFormId!)}`; break;
          case "SUBSCRIPTIONS": endpoint = `${base}/leads/subscriptions`; break;
          case "SUBSCRIPTION": requireValue(input.subscriptionId, "subscriptionId", input.mode); endpoint = `${base}/leads/subscriptions/${segment(input.subscriptionId!)}`; break;
        }
        const data = await client.getResource(endpoint, input.mode === "LEAD_FORMS"
          ? pageQuery(input.pageSize, input.bookmark, input.query)
          : input.query || {});
        return ok({ mode: input.mode, endpoint, ...shapeResponse(data), privacy: "Configuration only; no exported lead records or end-user PII." });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_get_business_assets",
    "Read Pinterest Business Access inventory: employers/linked businesses, assets, members, partners, assigned assets, received audiences, and invites. Requires the corresponding business-management permissions.",
    {
      mode: z.enum(["EMPLOYERS", "LINKED_BUSINESSES", "ASSETS", "ASSET_MEMBERS", "ASSET_PARTNERS", "MEMBERS", "MEMBER_ASSETS", "PARTNERS", "PARTNER_ASSETS", "RECEIVED_AUDIENCES", "INVITES"]),
      adAccountId: idSchema.optional().describe("Selected ad account used to verify the business relationship."),
      businessId: idSchema.optional(),
      assetId: idSchema.optional(),
      memberId: idSchema.optional(),
      partnerId: idSchema.optional(),
      pageSize: pageSizeSchema,
      bookmark: bookmarkSchema,
      query: querySchema,
      allowCrossBusinessRead: z.boolean().optional().default(false)
        .describe("Explicit opt-in required if businessId cannot be linked to the selected ad account."),
      includePersonalIdentifiers: z.boolean().optional().default(false)
        .describe("MEMBERS, ASSET_MEMBERS and INVITES only. Explicitly include member IDs/email/username; false redacts them."),
    },
    async (input) => {
      try {
        let endpoint: string;
        let warnings: string[] = [];
        if (input.mode === "EMPLOYERS") endpoint = "/businesses/employers";
        else if (input.mode === "LINKED_BUSINESSES") endpoint = "/user_account/businesses";
        else {
          requireValue(input.businessId, "businessId", input.mode);
          warnings = await verifyBusinessReadScope(
            client,
            input.businessId!,
            resolveAdAccountId(config, input.adAccountId, false),
            input.allowCrossBusinessRead
          );
          const base = `/businesses/${segment(input.businessId!)}`;
          switch (input.mode) {
            case "ASSETS": endpoint = `${base}/assets`; break;
            case "ASSET_MEMBERS": requireValue(input.assetId, "assetId", input.mode); endpoint = `${base}/assets/${segment(input.assetId!)}/members`; break;
            case "ASSET_PARTNERS": requireValue(input.assetId, "assetId", input.mode); endpoint = `${base}/assets/${segment(input.assetId!)}/partners`; break;
            case "MEMBERS": endpoint = `${base}/members`; break;
            case "MEMBER_ASSETS": requireValue(input.memberId, "memberId", input.mode); endpoint = `${base}/members/${segment(input.memberId!)}/assets`; break;
            case "PARTNERS": endpoint = `${base}/partners`; break;
            case "PARTNER_ASSETS": requireValue(input.partnerId, "partnerId", input.mode); endpoint = `${base}/partners/${segment(input.partnerId!)}/assets`; break;
            case "RECEIVED_AUDIENCES": endpoint = `${base}/audiences`; break;
            case "INVITES": endpoint = `${base}/invites`; break;
            default: throw new PinterestMcpError(`Unsupported business mode ${input.mode}.`, 400);
          }
        }
        const data = await client.getResource(endpoint, pageQuery(input.pageSize, input.bookmark, input.query));
        const exposesPersonalIdentifiers = ["MEMBERS", "ASSET_MEMBERS", "INVITES"].includes(input.mode);
        const safeData = exposesPersonalIdentifiers && !input.includePersonalIdentifiers
          ? redactPinterestBusinessPersonalIdentifiers(data, input.mode)
          : data;
        if (exposesPersonalIdentifiers) {
          warnings.push(input.includePersonalIdentifiers
            ? "SENSITIVE PERSONAL IDENTIFIERS INCLUDED BY EXPLICIT OPT-IN: Pinterest member/invite IDs, email addresses, and usernames may be present. Restrict storage, sharing, and model output."
            : "Pinterest member/invite IDs, email addresses, and usernames were redacted by default. Set includePersonalIdentifiers=true only with explicit authorization.");
        }
        return ok({ mode: input.mode, endpoint, ...shapeResponse(safeData), warnings });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_get_billing_and_orders",
    "Read billing profiles/invoices, invoice download URLs, order lines, ads-credit discounts, and SSIO account/order status. Financial data is returned only when the token has account access.",
    {
      adAccountId: idSchema.optional(),
      mode: z.enum(["BILLING_PROFILES", "BILLING_INVOICES", "BILLING_INVOICE_DOWNLOAD", "ORDER_LINES", "ORDER_LINE", "ADS_CREDIT_DISCOUNTS", "SSIO_ACCOUNT", "SSIO_INSERTION_ORDER_STATUS", "SSIO_ORDER_LINES"]),
      entityId: idSchema.optional().describe("Invoice ID, order-line ID, or Pinterest order ID depending on mode."),
      pageSize: pageSizeSchema,
      bookmark: bookmarkSchema,
      query: querySchema,
    },
    async (input) => {
      try {
        const adAccountId = resolveAdAccountId(config, input.adAccountId);
        const base = `/ad_accounts/${segment(adAccountId)}`;
        let endpoint: string;
        switch (input.mode) {
          case "BILLING_PROFILES": endpoint = `${base}/billing_profiles`; break;
          case "BILLING_INVOICES": endpoint = `${base}/billing_invoices`; break;
          case "BILLING_INVOICE_DOWNLOAD": requireValue(input.entityId, "entityId (invoice ID)", input.mode); endpoint = `${base}/billing_invoice/${segment(input.entityId!)}/download`; break;
          case "ORDER_LINES": endpoint = `${base}/order_lines`; break;
          case "ORDER_LINE": requireValue(input.entityId, "entityId (order line ID)", input.mode); endpoint = `${base}/order_lines/${segment(input.entityId!)}`; break;
          case "ADS_CREDIT_DISCOUNTS": endpoint = `${base}/ads_credit/discounts`; break;
          case "SSIO_ACCOUNT": endpoint = `${base}/ssio/accounts`; break;
          case "SSIO_INSERTION_ORDER_STATUS": endpoint = input.entityId ? `${base}/ssio/insertion_orders/${segment(input.entityId)}/status` : `${base}/ssio/insertion_orders/status`; break;
          case "SSIO_ORDER_LINES": endpoint = `${base}/ssio/order_lines`; break;
        }
        const paged = ["BILLING_PROFILES", "BILLING_INVOICES", "ORDER_LINES"].includes(input.mode);
        const data = await client.getResource(endpoint, paged
          ? pageQuery(input.pageSize, input.bookmark, input.query)
          : input.query || {});
        return ok({ mode: input.mode, endpoint, sensitiveDataClass: "authorized_account_financial_metadata", ...shapeResponse(data) });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_get_pin_analytics",
    "Read paid Pin analytics, organic multi/single-Pin analytics, user-account analytics, top Pins, or top video Pins. Pass raw metric names supported by the selected Pinterest endpoint.",
    {
      adAccountId: idSchema.optional(),
      mode: z.enum(["PAID_PINS", "ORGANIC_PINS", "ORGANIC_PIN", "USER_ACCOUNT", "TOP_PINS", "TOP_VIDEO_PINS"]),
      pinId: idSchema.optional(),
      pinIds: z.array(idSchema).max(100).optional(),
      campaignId: idSchema.optional(),
      startDate: dateSchema,
      endDate: dateSchema,
      metrics: z.array(z.string()).min(1).max(50),
      granularity: z.enum(["TOTAL", "DAY", "HOUR", "WEEK", "MONTH"]).default("DAY"),
      sortBy: z.string().optional().describe("Required by Pinterest top-Pin endpoints; defaults to IMPRESSION."),
      query: querySchema,
    },
    async (input) => {
      try {
        validateDateOrder(input.startDate, input.endDate);
        let endpoint: string;
        const baseQuery: Record<string, unknown> = {
          ...(input.query || {}),
          start_date: input.startDate,
          end_date: input.endDate,
        };
        let query: Record<string, unknown>;
        switch (input.mode) {
          case "PAID_PINS": {
            const adAccountId = resolveAdAccountId(config, input.adAccountId);
            requireValue(input.campaignId, "campaignId", input.mode);
            requireList(input.pinIds, "pinIds", input.mode);
            endpoint = `/ad_accounts/${segment(adAccountId)}/pins/analytics`;
            query = { ...baseQuery, campaign_id: input.campaignId, pin_ids: input.pinIds, columns: input.metrics, granularity: input.granularity };
            break;
          }
          case "ORGANIC_PINS": requireList(input.pinIds, "pinIds", input.mode); endpoint = "/pins/analytics"; query = { ...baseQuery, pin_ids: input.pinIds, metric_types: input.metrics, ad_account_id: input.adAccountId }; break;
          case "ORGANIC_PIN": requireValue(input.pinId, "pinId", input.mode); endpoint = `/pins/${segment(input.pinId!)}/analytics`; query = { ...baseQuery, metric_types: input.metrics, ad_account_id: input.adAccountId }; break;
          case "USER_ACCOUNT": endpoint = "/user_account/analytics"; query = { ...baseQuery, metric_types: input.metrics, ad_account_id: input.adAccountId }; break;
          case "TOP_PINS": endpoint = "/user_account/analytics/top_pins"; query = { ...baseQuery, metric_types: input.metrics, sort_by: input.sortBy || "IMPRESSION", ad_account_id: input.adAccountId }; break;
          case "TOP_VIDEO_PINS": endpoint = "/user_account/analytics/top_video_pins"; query = { ...baseQuery, metric_types: input.metrics, sort_by: input.sortBy || "IMPRESSION", ad_account_id: input.adAccountId }; break;
        }
        const data = await client.getResource(endpoint, query);
        return ok({ mode: input.mode, endpoint, ...shapeResponse(data) });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_get_organic_inventory",
    "Read organic Pinterest content used alongside ads: Pins, boards, Pins on a board, Pin product tags, or search results. This is inventory metadata, not proof of paid delivery.",
    {
      mode: z.enum(["PINS", "PIN", "BOARDS", "BOARD", "BOARD_PINS", "PRODUCT_TAGS", "SEARCH_PINS"]),
      pinId: idSchema.optional(),
      boardId: idSchema.optional(),
      searchTerm: z.string().min(1).optional(),
      pageSize: pageSizeSchema,
      bookmark: bookmarkSchema,
      query: querySchema,
    },
    async (input) => {
      try {
        let endpoint: string;
        switch (input.mode) {
          case "PINS": endpoint = "/pins"; break;
          case "PIN": requireValue(input.pinId, "pinId", input.mode); endpoint = `/pins/${segment(input.pinId!)}`; break;
          case "BOARDS": endpoint = "/boards"; break;
          case "BOARD": requireValue(input.boardId, "boardId", input.mode); endpoint = `/boards/${segment(input.boardId!)}`; break;
          case "BOARD_PINS": requireValue(input.boardId, "boardId", input.mode); endpoint = `/boards/${segment(input.boardId!)}/pins`; break;
          case "PRODUCT_TAGS": requireValue(input.pinId, "pinId", input.mode); endpoint = `/pins/${segment(input.pinId!)}/product_tags`; break;
          case "SEARCH_PINS": requireValue(input.searchTerm, "searchTerm", input.mode); endpoint = "/search/pins"; break;
        }
        const paged = ["PINS", "BOARDS", "BOARD_PINS"].includes(input.mode);
        const data = await client.getResource(endpoint, {
          ...(paged ? pageQuery(input.pageSize, input.bookmark, input.query) : input.query || {}),
          bookmark: input.mode === "SEARCH_PINS" ? input.bookmark : undefined,
          query: input.mode === "SEARCH_PINS" ? input.searchTerm : undefined,
        });
        return ok({ mode: input.mode, endpoint, ...shapeResponse(data) });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_get_trends",
    "Read Pinterest Trends: top growing/monthly/yearly/seasonal keywords by supported region, growing product categories, product-category details, featured topics, or editorial articles.",
    {
      mode: z.enum(["KEYWORDS", "PRODUCT_CATEGORIES", "PRODUCT_CATEGORY_DETAILS", "FEATURED_TOPICS", "EDITORIAL_ARTICLES"]),
      region: trendRegionSchema.default("FR"),
      productRegion: z.enum(["US", "GB+IE", "CA"]).default("US"),
      trendType: z.enum(["growing", "monthly", "yearly", "seasonal"]).default("growing"),
      limit: z.number().int().min(1).max(50).default(50),
      interests: z.array(z.string()).optional(),
      genders: z.array(z.string()).optional(),
      ageBuckets: z.array(z.string()).optional(),
      includeKeywords: z.array(z.string()).optional(),
      includeDemographics: z.boolean().optional(),
      productCategories: z.array(z.string()).min(1).max(20).optional(),
      verticals: z.array(z.string()).optional(),
      productLookbackDays: z.union([z.literal(90), z.literal(180), z.literal(365), z.literal(730)]).default(365),
      productEngagementType: z.enum(["ENGAGEMENT", "OUTBOUND_CLICK", "SAVE"]).default("ENGAGEMENT"),
      featuredInterest: z.string().optional(),
      query: querySchema,
    },
    async (input) => {
      try {
        let endpoint: string;
        switch (input.mode) {
          case "KEYWORDS": endpoint = `/trends/keywords/${segment(input.region)}/top/${input.trendType}`; break;
          case "PRODUCT_CATEGORIES": endpoint = "/trends/product_categories/trending"; break;
          case "PRODUCT_CATEGORY_DETAILS": requireList(input.productCategories, "productCategories", input.mode); endpoint = "/trends/product_categories/details"; break;
          case "FEATURED_TOPICS": endpoint = "/trends/topics/featured"; break;
          case "EDITORIAL_ARTICLES": endpoint = "/trends/editorial_articles"; break;
        }
        let query: Record<string, unknown>;
        if (input.mode === "KEYWORDS") query = {
          ...(input.query || {}),
          limit: input.limit,
          interests: input.interests,
          genders: input.genders,
          ages: input.ageBuckets,
          include_keywords: input.includeKeywords,
          include_demographics: input.includeDemographics,
        };
        else if (input.mode === "PRODUCT_CATEGORIES") query = {
          ...(input.query || {}),
          region: input.productRegion,
          verticals: input.verticals,
          ages: input.ageBuckets,
          genders: input.genders,
          engagement_type: input.productEngagementType,
        };
        else if (input.mode === "PRODUCT_CATEGORY_DETAILS") query = {
          ...(input.query || {}),
          region: input.productRegion,
          product_categories: input.productCategories,
          lookback_window: input.productLookbackDays,
          engagement_type: input.productEngagementType,
        };
        else if (input.mode === "FEATURED_TOPICS") query = {
          ...(input.query || {}),
          region: input.productRegion,
          interest: input.featuredInterest,
        };
        else query = {
          ...(input.query || {}),
          region: input.productRegion,
        };
        const data = await client.getResource(endpoint, query);
        return ok({ mode: input.mode, endpoint, region: input.mode === "KEYWORDS" ? input.region : input.productRegion, ...shapeResponse(data) });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );

  server.tool(
    "pinterest_get_platform_resources",
    "Read Pinterest platform metadata and readiness resources: supported ad-account countries, delivery metric definitions, metrics readiness, lead-form questions, media upload metadata, commerce integration metadata, or the authenticated user account.",
    {
      mode: z.enum(["AD_ACCOUNT_COUNTRIES", "DELIVERY_METRICS", "METRICS_READY_STATE", "LEAD_FORM_QUESTIONS", "MEDIA", "MEDIA_ITEM", "INTEGRATIONS", "INTEGRATION", "USER_ACCOUNT", "WEBSITES"]),
      entityId: idSchema.optional().describe("Media or integration ID for detail modes."),
      reportType: z.enum(["SYNC", "ASYNC"]).optional(),
      date: dateSchema.optional().describe("Required by METRICS_READY_STATE."),
      pageSize: pageSizeSchema,
      bookmark: bookmarkSchema,
      query: querySchema,
    },
    async (input) => {
      try {
        let endpoint: string;
        switch (input.mode) {
          case "AD_ACCOUNT_COUNTRIES": endpoint = "/resources/ad_account_countries"; break;
          case "DELIVERY_METRICS": endpoint = "/resources/delivery_metrics"; break;
          case "METRICS_READY_STATE": endpoint = "/resources/metrics_ready_state"; break;
          case "LEAD_FORM_QUESTIONS": endpoint = "/resources/lead_form_questions"; break;
          case "MEDIA": endpoint = "/media"; break;
          case "MEDIA_ITEM": requireValue(input.entityId, "entityId (media ID)", input.mode); endpoint = `/media/${segment(input.entityId!)}`; break;
          case "INTEGRATIONS": endpoint = "/integrations"; break;
          case "INTEGRATION": requireValue(input.entityId, "entityId (integration ID)", input.mode); endpoint = `/integrations/${segment(input.entityId!)}`; break;
          case "USER_ACCOUNT": endpoint = "/user_account"; break;
          case "WEBSITES": endpoint = "/user_account/websites"; break;
        }
        if (input.mode === "METRICS_READY_STATE") requireValue(input.date, "date", input.mode);
        const paged = input.mode === "MEDIA" || input.mode === "INTEGRATIONS";
        const data = await client.getResource(endpoint, {
          ...(paged ? pageQuery(input.pageSize, input.bookmark, input.query) : input.query || {}),
          report_type: input.reportType,
          date: input.mode === "METRICS_READY_STATE" ? input.date : undefined,
        });
        return ok({ mode: input.mode, endpoint, ...shapeResponse(data) });
      } catch (error) {
        return formatMcpToolError(error);
      }
    }
  );
}

function ok(data: unknown) {
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ source: "pinterest_ads", apiVersion: "v5", readOnly: true, ...asObject(redactPinterestSecrets(data)) }, null, 2),
    }],
  };
}

function asObject(data: unknown): Record<string, unknown> {
  return isRecord(data) ? data : { data };
}

function resolveAdAccountId(config: PinterestConfig, input?: string, required = true): string {
  const adAccountId = input || config.defaultAdAccountId;
  if (!adAccountId && required) {
    throw new PinterestMcpError("adAccountId is required. Pass it in the tool input or set PINTEREST_AD_ACCOUNT_ID.", 400, "missing_ad_account_id");
  }
  return adAccountId || "";
}

async function verifyBusinessReadScope(
  client: PinterestClient,
  businessId: string,
  selectedAdAccountId: string,
  allowCrossBusinessRead: boolean
): Promise<string[]> {
  let linked = false;
  let detail = selectedAdAccountId
    ? `Business ${businessId} does not expose selected ad account ${selectedAdAccountId} as an AD_ACCOUNT asset.`
    : "No selected ad account is available to verify the Pinterest Business relationship.";

  if (selectedAdAccountId) {
    try {
      linked = await client.businessHasAdAccount(businessId, selectedAdAccountId);
    } catch (error) {
      detail = `Pinterest could not verify that Business ${businessId} contains selected ad account ${selectedAdAccountId}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  if (linked) return [];
  if (!allowCrossBusinessRead) {
    throw new PinterestMcpError(
      `${detail} Set allowCrossBusinessRead=true only for an explicitly authorized cross-business read.`,
      403,
      "cross_business_opt_in_required"
    );
  }
  return [`CROSS-BUSINESS READ ENABLED BY EXPLICIT OPT-IN: ${detail} The token may return data outside the selected ad-account boundary.`];
}

function segment(value: string): string {
  return encodeURIComponent(value);
}

function pageQuery(pageSize: number, bookmark?: string, query?: Record<string, unknown>): Record<string, unknown> {
  return { ...(query || {}), page_size: pageSize, bookmark };
}

function shapeResponse(data: unknown): Record<string, unknown> {
  if (Array.isArray(data)) return { rows: data, rowCount: data.length };
  if (isRecord(data) && Array.isArray(data.items)) {
    return {
      items: data.items,
      rowCount: data.items.length,
      bookmark: typeof data.bookmark === "string" ? data.bookmark : null,
      hasMore: typeof data.bookmark === "string" && data.bookmark.length > 0,
    };
  }
  return { data };
}

function targetingAnalyticsEndpoint(adAccountId: string, level: "AD_ACCOUNT" | "CAMPAIGN" | "AD_GROUP" | "AD"): string {
  const base = `/ad_accounts/${segment(adAccountId)}`;
  if (level === "AD_ACCOUNT") return `${base}/targeting_analytics`;
  if (level === "CAMPAIGN") return `${base}/campaigns/targeting_analytics`;
  if (level === "AD_GROUP") return `${base}/ad_groups/targeting_analytics`;
  return `${base}/ads/targeting_analytics`;
}

function targetingIdParam(level: "AD_ACCOUNT" | "CAMPAIGN" | "AD_GROUP" | "AD"): string | undefined {
  if (level === "CAMPAIGN") return "campaign_ids";
  if (level === "AD_GROUP") return "ad_group_ids";
  if (level === "AD") return "ad_ids";
  return undefined;
}

function attributionFrom(input: {
  clickWindowDays: number;
  engagementWindowDays: number;
  viewWindowDays: number;
  conversionReportTime: string;
  attributionTypes?: string[];
  reportingTimezone: string;
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

function validateDateOrder(startDate: string, endDate: string): void {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  const startIsExact = Number.isFinite(start) && new Date(start).toISOString().slice(0, 10) === startDate;
  const endIsExact = Number.isFinite(end) && new Date(end).toISOString().slice(0, 10) === endDate;
  if (!startIsExact || !endIsExact || start > end) {
    throw new PinterestMcpError("startDate must be on or before endDate and both must be valid calendar dates.", 400, "invalid_date_range");
  }
}

function requireValue(value: unknown, field: string, mode: string): asserts value {
  if (value === undefined || value === null || value === "") {
    throw new PinterestMcpError(`${field} is required when mode=${mode}.`, 400, "missing_parameter");
  }
}

function requireList(value: unknown[] | undefined, field: string, mode: string): asserts value is unknown[] {
  if (!value?.length) {
    throw new PinterestMcpError(`${field} must contain at least one value when mode=${mode}.`, 400, "missing_parameter");
  }
}

async function collectReads(
  client: PinterestClient,
  definitions: Record<string, { endpoint: string; query?: Record<string, unknown> }>
): Promise<{ data: Record<string, unknown>; errors: Record<string, string> }> {
  const entries = await Promise.all(Object.entries(definitions).map(async ([name, definition]) => {
    try {
      const value = await client.getResource(definition.endpoint, definition.query || {});
      return [name, value, undefined] as const;
    } catch (error) {
      return [name, undefined, error instanceof Error ? error.message : String(error)] as const;
    }
  }));
  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const [name, value, error] of entries) {
    if (error) errors[name] = error;
    else data[name] = value;
  }
  return { data, errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
