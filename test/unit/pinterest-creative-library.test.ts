import { afterEach, describe, expect, it, vi } from "vitest";
import { collect } from "./catalogue";

/**
 * Handler de la bibliothèque créative Pinterest, exercé avec fetch mocké sur
 * les formes de la spec v5 (v5.28.0, 28/08/2026) : ads → pins → media, statuts
 * forcés (l'API omet ARCHIVED par défaut), formats catalogue exclus, et un
 * plafond de résolution de pins (quota d'app Pinterest le plus serré du produit).
 */

const CONFIG = { accessToken: "test-token" } as const;

type ToolResult = { content: [{ type: "text"; text: string }]; isError?: boolean };

function pinterestTool(name: string) {
  const tool = collect("pinterest_ads", CONFIG).find((t) => t.name === name);
  if (!tool) throw new Error(`tool ${name} introuvable dans le registre pinterest_ads`);
  return tool;
}

function parsePayload(result: ToolResult): Record<string, unknown> {
  expect(result.isError).not.toBe(true);
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const CAMPAIGNS = [{ id: "c1", name: "BF nov 2025", objective_type: "AWARENESS" }];
// Vérifié en live : les ad groups classiques portent feed_profile_id "0" (chaîne),
// qui ne doit PAS être pris pour un feed catalogue.
const AD_GROUPS = [{ id: "g1", campaign_id: "c1", feed_profile_id: "0" }];
const ADS = [
  { id: "a1", ad_group_id: "g1", name: "Pin image", pin_id: "p1", status: "ARCHIVED", creative_type: "REGULAR" },
  { id: "a2", ad_group_id: "g1", name: "Pin vidéo", pin_id: "p2", status: "ACTIVE", creative_type: "VIDEO" },
  { id: "a3", ad_group_id: "g1", name: "Shopping", pin_id: "p3", status: "ACTIVE", creative_type: "SHOPPING" },
];
const PINS: Record<string, unknown> = {
  p1: {
    id: "p1",
    title: "Visuel soldes",
    media: {
      media_type: "image",
      images: {
        "600x": { url: "https://i.pinimg.com/600x/ab/cd/ef.jpg", width: 600, height: 600 },
        "1200x": { url: "https://i.pinimg.com/1200x/ab/cd/ef.jpg", width: 1200, height: 1200 },
      },
    },
  },
  p2: {
    id: "p2",
    title: "UGC vidéo",
    media: {
      media_type: "video",
      cover_image_url: "https://i.pinimg.com/1200x/co/ve/r.jpg",
      video_url: "https://v1.pinimg.com/videos/mc/720p/xy.mp4",
      images: { "600x": { url: "https://i.pinimg.com/600x/co/ve/r.jpg" } },
    },
  },
};

function stubPinterestFetch(overrides: { pinFailureIds?: string[] } = {}) {
  const requested: URL[] = [];
  const fetchMock = vi.fn(async (input: unknown) => {
    const url = new URL(String(input));
    requested.push(url);
    if (url.pathname.endsWith("/ads")) return jsonResponse({ items: ADS });
    if (url.pathname.endsWith("/campaigns")) return jsonResponse({ items: CAMPAIGNS });
    if (url.pathname.endsWith("/ad_groups")) return jsonResponse({ items: AD_GROUPS });
    if (url.pathname.endsWith("/product_group_promotions")) return jsonResponse({ items: [] });
    const pinMatch = url.pathname.match(/\/pins\/(.+)$/);
    if (pinMatch) {
      const pinId = pinMatch[1];
      if (overrides.pinFailureIds?.includes(pinId)) return jsonResponse({ message: "Pin not found.", status: "failure" }, 404);
      return jsonResponse(PINS[pinId] ?? { id: pinId, media: {} });
    }
    throw new Error(`URL inattendue: ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, requested };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pinterest_list_ad_creatives", () => {
  it("force les trois statuts, exclut le catalogue et résout les médias des pins", async () => {
    const { requested } = stubPinterestFetch();

    const result = (await pinterestTool("pinterest_list_ad_creatives").handler({
      adAccountId: "549xxx",
    })) as ToolResult;
    const payload = parsePayload(result);

    const adsUrl = requested.find((u) => u.pathname.endsWith("/ads"));
    expect(adsUrl?.searchParams.get("entity_statuses")).toBe("ACTIVE,PAUSED,ARCHIVED");
    // La shopping ad est exclue AVANT la résolution : son pin n'est jamais lu.
    expect(requested.some((u) => u.pathname.endsWith("/pins/p3"))).toBe(false);

    expect(payload.scannedAdCount).toBe(3);
    expect(payload.skippedCatalogCount).toBe(1);
    expect(payload.count).toBe(2);
    const creatives = payload.creatives as Record<string, unknown>[];
    const image = creatives.find((c) => c.adId === "a1") as Record<string, unknown>;
    expect(image.status).toBe("ARCHIVED");
    expect((image.imageUrls as string[])[0]).toContain("/1200x/");
    expect(image.assetType).toBe("IMAGE");
    const video = creatives.find((c) => c.adId === "a2") as Record<string, unknown>;
    expect(video.videoUrl).toContain("720p");
    expect(video.thumbnailUrl).toContain("i.pinimg.com");
    expect((payload.warnings as string[]).length).toBe(0);
    expect((payload.limitations as string[]).join(" ")).toContain("i.pinimg.com");
  });

  it("omet entity_statuses quand includeArchived est désactivé", async () => {
    const { requested } = stubPinterestFetch();

    await pinterestTool("pinterest_list_ad_creatives").handler({
      adAccountId: "549xxx",
      includeArchived: false,
    });

    const adsUrl = requested.find((u) => u.pathname.endsWith("/ads"));
    expect(adsUrl?.searchParams.get("entity_statuses")).toBeNull();
  });

  it("plafonne la résolution de pins et le signale", async () => {
    stubPinterestFetch();

    const result = (await pinterestTool("pinterest_list_ad_creatives").handler({
      adAccountId: "549xxx",
      maxPins: 1,
    })) as ToolResult;
    const payload = parsePayload(result);

    expect(payload.resolvedPinCount).toBe(1);
    const creatives = payload.creatives as Record<string, unknown>[];
    expect(creatives.filter((c) => c.mediaResolved === false)).toHaveLength(1);
    expect((payload.warnings as string[]).some((w) => w.includes("maxPins"))).toBe(true);
  });

  it("exclut un ad group relié à un vrai feed catalogue, mais pas feed_profile_id \"0\"", async () => {
    const requested: URL[] = [];
    const fetchMock = vi.fn(async (input: unknown) => {
      const url = new URL(String(input));
      requested.push(url);
      if (url.pathname.endsWith("/ads")) {
        return jsonResponse({ items: [
          { id: "a1", ad_group_id: "g1", pin_id: "p1", status: "ACTIVE", creative_type: "REGULAR" },
          { id: "a9", ad_group_id: "g9", pin_id: "p9", status: "ACTIVE", creative_type: "REGULAR" },
        ] });
      }
      if (url.pathname.endsWith("/campaigns")) return jsonResponse({ items: CAMPAIGNS });
      if (url.pathname.endsWith("/ad_groups")) {
        return jsonResponse({ items: [
          { id: "g1", campaign_id: "c1", feed_profile_id: "0" },
          { id: "g9", campaign_id: "c1", feed_profile_id: "1000000000001" },
        ] });
      }
      if (url.pathname.endsWith("/product_group_promotions")) return jsonResponse({ items: [] });
      if (url.pathname.includes("/pins/")) return jsonResponse(PINS.p1 ?? {});
      throw new Error(`URL inattendue: ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = (await pinterestTool("pinterest_list_ad_creatives").handler({
      adAccountId: "549xxx",
    })) as ToolResult;
    const payload = parsePayload(result);

    expect(payload.count).toBe(1);
    expect(payload.skippedCatalogCount).toBe(1);
    expect((payload.creatives as Record<string, unknown>[])[0].adId).toBe("a1");
  });

  it("transforme un pin illisible en warning sans faire échouer l'appel", async () => {
    stubPinterestFetch({ pinFailureIds: ["p2"] });

    const result = (await pinterestTool("pinterest_list_ad_creatives").handler({
      adAccountId: "549xxx",
    })) as ToolResult;
    const payload = parsePayload(result);

    expect(payload.count).toBe(2);
    expect(payload.resolvedPinCount).toBe(1);
    expect((payload.warnings as string[]).some((w) => w.includes("could not be read"))).toBe(true);
  });
});

describe("targeted Pinterest gallery media", () => {
  it("filters upstream by ad IDs before resolving pins", async () => {
    const {requested} = stubPinterestFetch();
    await pinterestTool("pinterest_list_ad_creatives").handler({adAccountId:"123",adIds:["a1"],excludeCatalogFormats:false,maxAds:1,maxPins:1});
    expect(requested.find(u => u.pathname.endsWith("/ads"))?.searchParams.get("ad_ids")).toBe("a1");
    expect(requested.some(u => /campaigns|ad_groups|product_group_promotions/.test(u.pathname))).toBe(false);
    expect(requested.filter(u => u.pathname.includes("/pins/")).length).toBe(1);
  });
});
