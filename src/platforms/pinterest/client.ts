/**
 * pinterest-ads-mcp-server: an open-source MCP server for the Pinterest Ads API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import { pinterestApiBase } from "../../config.js";
import type { PinterestConfig } from "../../config.js";
import { PinterestMcpError } from "../../core/errors.js";
import { NO_REDIRECT, refuseRedirect } from "../../core/redirects.js";
import type {
  PinterestAd,
  PinterestAdAccount,
  PinterestAdGroup,
  PinterestAsyncReportCreateResponse,
  PinterestAsyncReportRequest,
  PinterestAsyncReportStatusResponse,
  PinterestCampaign,
  PinterestListResponse,
  PinterestPin,
  PinterestProductGroupPromotion,
  PinterestReportRow,
} from "./types.js";



/**
 * Refuse a report URL that points at the machine running this server or at a
 * private network. A crafted or mistaken value must not become a request to
 * localhost or to a cloud metadata endpoint.
 */
export function assertSafeReportUrl(rawUrl: string): void {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new PinterestMcpError(`Report URL is not a valid URL: ${rawUrl.slice(0, 120)}`, 400, "invalid_report_url");
  }
  if (url.protocol !== "https:") {
    throw new PinterestMcpError(`Report URL must use https, received ${url.protocol}`, 400, "invalid_report_url");
  }
  const host = url.hostname.toLowerCase();
  const isPrivate =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.startsWith("[");
  if (isPrivate) {
    throw new PinterestMcpError(`Report URL points at a private address: ${host}`, 400, "invalid_report_url");
  }
}

export class PinterestClient {
  private accessToken?: string;

  constructor(private readonly config: PinterestConfig) {
    this.accessToken = config.accessToken;
  }

  async getAdAccounts(bookmark?: string): Promise<PinterestListResponse<PinterestAdAccount>> {
    return this.requestWithParams("/ad_accounts", { page_size: 250, bookmark });
  }

  async getAllAdAccounts(): Promise<PinterestAdAccount[]> {
    return this.paginate((bookmark) => this.getAdAccounts(bookmark));
  }

  async getAdAccount(adAccountId: string): Promise<PinterestAdAccount> {
    return this.request(`/ad_accounts/${adAccountId}`);
  }

  async getCampaigns(adAccountId: string, bookmark?: string): Promise<PinterestListResponse<PinterestCampaign>> {
    return this.requestWithParams(`/ad_accounts/${adAccountId}/campaigns`, { page_size: 250, bookmark });
  }

  async getAllCampaigns(adAccountId: string): Promise<PinterestCampaign[]> {
    return this.paginate((bookmark) => this.getCampaigns(adAccountId, bookmark));
  }

  async getAdGroups(adAccountId: string, options: { campaignIds?: string[]; bookmark?: string } = {}): Promise<PinterestListResponse<PinterestAdGroup>> {
    return this.requestWithParams(`/ad_accounts/${adAccountId}/ad_groups`, {
      page_size: 250,
      campaign_ids: options.campaignIds,
      bookmark: options.bookmark,
    });
  }

  async getAllAdGroups(adAccountId: string, options: { campaignIds?: string[] } = {}): Promise<PinterestAdGroup[]> {
    return this.paginate((bookmark) => this.getAdGroups(adAccountId, { ...options, bookmark }));
  }

  async getAds(adAccountId: string, options: { campaignIds?: string[]; adGroupIds?: string[]; bookmark?: string } = {}): Promise<PinterestListResponse<PinterestAd>> {
    return this.requestWithParams(`/ad_accounts/${adAccountId}/ads`, {
      page_size: 250,
      campaign_ids: options.campaignIds,
      ad_group_ids: options.adGroupIds,
      bookmark: options.bookmark,
    });
  }

  async getAllAds(adAccountId: string, options: { campaignIds?: string[]; adGroupIds?: string[] } = {}): Promise<PinterestAd[]> {
    return this.paginate((bookmark) => this.getAds(adAccountId, { ...options, bookmark }));
  }

  async getPin(pinId: string, options: { adAccountId?: string; pinMetrics?: boolean } = {}): Promise<PinterestPin> {
    return this.requestWithParams(`/pins/${pinId}`, {
      ad_account_id: options.adAccountId,
      pin_metrics: options.pinMetrics ?? false,
    });
  }

  async getProductGroupPromotions(adAccountId: string, options: { bookmark?: string; adGroupId?: string; entityStatuses?: string[] } = {}): Promise<PinterestListResponse<PinterestProductGroupPromotion>> {
    return this.requestWithParams(`/ad_accounts/${adAccountId}/product_group_promotions`, {
      page_size: 250,
      order: "DESCENDING",
      bookmark: options.bookmark,
      ad_group_id: options.adGroupId,
      entity_statuses: options.entityStatuses,
    });
  }

