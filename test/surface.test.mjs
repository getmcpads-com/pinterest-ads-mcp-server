import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.ts";
import { PinterestClient } from "../src/platforms/pinterest/client.ts";

test("Pinterest client encodes GET arrays and read-only POST bodies", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ items: [], bookmark: null }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const client = new PinterestClient({ accessToken: "test-token", logLevel: "error" });
    await client.getResource("/ad_accounts/123/keywords", {
      ad_group_ids: ["10", "20"],
      match_types: ["BROAD", "EXACT"],
      page_size: 100,
    });
    await client.postReadQuery("/ad_accounts/123/ad_groups/audience_sizing", {
      targeting_spec: { GEO: ["FR"] },
    });
    await client.postReadQuery("/catalogs/reports", { report_name: "feed issues" }, { ad_account_id: "123" });

    assert.equal(calls.length, 3);
    const url = new URL(calls[0].url);
    assert.equal(url.pathname, "/v5/ad_accounts/123/keywords");
    assert.equal(url.searchParams.get("ad_group_ids"), "10,20");
    assert.equal(url.searchParams.get("match_types"), "BROAD,EXACT");
    assert.equal(calls[0].init.headers.Authorization, "Bearer test-token");
    assert.equal(calls.every((call) => call.init.redirect === "error"), true);
    assert.equal(calls[1].init.method, "POST");
    assert.deepEqual(JSON.parse(calls[1].init.body), {
      targeting_spec: { GEO: ["FR"] },
    });
    assert.equal(new URL(calls[2].url).searchParams.get("ad_account_id"), "123");
    assert.deepEqual(JSON.parse(calls[2].init.body), { report_name: "feed issues" });
    await assert.rejects(
      client.getResource("/ad_accounts/123/campaigns", { access_token: "must-not-pass" }),
      /Credential field/
    );
    await assert.rejects(
      client.postReadQuery("/catalogs/items", { filters: { authorization: "must-not-pass" } }),
      /Credential field/
    );
    assert.equal(calls.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Pinterest business reads enforce selected-account scope and redact personal identifiers", async () => {
  const originalFetch = globalThis.fetch;
  let linked = true;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/v5/businesses/biz-1/assets") {
      return new Response(JSON.stringify({ items: [{ asset_id: linked ? "123" : "999", asset_type: "AD_ACCOUNT" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.pathname === "/v5/businesses/biz-1/members") {
      return new Response(JSON.stringify({
        items: [{
          id: "member-1",
          business_roles: ["EMPLOYEE"],
          user: { id: "user-1", email: "member@example.com", username: "member-name" },
          assets_summary: { ad_accounts: [{ id: "123" }] },
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const server = createServer({ accessToken: "test-token", defaultAdAccountId: "123", logLevel: "error" });
  const client = new Client({ name: "pinterest-business-safety-test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const safe = await client.callTool({
      name: "pinterest_get_business_assets",
      arguments: { mode: "MEMBERS", businessId: "biz-1" },
    });
    assert.notEqual(safe.isError, true);
    const safePayload = JSON.parse(safe.content.find((item) => item.type === "text")?.text);
    assert.equal(safePayload.items[0].id, "[REDACTED]");
    assert.deepEqual(safePayload.items[0].user, {
      id: "[REDACTED]",
      email: "[REDACTED]",
      username: "[REDACTED]",
    });
    assert.equal(safePayload.items[0].assets_summary.ad_accounts[0].id, "123");

    const raw = await client.callTool({
      name: "pinterest_get_business_assets",
      arguments: { mode: "MEMBERS", businessId: "biz-1", includePersonalIdentifiers: true },
    });
    const rawPayload = JSON.parse(raw.content.find((item) => item.type === "text")?.text);
    assert.equal(rawPayload.items[0].user.email, "member@example.com");
    assert.match(rawPayload.warnings[0], /EXPLICIT OPT-IN/);

    linked = false;
    const blocked = await client.callTool({
      name: "pinterest_get_business_assets",
      arguments: { mode: "MEMBERS", businessId: "biz-1" },
    });
    assert.equal(blocked.isError, true);
    const blockedPayload = JSON.parse(blocked.content.find((item) => item.type === "text")?.text);
    assert.match(blockedPayload.error, /allowCrossBusinessRead=true/);

    const allowed = await client.callTool({
      name: "pinterest_get_business_assets",
      arguments: { mode: "MEMBERS", businessId: "biz-1", allowCrossBusinessRead: true },
    });
    assert.notEqual(allowed.isError, true);
    const allowedPayload = JSON.parse(allowed.content.find((item) => item.type === "text")?.text);
    assert.match(allowedPayload.warnings.join(" "), /CROSS-BUSINESS READ ENABLED BY EXPLICIT OPT-IN/);
  } finally {
    await client.close().catch(() => undefined);
    await server.close().catch(() => undefined);
    globalThis.fetch = originalFetch;
  }
});

test("Pinterest client retries a rate-limited physical GET request", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) {
      return new Response(JSON.stringify({ message: "rate limited" }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "0" },
      });
    }
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const client = new PinterestClient({ accessToken: "test-token", logLevel: "error" });
    await client.getResource("/ad_accounts", { page_size: 1 });
    assert.equal(attempts, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("keyword intelligence calls the official country metrics endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify([
      { keyword: "canape design", avg_monthly_searches: 12000 },
    ]), { status: 200, headers: { "content-type": "application/json" } });
  };

  const server = createServer({ accessToken: "test-token", defaultAdAccountId: "123", logLevel: "error" });
  const client = new Client({ name: "pinterest-surface-test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = await client.callTool({
      name: "pinterest_get_keyword_intelligence",
      arguments: {
        mode: "COUNTRY_METRICS",
        countryCode: "fr",
        keywords: ["canape design"],
      },
    });
    assert.notEqual(result.isError, true);
    const text = result.content.find((item) => item.type === "text")?.text;
    const payload = JSON.parse(text);
    assert.equal(payload.source, "pinterest_ads");
    assert.equal(payload.readOnly, true);
    assert.equal(payload.mode, "COUNTRY_METRICS");
    assert.equal(payload.rows[0].avg_monthly_searches, 12000);
    const url = new URL(calls[0].url);
    assert.equal(url.pathname, "/v5/ad_accounts/123/keywords/metrics");
    assert.equal(url.searchParams.get("country_code"), "FR");
    assert.equal(url.searchParams.get("keywords"), "canape design");
  } finally {
    await client.close().catch(() => undefined);
    await server.close().catch(() => undefined);
    globalThis.fetch = originalFetch;
  }
});

test("targeting report uses the targeting analytics endpoint and preserves attribution", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify([{ AD_GROUP_ID: "44", TARGETING_TYPE: "KEYWORD", SPEND_IN_DOLLAR: 12.5 }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const server = createServer({ accessToken: "test-token", defaultAdAccountId: "123", logLevel: "error" });
  const client = new Client({ name: "pinterest-targeting-test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = await client.callTool({
      name: "pinterest_run_targeting_report",
      arguments: {
        level: "AD_GROUP",
        entityIds: ["44"],
        startDate: "2026-06-01",
        endDate: "2026-06-30",
        targetingTypes: ["KEYWORD", "INTEREST"],
        columns: ["SPEND_IN_DOLLAR"],
      },
    });
    assert.notEqual(result.isError, true);
    const payload = JSON.parse(result.content.find((item) => item.type === "text")?.text);
    assert.equal(payload.endpoint, "/ad_accounts/123/ad_groups/targeting_analytics");
    assert.equal(payload.rowCount, 1);
    assert.equal(payload.attribution.clickWindowDays, 30);
    const url = new URL(calls[0].url);
    assert.equal(url.pathname, "/v5/ad_accounts/123/ad_groups/targeting_analytics");
    assert.equal(url.searchParams.get("ad_group_ids"), "44");
    assert.equal(url.searchParams.get("targeting_types"), "KEYWORD,INTEREST");
  } finally {
    await client.close().catch(() => undefined);
    await server.close().catch(() => undefined);
    globalThis.fetch = originalFetch;
  }
});

test("surface tools reject missing mode-specific identifiers before network access", async () => {
  const server = createServer({ accessToken: "test-token", defaultAdAccountId: "123", logLevel: "error" });
  const client = new Client({ name: "pinterest-validation-test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = await client.callTool({
      name: "pinterest_get_catalog_diagnostics",
      arguments: { mode: "ITEM_ISSUES" },
    });
    assert.equal(result.isError, true);
    const payload = JSON.parse(result.content.find((item) => item.type === "text")?.text);
    assert.match(payload.error, /processingResultId is required/);
  } finally {
    await client.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
});
