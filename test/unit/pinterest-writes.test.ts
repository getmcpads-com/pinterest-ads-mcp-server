import { afterEach, describe, expect, it, vi } from "vitest";
import { collect } from "./catalogue";
import { PinterestClient } from "../../src/platforms/pinterest/client";
import { pinterestMutationResult } from "../../src/platforms/pinterest/writes";
const config = {
  accessToken: "fixture",
  environment: "sandbox",
  logLevel: "error",
} as const;
async function call(name: string, args: Record<string, unknown>) {
  const t = collect("pinterest_ads", config).find((t) => t.name === name)!;
  const r = (await t.handler(args)) as any;
  return { ...JSON.parse(r.content[0].text), isError: r.isError };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("Pinterest writes", () => {
  it("previews all ad levels in PAUSED without network", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    for (const [tool, args] of [
      [
        "pinterest_create_campaign",
        { name: "QA", objective: "CONSIDERATION", dailyBudget: 10 },
      ],
      [
        "pinterest_create_adgroup",
        {
          campaignId: "200",
          configuration: {
            name: "QA group",
            billable_event: "CLICKTHROUGH",
            budget_in_micro_currency: 10000000,
            bid_in_micro_currency: 1000000,
          },
        },
      ],
      [
        "pinterest_create_ad",
        {
          adGroupId: "300",
          pinId: "400",
          configuration: { creative_type: "REGULAR" },
        },
      ],
    ] as const) {
      const r = await call(tool, { adAccountId: "123", ...args });
      expect(r.isError, JSON.stringify(r)).not.toBe(true);
      expect(r.payload.status).toBe("PAUSED");
      expect(r.environment).toBe("sandbox");
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("maps lifetime ad group budgets to the actual native field and rejects ambiguous budgets", async () => {
    const r = await call("pinterest_update_adgroup_budget", {
      adAccountId: "123",
      adGroupId: "200",
      lifetimeBudget: 12.5,
    });
    expect(r.payload).toEqual({
      id: "200",
      budget_in_micro_currency: 12500000,
      budget_type: "LIFETIME",
    });
    expect(
      (
        await call("pinterest_update_adgroup_budget", {
          adAccountId: "123",
          adGroupId: "200",
          dailyBudget: 10,
          lifetimeBudget: 20,
        })
      ).isError,
    ).toBe(true);
  });
  it("validates native targeting and required ad fields before any mutation", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    for (const configuration of [
      { creative_type: "invented" },
      { creative_type: "REGULAR", access_token: "bad" },
    ])
      expect(
        (
          await call("pinterest_create_ad", {
            adAccountId: "123",
            adGroupId: "300",
            pinId: "400",
            configuration,
            confirm: true,
          })
        ).isError,
      ).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });
  it("checks references in the selected advertiser and sends mutations only to Sandbox", async () => {
    const f = vi.fn(async (url: string, init?: RequestInit) =>
      Response.json(
        init?.method === "POST"
          ? { items: [{ data: { id: "500" }, exceptions: [] }] }
          : { id: "123" },
      ),
    );
    vi.stubGlobal("fetch", f);
    const r = await call("pinterest_create_ad", {
      adAccountId: "123",
      adGroupId: "300",
      pinId: "400",
      configuration: { creative_type: "REGULAR" },
      confirm: true,
    });
    expect(r.applied).toBe(true);
    expect(f.mock.calls.map((c) => c[0])).toEqual([
      "https://api-sandbox.pinterest.com/v5/ad_accounts/123",
      "https://api-sandbox.pinterest.com/v5/ad_accounts/123/ad_groups/300",
      "https://api-sandbox.pinterest.com/v5/pins/400",
      "https://api-sandbox.pinterest.com/v5/ad_accounts/123/ads",
      "https://api-sandbox.pinterest.com/v5/ad_accounts/123/ads/500",
    ]);
    expect(r.verification.confirmed).toBe(false);
    expect(f.mock.calls.filter(c => c[1]?.method === "POST")).toHaveLength(1);
    expect(f.mock.calls.at(-1)?.[1]?.redirect).toBe("error");
  });
  it("reports HTTP 200 per-item failures instead of falsely claiming success", () => {
    expect(
      pinterestMutationResult({
        items: [{ exceptions: [{ message: "invalid pin" }] }],
      }),
    ).toMatchObject({ applied: false, outcome: "rejected" });
    expect(
      pinterestMutationResult({
        items: [
          { data: { id: "1" } },
          { exceptions: [{ message: "invalid" }] },
        ],
      }),
    ).toMatchObject({ applied: false, outcome: "partial" });
    expect(pinterestMutationResult({ batch_id: "1" }, true)).toMatchObject({
      applied: false,
      outcome: "accepted",
    });
  });
  it("never retries an ambiguous mutation", async () => {
    const f = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") throw new Error("network");
      return Response.json({ id: "123" });
    });
    vi.stubGlobal("fetch", f);
    const r = await call("pinterest_create_campaign", {
      adAccountId: "123",
      name: "QA",
      objective: "AWARENESS",
      dailyBudget: 10,
      confirm: true,
    });
    expect(r.outcome).toBe("unknown");
    expect(f.mock.calls.filter((c) => c[1]?.method === "POST")).toHaveLength(1);
  });
  it("persists rotated refresh credentials and keeps token exchange in Sandbox", async () => {
    const saved = vi.fn();
    const f = vi.fn(async (url: string, init?: RequestInit) =>
      String(url).endsWith("/oauth/token")
        ? Response.json({
            access_token: "new-access",
            refresh_token: "new-refresh",
            expires_in: 100,
          })
        : new Headers(init?.headers).get("authorization") ===
            "Bearer new-access"
          ? Response.json({ id: "123" })
          : Response.json({}, { status: 401 }),
    );
    vi.stubGlobal("fetch", f);
    const client = new PinterestClient({
      ...config,
      refreshToken: "old-refresh",
      appId: "app",
      appSecret: "secret",
      onTokenRefresh: saved,
    });
    await client.getAdAccount("123");
    expect(saved).toHaveBeenCalledWith({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresIn: 100,
    });
    expect(
      f.mock.calls.every((c) =>
        c[0].startsWith("https://api-sandbox.pinterest.com/v5/"),
      ),
    ).toBe(true);
  });
  it("refuses unsupported Sandbox video Pins and shopping ads explicitly", async () => {
    expect(
      (
        await call("pinterest_create_ad", {
          adAccountId: "123",
          adGroupId: "300",
          pinId: "400",
          configuration: { creative_type: "SHOPPING" },
        })
      ).error,
    ).toContain("Sandbox");
  });
});