  async getAllProductGroupPromotions(adAccountId: string): Promise<PinterestProductGroupPromotion[]> {
    return this.paginate((bookmark) => this.getProductGroupPromotions(adAccountId, { bookmark }));
  }

  async getCatalogs(options: { adAccountId?: string; bookmark?: string; pageSize?: number } = {}): Promise<PinterestListResponse<Record<string, unknown>>> {
    return this.requestWithParams("/catalogs", {
      ad_account_id: options.adAccountId,
      bookmark: options.bookmark,
      page_size: options.pageSize ?? 250,
    });
  }

  async getCatalogProductGroups(options: { ids?: string[]; adAccountId?: string; catalogId?: string; feedId?: string; bookmark?: string; pageSize?: number } = {}): Promise<PinterestListResponse<Record<string, unknown>>> {
    return this.requestWithParams("/catalogs/product_groups", {
      id: options.ids,
      ad_account_id: options.adAccountId,
      catalog_id: options.catalogId,
      feed_id: options.feedId,
      bookmark: options.bookmark,
      page_size: options.pageSize ?? 250,
    });
  }

  async getCatalogProductGroupProducts(productGroupId: string, options: { adAccountId?: string; pinMetrics?: boolean; bookmark?: string; pageSize?: number } = {}): Promise<PinterestListResponse<Record<string, unknown>>> {
    return this.requestWithParams(`/catalogs/product_groups/${productGroupId}/products`, {
      ad_account_id: options.adAccountId,
      pin_metrics: options.pinMetrics ?? false,
      bookmark: options.bookmark,
      page_size: options.pageSize ?? 25,
    });
  }

  async getDeliveryMetrics(reportType?: string): Promise<unknown> {
    return this.requestWithParams("/resources/delivery_metrics", { report_type: reportType });
  }

  /**
   * Read an authenticated Pinterest v5 resource that does not yet warrant a
   * dedicated client method. Tool registrations keep the endpoint allow-list;
   * callers cannot supply arbitrary paths directly.
   */
  async getResource<T = unknown>(endpoint: string, params: Record<string, unknown> = {}): Promise<T> {
    assertApiPath(endpoint);
    assertNoPinterestCredentials(params);
    return this.requestWithParams<T>(endpoint, params);
  }

