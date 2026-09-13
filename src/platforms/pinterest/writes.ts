/** Copyright 2026 GetMCPAds. SPDX-License-Identifier: Apache-2.0 */
import { redactPinterestSecrets } from "./privacy";
import { z } from "zod";
import type { ToolShape } from "../../tool-quality.js";
import { PinterestClient } from "./client";
import type { PinterestConfig } from "../../config.js";
import { toMicroCurrency } from "../../core/money.js";
import * as validators from "./generated/pinterest/validators.js";
import schemas from "./generated/pinterest/write-schemas.json";

type Row = Record<string, any>;
type Collector = {
  tool: (
    name: string,
    description: string,
    shape: ToolShape,
    handler: (a: Row) => Promise<unknown>,
  ) => void;
};
const id = z
  .string()
  .regex(/^\d+$/, "Pinterest IDs are numeric, without act_ prefixes.")
  .describe("Numeric Pinterest entity ID in the selected advertiser context.");
const native = z
  .record(z.unknown())
  .describe(
    "Native Pinterest v5 request fields. Read pinterest_get_write_schema first. Monetary native fields are integer micro currency units.",
  );
const confirm = z
  .boolean()
  .optional()
  .describe(
    "Only true applies the displayed change. Omit for a local preview.",
  );
const amount = z.number().positive().max(1_000_000);
const out = (data: unknown, isError = false, redact = true) => ({
  ...(isError ? { isError: true } : {}),
  content: [
    {
      type: "text" as const,
      text: JSON.stringify(redact ? redactPinterestSecrets(data) : data, null, 2),
    },
  ],
});
const status = z
  .enum(["ACTIVE", "PAUSED", "ARCHIVED"])
  .describe(
    "Requested entity status; ACTIVE can resume real delivery in production.",
  );
