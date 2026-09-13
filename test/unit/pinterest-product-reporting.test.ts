import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { collect } from "./catalogue";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});

async function run(name: string, input: Record<string, unknown>) {
  const tool = collect("pinterest_ads", { accessToken: "test-token" }).find(t => t.name === name)!;
  const result = await tool.handler(z.object(tool.shape).parse({ adAccountId: "123456789", ...input }));
  return { isError: result.isError, payload: JSON.parse(result.content[0].text) };
}

function stubReports() {
  const bodies: Record<string, unknown>[] = [];
  const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = new URL(String(input));
    if (init?.method === "POST") {
      bodies.push(JSON.parse(String(init.body)));
      return json({ token: "report-token", report_status: "IN_PROGRESS" });
    }
    if (url.pathname.endsWith("/reports")) {
      return json({ report_status: "FINISHED", url: "https://reports.example.test/result.json" });
    }
    if (url.hostname === "reports.example.test") return json([]);
    throw new Error(`Unexpected request: ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { bodies, fetchMock };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-10T23:55:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Pinterest product reporting", () => {
  it("rejects item dates older than 92 UTC days before any network call, without silently truncating", async () => {
    const { fetchMock } = stubReports();
    const result = await run("pinterest_run_catalog_report", {
      breakdown: "PRODUCT_ITEM", startDate: "2026-06-09", endDate: "2026-08-01",
    });
    expect(result.isError).toBe(true);
    expect(result.payload.platformStatus).toBe("product_item_history_unavailable");
    expect(result.payload.error).toContain("2026-06-10");
    expect(result.payload.error).toContain("Retrying or splitting");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts the inclusive 92-day boundary and preserves 31-day request windows", async () => {
    const { bodies } = stubReports();
    const result = await run("pinterest_run_catalog_report", {
      breakdown: "PRODUCT_ITEM", startDate: "2026-06-10", endDate: "2026-07-11",
    });
    expect(result.isError).not.toBe(true);
    expect(bodies.map(b => [b.start_date, b.end_date, b.level])).toEqual([
      ["2026-06-10", "2026-07-10", "PRODUCT_ITEM"],
      ["2026-07-11", "2026-07-11", "PRODUCT_ITEM"],
    ]);
    expect(result.payload.rows).toEqual([]);
  });

  it("moves the retention boundary at UTC midnight", async () => {
    vi.setSystemTime(new Date("2026-09-11T00:00:00.000Z"));
    const { fetchMock } = stubReports();
    const result = await run("pinterest_run_catalog_report", {
      breakdown: "PRODUCT_ITEM", startDate: "2026-06-10", endDate: "2026-06-10",
    });
    expect(result.payload.error).toContain("2026-06-11");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still retrieves historical PRODUCT_GROUP totals", async () => {
    const { bodies } = stubReports();
    const result = await run("pinterest_run_catalog_report", {
      startDate: "2025-11-01", endDate: "2025-11-30",
    });
    expect(result.isError).not.toBe(true);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ level: "PRODUCT_GROUP", start_date: "2025-11-01", end_date: "2025-11-30" });
  });

  it.each([
    ["2026-02-30", "2026-03-01"], ["invalid", "2026-08-01"], ["2026-08-02", "2026-08-01"],
  ])("rejects malformed or reversed dates (%s, %s) before making requests", async (startDate, endDate) => {
    const { fetchMock } = stubReports();
    const result = await run("pinterest_run_catalog_report", { breakdown: "PRODUCT_ITEM", startDate, endDate });
    expect(result.payload.platformStatus).toBe("invalid_date_range");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses native conversion-product columns and surfaces client access denial", async () => {
    const fetchMock = vi.fn(async () => json({ code: 1, message: "Brand category SKU report is not available for this client." }, 400));
    vi.stubGlobal("fetch", fetchMock);
    const result = await run("pinterest_run_conversion_product_report", {
      startDate: "2025-11-01", endDate: "2025-11-30", conversionProductBreakdown: "PRODUCT_SKU",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [unknown, RequestInit])[1].body));
    expect(request.columns).toEqual(["TOTAL_CHECKOUT_CONVERSION_PRODUCT_QUANTITY", "TOTAL_CHECKOUT_CONVERSION_PRODUCT_VALUE"]);
    expect(result.isError).toBe(true);
    expect(result.payload.error).toContain("not available for this client");
  });
});