  /**
   * Execute a Pinterest POST whose documented purpose is read-only computation
   * or retrieval (for example audience sizing, bid floors, catalog item lookup,
   * or delivery estimates). Mutating POST endpoints are never exposed by MCP
   * tools and must not be routed through this helper.
   */
  async postReadQuery<T = unknown>(endpoint: string, body: Record<string, unknown>, params: Record<string, unknown> = {}): Promise<T> {
    assertApiPath(endpoint);
    assertNoPinterestCredentials(params);
    assertNoPinterestCredentials(body);
    const queryString = buildQueryString(params);
    return this.request<T>(`${endpoint}${queryString ? `?${queryString}` : ""}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /** Verify that a Pinterest Business exposes the selected ad account as an AD_ACCOUNT asset. */
  async businessHasAdAccount(businessId: string, adAccountId: string): Promise<boolean> {
    let bookmark: string | undefined;
    for (let page = 0; page < 20; page += 1) {
      const response = await this.getResource<PinterestListResponse<Record<string, unknown>>>(
        `/businesses/${encodeURIComponent(businessId)}/assets`,
        { asset_type: "AD_ACCOUNT", page_size: 250, bookmark }
      );
      if ((response.items || []).some((asset) => String(asset.asset_id ?? "") === adAccountId)) return true;
      bookmark = response.bookmark || undefined;
      if (!bookmark) return false;
    }
    throw new PinterestMcpError("Pinterest Business asset verification exceeded 20 pages.", 409, "business_link_unresolved");
  }

  async runSyncAnalytics(endpoint: string, params: Record<string, unknown>): Promise<unknown> {
    return this.requestWithParams(endpoint, params);
  }

  async createAsyncReport(adAccountId: string, body: PinterestAsyncReportRequest): Promise<PinterestAsyncReportCreateResponse> {
    return this.request(`/ad_accounts/${adAccountId}/reports`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async getAsyncReport(adAccountId: string, token: string): Promise<PinterestAsyncReportStatusResponse> {
    return this.requestWithParams(`/ad_accounts/${adAccountId}/reports`, { token });
  }

  async waitForAsyncReport(adAccountId: string, token: string, options: { maxAttempts?: number; pollIntervalMs?: number } = {}): Promise<PinterestAsyncReportStatusResponse> {
    const maxAttempts = options.maxAttempts ?? 60;
    const pollIntervalMs = options.pollIntervalMs ?? 3_000;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const status = await this.getAsyncReport(adAccountId, token);
      if (status.report_status === "FINISHED" && status.url) return status;
      if (["FAILED", "CANCELLED", "EXPIRED", "DOES_NOT_EXIST"].includes(status.report_status)) {
        throw new PinterestMcpError(`Pinterest async report ${status.report_status.toLowerCase()}`, 400, status.report_status);
      }
      await delay(pollIntervalMs);
    }

    throw new PinterestMcpError(`Pinterest async report did not finish after ${maxAttempts} attempts`, 408, "timeout");
  }

  /**
   * Pinterest returns a download URL for a finished async report, on a host it
   * chooses. That URL is data from the API, not something to trust blindly, so
   * it is validated before being fetched: HTTPS only, no loopback or private
   * address, and no redirect. No credential is attached to this call.
   */
  async downloadJsonReport(url: string): Promise<PinterestReportRow[]> {
    assertSafeReportUrl(url);
    const response = await fetch(url, { redirect: "error" });
    if (!response.ok) {
      throw new PinterestMcpError(`Failed to download Pinterest report: ${response.statusText}`, response.status);
    }
    const payload = await response.json();
    return flattenReportRows(payload).map(normalizeCurrencyFields);
  }

  async createConversionProductReport(adAccountId: string, body: Record<string, unknown>): Promise<PinterestAsyncReportCreateResponse> {
    return this.request(`/ad_accounts/${adAccountId}/reports/brand_category_sku`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async getConversionProductReport(adAccountId: string, token: string): Promise<PinterestAsyncReportStatusResponse> {
    return this.requestWithParams(`/ad_accounts/${adAccountId}/reports/brand_category_sku`, { token });
  }

  private endpointForEnvironment(endpoint: string): string {
    // Sandbox does not support Business Access delegation. Organic/catalog endpoints
    // operate on the Sandbox token owner; advertiser endpoints retain their account path.
    if (this.config.environment !== "sandbox" || !/^\/(pins|boards|catalogs)(\/|\?|$)/.test(endpoint)) return endpoint;
    const url = new URL(endpoint, "https://api-sandbox.pinterest.com");
    url.searchParams.delete("ad_account_id");
    return url.pathname + url.search;
  }

  /** Single mutation attempt. A network failure or 5xx has an unknown outcome. */
  async mutate(endpoint: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<unknown> {
    assertApiPath(endpoint);
    assertNoPinterestCredentials(body);
    const token = await this.ensureAccessToken();
    let response: Response;
    try {
      response = await fetch(`${pinterestApiBase(this.config)}${this.endpointForEnvironment(endpoint)}`, {
        method, redirect: "error", signal: AbortSignal.timeout(45000),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      refuseRedirect(response, "Pinterest mutation");
    } catch {
      throw new Error("Pinterest mutation outcome unknown. Read the account before retrying; do not create a duplicate.");
    }
    if (response.status === 204) return {};
    const data = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!data || response.status >= 500) throw new Error("Pinterest mutation outcome unknown. Read the account before retrying.");
    if (!response.ok) throw new Error(`Pinterest HTTP ${response.status}: ${String(data.message ?? "mutation rejected").replaceAll(token, "[redacted]").slice(0,500)}`);
    return data;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, didRefresh = false, retryAttempt = 0): Promise<T> {
    const token = await this.ensureAccessToken();
    const method = String(options.method || "GET").toUpperCase();
    let response: Response;
    try {
      response = await fetch(`${pinterestApiBase(this.config)}${this.endpointForEnvironment(endpoint)}`, {
        ...options,
        redirect: "error",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
      refuseRedirect(response, "Pinterest API");
    } catch (error) {
      if (method === "GET" && retryAttempt < 2) {
        await delay(250 * 2 ** retryAttempt);
        return this.request<T>(endpoint, options, didRefresh, retryAttempt + 1);
      }
      throw error;
    }

    if (response.status === 401 && !didRefresh && this.config.refreshToken) {
      this.accessToken = undefined;
      await this.refreshAccessToken();
      return this.request<T>(endpoint, options, true, retryAttempt);
    }

    const retryable = response.status === 429 || (method === "GET" && response.status >= 500);
    if (retryable && retryAttempt < 2) {
      await delay(retryDelayMs(response.headers.get("retry-after"), retryAttempt));
      return this.request<T>(endpoint, options, didRefresh, retryAttempt + 1);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as Record<string, unknown>;
      throw new PinterestMcpError(
        typeof error.message === "string" ? error.message : `Pinterest API request failed: ${response.statusText}`,
        response.status,
        typeof error.status === "string" ? error.status : undefined
      );
    }

    return response.json() as Promise<T>;
  }

  private async requestWithParams<T>(endpoint: string, params: Record<string, unknown>): Promise<T> {
    const queryString = buildQueryString(params);
    return this.request<T>(`${endpoint}${queryString ? `?${queryString}` : ""}`);
  }

  private async paginate<T>(fetchPage: (bookmark?: string) => Promise<PinterestListResponse<T>>): Promise<T[]> {
    const items: T[] = [];
    let bookmark: string | undefined;
    do {
      const page = await fetchPage(bookmark);
      items.push(...(page.items || []));
      bookmark = page.bookmark;
    } while (bookmark);
    return items;
  }

  private async ensureAccessToken(): Promise<string> {
    if (this.accessToken) return this.accessToken;
    return this.refreshAccessToken();
  }

  private async refreshAccessToken(): Promise<string> {
    if (!this.config.refreshToken || !this.config.appId || !this.config.appSecret) {
      throw new PinterestMcpError("Pinterest access token is missing and refresh credentials are not configured.");
    }

    const credentials = Buffer.from(`${this.config.appId}:${this.config.appSecret}`).toString("base64");
    const response = await fetch(`${pinterestApiBase(this.config)}/oauth/token`, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.config.refreshToken,
      }),
    });
    refuseRedirect(response, "Pinterest token refresh");

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as Record<string, unknown>;
      throw new PinterestMcpError(
        typeof error.message === "string" ? error.message : "Failed to refresh Pinterest access token",
        response.status,
        typeof error.status === "string" ? error.status : undefined
      );
    }

    const payload = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!payload.access_token) {
      throw new PinterestMcpError("Pinterest refresh response did not include an access token.");
    }
    await this.config.onTokenRefresh?.({ accessToken: payload.access_token, refreshToken: payload.refresh_token, expiresIn: payload.expires_in });
    if (payload.refresh_token) this.config.refreshToken = payload.refresh_token;
    this.accessToken = payload.access_token;
    return this.accessToken;
  }
}

function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length > 0) searchParams.append(key, value.join(","));
      continue;
    }
    searchParams.append(key, String(value));
  }
  return searchParams.toString();
}

function assertApiPath(endpoint: string): void {
  if (!endpoint.startsWith("/") || endpoint.includes("://") || endpoint.includes("..")) {
    throw new PinterestMcpError("Pinterest API endpoint must be a safe relative v5 path.", 400, "invalid_endpoint");
  }
}

function assertNoPinterestCredentials(value: unknown, path = "request"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPinterestCredentials(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  const blocked = new Set([
    "access_token",
    "authorization",
    "client_secret",
    "app_secret",
    "refresh_token",
  ]);
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (blocked.has(key.toLowerCase())) {
      throw new PinterestMcpError(
        `Credential field ${path}.${key} is not accepted in Pinterest tool input.`,
        400,
        "sensitive_parameter"
      );
    }
    assertNoPinterestCredentials(nested, `${path}.${key}`);
  }
}

function retryDelayMs(retryAfter: string | null, retryAttempt: number): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 10_000);
    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) return Math.min(Math.max(retryAt - Date.now(), 0), 10_000);
  }
  return Math.min(500 * 2 ** retryAttempt, 4_000);
}

function flattenReportRows(payload: unknown): PinterestReportRow[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload.items)) return payload.items.filter(isRecord);

  const rows: PinterestReportRow[] = [];
  const stack = Object.values(payload);
  const seen = new WeakSet<object>();
  while (stack.length > 0) {
    const value = stack.pop();
    if (Array.isArray(value)) {
      stack.push(...value);
      continue;
    }
    if (!isRecord(value)) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    if (looksLikeReportRow(value)) rows.push(value);
    else stack.push(...Object.values(value));
  }
  return rows;
}

function looksLikeReportRow(row: Record<string, unknown>): boolean {
  return [
    "DATE",
    "CAMPAIGN_ID",
    "AD_GROUP_ID",
    "AD_ID",
    "PIN_PROMOTION_ID",
    "PRODUCT_GROUP_ID",
    "PRODUCT_ITEM_NAME",
    "SPEND_IN_DOLLAR",
    "SPEND_IN_MICRO_DOLLAR",
  ].some((field) => row[field] !== undefined);
}

function normalizeCurrencyFields(row: PinterestReportRow): PinterestReportRow {
  const normalized = { ...row };
  for (const [key, value] of Object.entries(row)) {
    if (!key.endsWith("_IN_MICRO_DOLLAR")) continue;
    const dollarKey = key.replace("_IN_MICRO_DOLLAR", "_IN_DOLLAR");
    if (normalized[dollarKey] === undefined && typeof value === "number") {
      normalized[dollarKey] = value / 1_000_000;
    }
  }
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