export const PINTEREST_EXTENDED_WRITES = new Set([
  "pinterest_update_campaign_configuration",
  "pinterest_create_adgroup",
  "pinterest_update_adgroup_configuration",
  "pinterest_create_ad",
  "pinterest_update_ad",
  "pinterest_update_ad_status",
  "pinterest_create_product_group_promotion",
  "pinterest_update_product_group_promotion",
  "pinterest_create_board",
  "pinterest_update_board",
  "pinterest_create_pin",
  "pinterest_update_pin",
  "pinterest_register_media",
  "pinterest_create_catalog",
  "pinterest_create_catalog_feed",
  "pinterest_update_catalog_feed",
  "pinterest_create_product_group",
  "pinterest_update_product_group",
  "pinterest_batch_catalog_items",
]);
function safe(value: unknown, depth = 0): void {
  if (depth > 25) throw new Error("Specification too deeply nested.");
  if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) {
      if (
        /^(access_token|refresh_token|authorization|client_secret|app_secret|credentials|sponsor_id|__proto__|constructor|prototype)$/i.test(
          k,
        )
      )
        throw new Error(`Forbidden field: ${k}`);
      safe(v, depth + 1);
    }
}
function validate(name: keyof typeof validators, payload: Row) {
  safe(payload);
  const validator = validators[name];
  if (!validator(payload))
    throw new Error(
      "Invalid Pinterest " +
        name +
        ": " +
        JSON.stringify(
          validator.errors?.map((e) => ({
            path: e.instancePath,
            rule: e.keyword,
            message: e.message,
          })),
        ).slice(0, 1200),
    );
}
function budget(a: Row): { amount: number; type: "DAILY" | "LIFETIME" } {
  if ((a.dailyBudget !== undefined) === (a.lifetimeBudget !== undefined))
    throw new Error("Provide exactly one of dailyBudget or lifetimeBudget.");
  return {
    amount: toMicroCurrency(a.dailyBudget ?? a.lifetimeBudget),
    type: a.dailyBudget !== undefined ? "DAILY" : "LIFETIME",
  };
}
/** Preserve Pinterest's per-item failures, including failures returned with HTTP 200. */
export function pinterestMutationResult(result: Row, async = false) {
  const rows = Array.isArray(result.items) ? result.items : [];
  const failed = rows.filter(
    (r: Row) =>
      r.errors?.length ||
      r.exceptions?.length ||
      r.error ||
      r.status === "FAILURE",
  );
  const errors = Boolean(
    result.errors?.length ||
      result.exceptions?.length ||
      result.error ||
      ["FAILED", "FAILURE"].includes(result.status) ||
      failed.length,
  );
  return {
    applied: errors ? false : !async,
    outcome: errors
      ? failed.length && failed.length < rows.length
        ? "partial"
        : "rejected"
      : async
        ? "accepted"
        : "applied",
    processing: async
      ? "accepted; poll the batch ID for per-item completion"
      : undefined,
    result,
  };
}
export function registerPinterestWrites(
  c: Collector,
  config: PinterestConfig,
  readOnly = false,
): void {
  const api = new PinterestClient(config);
  if (readOnly) {
    c.tool(
      "pinterest_get_write_schema",
      "Read the official Pinterest v5 native request schema and Sandbox limitations before composing a write.",
      { request: z.enum(schemas.requests as [string, ...string[]]) },
      async (a) => {
        if (!schemas.requests.includes(a.request))
          return out({ error: "Unknown request schema" }, true);
        const selected: Row = {};
        const definitions = schemas.components.schemas as Row;
        const add = (name: string) => {
          if (selected[name]) return;
          selected[name] = definitions[name];
          const walk = (v: unknown): void => {
            if (Array.isArray(v)) v.forEach(walk);
            else if (v && typeof v === "object") {
              const r = v as Row;
              if (r.$ref) add(r.$ref.split("/").at(-1));
              Object.values(v).forEach(walk);
            }
          };
          walk(selected[name]);
        };
        add(a.request);
        return out({
          version: schemas.version,
          source: schemas.source,
          request: a.request,
          schema: {
            $ref: `#/components/schemas/${a.request}`,
            components: { schemas: selected },
          },
          notes: [
            "Sandbox uses separate tokens and entities.",
            "Sandbox cannot create video Pins or shopping ads.",
            "Standard access alone does not grant restricted video_url access.",
            "Native monetary fields are micro units of the selected account currency.",
          ],
        }, false, false);
      },
    );
    return;
  }
  type Plan = {
    path: string;
    method: "POST" | "PATCH";
    payload: Row;
    schema: keyof typeof validators;
    batch?: boolean;
    async?: boolean;
    scope?: () => Promise<unknown>;
  };
  function register(
    name: string,
    description: string,
    shape: ToolShape,
    build: (a: Row) => Plan,
  ) {
    const schema = z
      .object({
        adAccountId: id.describe(
          "Selected Pinterest advertiser account. All requests use this account context.",
        ),
        ...shape,
        confirm,
      })
      .strict();
    c.tool(
      name,
      description +
        " Preview by default. No automatic mutation retry. Native API eligibility and scopes still apply.",
      schema.shape,
      async (raw) => {
        try {
          const a = schema.parse(raw);
          const p = build(a);
          if (p.schema === "CampaignUpdateRequest")
            p.payload.ad_account_id = a.adAccountId;
          validate(p.schema, p.payload);
          if (
            p.payload.ad_account_id !== undefined &&
            p.payload.ad_account_id !== a.adAccountId
          )
            throw new Error(
              "Payload account differs from the selected advertiser.",
            );
          if (
            config.environment === "sandbox" &&
            ((p.schema === "PinCreate" &&
              String(p.payload.media_source?.source_type).includes("video")) ||
              (p.schema === "AdCreateRequest" &&
                [
                  "SHOPPING",
                  "COLLECTION",
                  "REGULAR_COLLECTION",
                  "DYNAMIC_COLLECTION",
                ].includes(p.payload.creative_type)))
          )
            throw new Error(
              "This video Pin or shopping ad operation is not supported in Pinterest Sandbox.",
            );
          if (!a.confirm)
            return out({
              applied: false,
              action: name,
              environment: config.environment ?? "production",
              adAccountId: a.adAccountId,
              method: p.method,
              path: p.path,
              payload: p.payload,
              validation: { local: true, pinterest: false },
            });
          // Verifies account access and refreshes an expired access token before a mutation.
          const advertiser = (await api.getAdAccount(a.adAccountId)) as Row;
          if (
            config.environment === "sandbox" &&
            !p.path.startsWith("/ad_accounts/")
          ) {
            const owner = (await api.getResource("/user_account", {})) as Row;
            if (
              !advertiser.owner?.id ||
              String(advertiser.owner.id) !== String(owner.id)
            )
              throw new Error(
                "Sandbox user assets require an advertiser owned by the token owner; Business Access is unavailable.",
              );
          }
          await p.scope?.();
          const result = (await api.mutate(
            p.path,
            p.method,
            p.batch ? [p.payload] : p.payload,
          )) as Row;
          const outcome = pinterestMutationResult(result, p.async);
          if (!["partial", "rejected"].includes(outcome.outcome)) {
            const expected = p.async
              ? Boolean(result.batch_id)
              : p.batch || p.schema.startsWith("ProductGroupPromotions")
                ? Boolean(
                    result.items?.length &&
                      result.items.every((item: Row) => item.data),
                  )
                : Boolean(result.id || result.media_id);
            if (!expected)
              throw new Error(
                "Pinterest mutation outcome unknown: success response has no expected entity or batch ID. Read the account before retrying.",
              );
          }
          return out(
            {
              action: name,
              environment: config.environment ?? "production",
              ...outcome,
            },
            ["partial", "rejected"].includes(outcome.outcome),
          );
        } catch (e) {
          const message = (e as Error).message;
          const restricted =
            /restricted feature|not available to all merchants|reviewing your account/.test(
              message,
            );
          return out(
            {
              applied: false,
              error: message,
              outcome: message.includes("outcome unknown")
                ? "unknown"
                : "not_applied",
              retrySafe: false,
              ...(restricted
                ? {
                    humanActionRequired: true,
                    nextAction:
                      "Pinterest must enable this feature or complete merchant review. Standard API access and OAuth scopes alone do not grant this entitlement; do not retry blindly.",
                  }
                : {}),
            },
            true,
          );
        }
      },
    );
  }
  const adPath = (a: Row, entity: string) =>
    `/ad_accounts/${a.adAccountId}/${entity}`;
  const owned = async (a: Row, entity: string, objectId: string) => {
    id.parse(objectId);
    return api.getResource(`${adPath(a, entity)}/${objectId}`, {});
  };
  const userPath = (a: Row, path: string) =>
    `${path}?ad_account_id=${a.adAccountId}`;
  register(
    "pinterest_create_campaign",
    "Create a PAUSED campaign. Monetary convenience fields use the account currency. Campaign Budget Optimization defaults to true; non-CBO eligibility is account-specific.",
    {
      name: z.string().min(1).describe("Campaign name."),
      objective: z
        .enum([
          "AWARENESS",
          "CONSIDERATION",
          "SALES",
          "LEADS",
          "WEB_CONVERSION",
          "CATALOG_SALES",
          "VIDEO_VIEW",
          "WEB_SESSIONS",
        ])
        .describe(
          "Pinterest campaign objective, subject to account eligibility.",
        ),
      dailyBudget: amount
        .optional()
        .describe(
          "Daily campaign budget in major account currency units; excludes lifetimeBudget.",
        ),
      lifetimeBudget: amount
        .optional()
        .describe(
          "Lifetime campaign budget in major account currency units; excludes dailyBudget.",
        ),
      configuration: native.optional(),
    },
    (a) => {
      const payload: Row = {
        is_campaign_budget_optimization: true,
        ...a.configuration,
        ad_account_id: a.adAccountId,
        name: a.name,
        objective_type: a.objective,
        status: "PAUSED",
      };
      if (a.dailyBudget !== undefined || a.lifetimeBudget !== undefined) {
        const b = budget(a);
        payload[b.type === "DAILY" ? "daily_spend_cap" : "lifetime_spend_cap"] =
          b.amount;
      }
      const hasBudget =
        Number(payload.daily_spend_cap) > 0 ||
        Number(payload.lifetime_spend_cap) > 0;
      if (payload.is_campaign_budget_optimization && !hasBudget)
        throw new Error(
          "A campaign-level daily or lifetime budget is required for CBO.",
        );
      if (!payload.is_campaign_budget_optimization && hasBudget)
        throw new Error(
          "Non-CBO campaigns use ad group budgets; omit campaign spend caps.",
        );
      return {
        path: adPath(a, "campaigns"),
        method: "POST",
        schema: "CampaignCreateRequest",
        batch: true,
        payload,
      };
    },
  );
  for (const [entity, param, request] of [
    ["campaigns", "campaignId", "CampaignUpdateRequest"],
    ["ad_groups", "adGroupId", "AdGroupUpdateRequest"],
    ["ads", "adId", "AdUpdateRequest"],
  ] as const) {
    const singular =
      entity === "campaigns"
        ? "campaign"
        : entity === "ad_groups"
          ? "adgroup"
          : "ad";
    register(
      `pinterest_update_${singular}_status`,
      "Update the status of an existing " + singular + ".",
      { [param]: id, status },
      (a) => ({
        path: adPath(a, entity),
        method: "PATCH",
        schema: request,
        batch: true,
        payload: { id: a[param], status: a.status },
        scope: () => owned(a, entity, a[param]),
      }),
    );
  }
  for (const [entity, param, request] of [
    ["campaigns", "campaignId", "CampaignUpdateRequest"],
    ["ad_groups", "adGroupId", "AdGroupUpdateRequest"],
  ] as const) {
    const singular = entity === "campaigns" ? "campaign" : "adgroup";
    register(
      `pinterest_update_${singular}_budget`,
      `Set exactly one daily or lifetime ${singular === "adgroup" ? "ad group" : singular} budget in major account currency units.`,
      {
        [param]: id,
        dailyBudget: amount
          .optional()
          .describe(
            "Daily amount in major account currency units; excludes lifetimeBudget.",
          ),
        lifetimeBudget: amount
          .optional()
          .describe(
            "Lifetime amount in major account currency units; excludes dailyBudget.",
          ),
      },
      (a) => {
        const b = budget(a);
        const fields =
          entity === "campaigns"
            ? {
                [b.type === "DAILY" ? "daily_spend_cap" : "lifetime_spend_cap"]:
                  b.amount,
              }
            : { budget_in_micro_currency: b.amount, budget_type: b.type };
        return {
          path: adPath(a, entity),
          method: "PATCH",
          schema: request,
          batch: true,
          payload: { id: a[param], ...fields },
          scope: async () => {
            const current = (await owned(a, entity, a[param])) as Row;
            if (entity === "ad_groups" && current.campaign_id) {
              const parent = (await owned(
                a,
                "campaigns",
                current.campaign_id,
              )) as Row;
              if (parent.is_campaign_budget_optimization)
                throw new Error(
                  "Campaign Budget Optimization owns this budget. Update the campaign budget instead.",
                );
            }
          },
        };
      },
    );
  }
  for (const [entity, param, request, tool] of [
    [
      "campaigns",
      "campaignId",
      "CampaignUpdateRequest",
      "pinterest_update_campaign_configuration",
    ],
    [
      "ad_groups",
      "adGroupId",
      "AdGroupUpdateRequest",
      "pinterest_update_adgroup_configuration",
    ],
    ["ads", "adId", "AdUpdateRequest", "pinterest_update_ad"],
  ] as const) {
    register(
      tool,
      `Update native ${entity === "campaigns" ? "campaign" : entity === "ad_groups" ? "ad group" : "ad"} settings. Read the existing entity first; nested specifications may replace existing values.`,
      { [param]: id, configuration: native },
      (a) => {
        if (!Object.keys(a.configuration).length)
          throw new Error("Supply at least one change.");
        if (a.configuration.campaign_id || a.configuration.ad_group_id)
          throw new Error("Moving entities between parents is not supported.");
        return {
          path: adPath(a, entity),
          method: "PATCH",
          schema: request,
          batch: true,
          payload: { ...a.configuration, id: a[param] },
          scope: () => owned(a, entity, a[param]),
        };
      },
    );
  }
  register(
    "pinterest_create_adgroup",
    "Create a PAUSED ad group with explicit native bidding, targeting, budget and schedule.",
    { campaignId: id, configuration: native },
    (a) => ({
      path: adPath(a, "ad_groups"),
      method: "POST",
      schema: "AdGroupCreateRequest",
      batch: true,
      payload: {
        ...a.configuration,
        campaign_id: a.campaignId,
        status: "PAUSED",
      },
      scope: async () => {
        const parent = (await owned(a, "campaigns", a.campaignId)) as Row;
        if (
          parent.is_campaign_budget_optimization &&
          a.configuration.budget_in_micro_currency !== undefined
        )
          throw new Error(
            "Campaign Budget Optimization owns the budget; omit the ad group budget.",
          );
      },
    }),
  );
  register(
    "pinterest_create_ad",
    "Create a PAUSED ad from an accessible Pin. Native specification supports Pinterest creative formats subject to eligibility.",
    { adGroupId: id, pinId: id, configuration: native },
    (a) => ({
      path: adPath(a, "ads"),
      method: "POST",
      schema: "AdCreateRequest",
      batch: true,
      payload: {
        ...a.configuration,
        ad_group_id: a.adGroupId,
        pin_id: a.pinId,
        status: "PAUSED",
      },
      scope: async () => {
        await owned(a, "ad_groups", a.adGroupId);
        await api.getResource(`/pins/${a.pinId}`, {
          ad_account_id: a.adAccountId,
        });
      },
    }),
  );
  for (const creating of [true, false]) {
    register(
      creating
        ? "pinterest_create_product_group_promotion"
        : "pinterest_update_product_group_promotion",
      creating
        ? "Create a PAUSED shopping or collections promotion from a catalog product group. Unavailable in Sandbox."
        : "Update a catalog product group promotion. Unavailable in Sandbox.",
      {
        adGroupId: id,
        ...(creating ? { productGroupId: id } : { promotionId: id }),
        configuration: native,
      },
      (a) => {
        if (config.environment === "sandbox")
          throw new Error(
            "Shopping ads and product group promotions are not supported in Pinterest Sandbox.",
          );
        const promotion = {
          ...a.configuration,
          ad_group_id: a.adGroupId,
          ...(creating
            ? { catalog_product_group_id: a.productGroupId, status: "PAUSED" }
            : { id: a.promotionId }),
        };
        return {
          path: adPath(a, "product_group_promotions"),
          method: creating ? "POST" : "PATCH",
          schema: creating
            ? "ProductGroupPromotionsCreate"
            : "ProductGroupPromotionsUpdateWithRequiredBody",
          payload: {
            ad_group_id: a.adGroupId,
            product_group_promotion: [promotion],
          },
          scope: async () => {
            await owned(a, "ad_groups", a.adGroupId);
            if (creating)
              await api.getResource(
                "/catalogs/product_groups/" + a.productGroupId,
                { ad_account_id: a.adAccountId },
              );
            else {
              const current = (await owned(
                a,
                "product_group_promotions",
                a.promotionId,
              )) as Row;
              if (current.ad_group_id !== a.adGroupId)
                throw new Error("Promotion belongs to a different ad group.");
            }
          },
        };
      },
    );
  }
  for (const [tool, path, request, method, param] of [
    ["pinterest_create_board", "/boards", "BoardCreate", "POST", null],
    [
      "pinterest_update_board",
      "/boards",
      "BoardWithUpdatePrivacyUpdate",
      "PATCH",
      "boardId",
    ],
    ["pinterest_create_pin", "/pins", "PinCreate", "POST", null],
    ["pinterest_update_pin", "/pins", "PinUpdate", "PATCH", "pinId"],
    ["pinterest_register_media", "/media", "MediaUploadCreate", "POST", null],
    ["pinterest_create_catalog", "/catalogs", "CatalogCreate", "POST", null],
    [
      "pinterest_create_catalog_feed",
      "/catalogs/feeds",
      "CatalogsFeedCreateRequestSchema",
      "POST",
      null,
    ],
    [
      "pinterest_update_catalog_feed",
      "/catalogs/feeds",
      "CatalogsFeedUpdateRequestSchema",
      "PATCH",
      "feedId",
    ],
    [
      "pinterest_create_product_group",
      "/catalogs/product_groups",
      "CatalogsProductGroupsCreateRequestSchema",
      "POST",
      null,
    ],
    [
      "pinterest_update_product_group",
      "/catalogs/product_groups",
      "CatalogsProductGroupsUpdateRequestSchema",
      "PATCH",
      "productGroupId",
    ],
    [
      "pinterest_batch_catalog_items",
      "/catalogs/items/batch",
      "CatalogsItemsBatchPostRequest",
      "POST",
      null,
    ],
  ] as const) {
    register(
      tool,
      tool === "pinterest_register_media"
        ? "Register media upload; returned upload_url/parameters are not confirmation that a video is uploaded or ready."
        : tool === "pinterest_batch_catalog_items"
          ? "Submit native CREATE/UPDATE/UPSERT/DELETE catalog item operations. Poll the returned batch ID before reporting completion."
          : tool === "pinterest_update_pin"
            ? "Update a Pin. Requires Pinterest restricted pin_edit entitlement in addition to pins:write; Standard alone is insufficient."
            : (method === "POST" ? "Create " : "Update ") +
              path +
              " in the selected advertiser context.",
      { ...(param ? { [param]: id } : {}), configuration: native },
      (a) => {
        const payload = { ...a.configuration };
        if (
          tool === "pinterest_create_product_group" &&
          payload.catalog_type === "RETAIL" &&
          (!payload.country || !payload.locale)
        )
          throw new Error(
            "Retail product groups require explicit country and locale.",
          );
        if (tool === "pinterest_create_board" && !payload.privacy)
          throw new Error("Choose board privacy explicitly. PUBLIC uses boards:write; SECRET additionally requires boards:write_secret, which the standard advertising OAuth flow does not request.");
        if (
          tool === "pinterest_create_pin" &&
          (!payload.board_id || !payload.media_source)
        )
          throw new Error("Creating a Pin requires board_id and media_source.");
        return {
          path:
            path === "/media"
              ? path
              : userPath(a, path + (param ? "/" + a[param] : "")),
          method,
          schema: request,
          payload,
          async: tool === "pinterest_batch_catalog_items",
          scope: async () => {
            if (param)
              await api.getResource(path + "/" + a[param], {
                ad_account_id: a.adAccountId,
              });
            if (payload.board_id)
              await api.getResource("/boards/" + id.parse(payload.board_id), {
                ad_account_id: a.adAccountId,
              });
            if (payload.feed_id)
              await api.getResource(
                "/catalogs/feeds/" + id.parse(payload.feed_id),
                { ad_account_id: a.adAccountId },
              );
            // catalog_id is sent natively; Pinterest enforces advertiser catalog permissions.
          },
        };
      },
    );
  }
}