describe("Pinterest native creative and catalog contracts", () => {
  it("validates image Pin and per-item catalog batches, including AJV string/enum helpers", async () => {
    const pin = await call("pinterest_create_pin", {
      adAccountId: "123",
      configuration: {
        board_id: "200",
        title: "QA image",
        media_source: {
          source_type: "image_base64",
          content_type: "image/png",
          data: "aGVsbG8=",
        },
      },
    });
    expect(pin.isError, JSON.stringify(pin)).not.toBe(true);
    const batch = await call("pinterest_batch_catalog_items", {
      adAccountId: "123",
      configuration: {
        catalog_type: "RETAIL",
        country: "FR",
        language: "FR",
        items: [
          {
            item_id: "qa",
            operation: "UPDATE",
            attributes: { price: "10 EUR" },
          },
        ],
      },
    });
    expect(batch.isError, JSON.stringify(batch)).not.toBe(true);
  });
  it("keeps production user endpoints scoped to the selected advertiser", async () => {
    const f = vi.fn(async () => Response.json({ id: "200" }));
    vi.stubGlobal("fetch", f);
    await new PinterestClient({ ...config, environment: "production" }).getPin(
      "200",
      { adAccountId: "123" },
    );
    expect(f.mock.calls[0][0]).toContain(
      "https://api.pinterest.com/v5/pins/200?ad_account_id=123",
    );
  });
  it("refuses shopping promotion execution in Sandbox before any network call", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(
      (
        await call("pinterest_create_product_group_promotion", {
          adAccountId: "123",
          adGroupId: "200",
          productGroupId: "300",
          configuration: {},
          confirm: true,
        })
      ).error,
    ).toContain("not supported");
    expect(f).not.toHaveBeenCalled();
  });
  it("will not expose a feed password in a mutation response", async () => {
    const f = vi.fn(async (url: string, init?: RequestInit) =>
      Response.json(
        init?.method === "PATCH"
          ? {
              id: "200",
              credentials: { username: "feed-user", password: "feed-password" },
            }
          : url.endsWith("/user_account")
            ? { id: "owner" }
            : { id: "123", owner: { id: "owner" } },
      ),
    );
    vi.stubGlobal("fetch", f);
    const r = await call("pinterest_update_catalog_feed", {
      adAccountId: "123",
      feedId: "200",
      configuration: { name: "updated feed" },
      confirm: true,
    });
    expect(r.isError, JSON.stringify(r)).not.toBe(true);
    expect(JSON.stringify(r)).not.toContain("feed-password");
    expect(r.result.credentials).toBe("[REDACTED]");
  });
  it("does not report a FAILED asynchronous batch as accepted", () => {
    expect(
      pinterestMutationResult({ status: "FAILED", batch_id: "1" }, true),
    ).toMatchObject({ applied: false, outcome: "rejected" });
  });
});

it('preserves batch completion metadata and never treats per-item failure as complete success', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({batch_id:'222',status:'COMPLETED',completed_time:'2026-09-10T10:00:00',items:[{item_id:'qa',status:'FAILURE',errors:[{code:1008}]}]})));
  const r=await call('pinterest_get_catalog_diagnostics',{adAccountId:'123',mode:'BATCH_STATUS',batchId:'222'});
  expect(r.batch_id).toBe('222');expect(r.status).toBe('COMPLETED');expect(r.fullySucceeded).toBe(false);
});
it('keeps native schema definitions intact when they describe feed credentials', async () => {
 const r=await call('pinterest_get_write_schema',{request:'CatalogsFeedCreateRequestSchema'});
 expect(r.schema.components.schemas.CatalogsFeedsCreateRequest.properties.credentials).toBeTypeOf('object');
});

it.each([
 ['pinterest_create_catalog_feed',{configuration:{name:'QA feed',format:'TSV',location:'https://example.com/catalog.tsv',default_country:'FR',default_currency:'EUR',default_locale:'fr'}}],
 ['pinterest_update_product_group',{productGroupId:'371',configuration:{name:'QA renamed group'}}],
 ['pinterest_register_media',{configuration:{media_type:'video'}}],
 ['pinterest_create_campaign',{name:'QA non-CBO',objective:'CONSIDERATION',configuration:{is_campaign_budget_optimization:false}}],
] as const)('validates the native %s request without accessing the network',async(name,args)=>{
 const f=vi.fn();vi.stubGlobal('fetch',f);const r=await call(name,{adAccountId:'123',...args});expect(r.isError,JSON.stringify(r)).not.toBe(true);expect(f).not.toHaveBeenCalled();
});
it('forces production shopping promotions to PAUSED and validates each referenced object in account context',async()=>{
 const f=vi.fn(async(_url:string,init?:RequestInit)=>Response.json(init?.method==='POST'?{items:[{data:{id:'444'}}]}:{id:'123'}));vi.stubGlobal('fetch',f);
 const tool=collect('pinterest_ads',{...config,environment:'production'}).find(t=>t.name==='pinterest_create_product_group_promotion')!;
 const result=await tool.handler({adAccountId:'123',adGroupId:'200',productGroupId:'300',configuration:{status:'ACTIVE',creative_type:'SHOPPING'},confirm:true}) as any;
 expect(result.isError).not.toBe(true);
 const mutation=f.mock.calls.at(-1)!;expect(mutation[0]).toBe('https://api.pinterest.com/v5/ad_accounts/123/product_group_promotions');expect(JSON.parse(String(mutation[1]?.body)).product_group_promotion[0].status).toBe('PAUSED');
 expect(f.mock.calls.some(([url])=>url==='https://api.pinterest.com/v5/catalogs/product_groups/300?ad_account_id=123')).toBe(true);
});

it('requires explicit board visibility instead of silently using ungranted secret-board scopes',async()=>{
 expect((await call('pinterest_create_board',{adAccountId:'123',configuration:{name:'QA'}})).error).toContain('privacy explicitly');
 expect((await call('pinterest_create_board',{adAccountId:'123',configuration:{name:'QA',privacy:'PUBLIC'}})).isError).not.toBe(true);
});
