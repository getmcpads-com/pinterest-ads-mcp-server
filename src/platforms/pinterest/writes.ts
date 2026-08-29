/**
 * Write tools for the Pinterest Ads API.
 *
 * These are registered only when `PINTEREST_ENABLE_WRITES` is set. Reading needs
 * ads:read; everything here needs ads:write on the ad account.
 *
 * Part of pinterest-ads-mcp-server: https://github.com/getmcpads-com/pinterest-ads-mcp-server
 * Managed, multi-platform version: https://www.getmcpads.com
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PinterestConfig } from "../../config.js";

const API_BASE = "https://api.pinterest.com/v5";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function ko(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

/**
 * Every write is a preview until `confirm` is true.
 *
 * An assistant composes these calls, and it can pick the wrong ad account, the
 * wrong campaign, or the wrong order of magnitude on a budget. A mandatory
 * preview makes the mistake visible before it costs money, and gives a human
 * the stopping point the protocol does not guarantee on its own.
 */
function preview(action: string, details: Record<string, unknown>) {
  return ok({
    applied: false,
    action,
    change: details,
    message:
      "Preview only, nothing was changed. Repeat the same call with confirm: true " +
      "to apply this change to the live account.",
  });
}

const confirmSchema = z
  .boolean()
  .optional()
  .describe("Set to true to actually apply the change. Without it, the tool only previews.");

/** Pinterest holds money in micro units of the account currency: 12.50 becomes 12500000. */
export function toMicroCurrency(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Expected a positive amount, received "${amount}".`);
  }
  return Math.round(amount * 1_000_000);
}

async function request(url: string, init: RequestInit, context: string): Promise<unknown> {
  const response = await fetch(url, { ...init, redirect: "error" });
  const body = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = body;
  }
  if (!response.ok) {
    const detail = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
    throw new Error(`${context}: ${detail.slice(0, 300)}`);
  }
  return parsed;
}

/** Pinterest rejects a budget carrying both a daily and a lifetime value. */
function resolveBudget(
  daily: unknown,
  lifetime: unknown,
  fields: { daily: string; lifetime: string },
): { field: string; amount: number; micro: number } | string {
  if (daily === undefined && lifetime === undefined) {
    return "Provide either dailyBudget or lifetimeBudget.";
  }
  if (daily !== undefined && lifetime !== undefined) {
    return "dailyBudget and lifetimeBudget are mutually exclusive; provide one.";
  }
  const amount = Number(daily ?? lifetime);
  try {
    return {
      field: daily !== undefined ? fields.daily : fields.lifetime,
      amount,
      micro: toMicroCurrency(amount),
    };
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export function registerPinterestWrites(server: McpServer, config: PinterestConfig): void {
  const headers = {
    authorization: `Bearer ${config.accessToken ?? ""}`,
    "content-type": "application/json",
  };
  const patch = (adAccountId: string, collection: string, payload: unknown, context: string) =>
    request(
      `${API_BASE}/ad_accounts/${adAccountId}/${collection}`,
      { method: "PATCH", headers, body: JSON.stringify(payload) },
      context,
    );

  // ── Status: pause, reactivate, archive ────────────────────────────
  const statusTool = (
    name: string,
    label: "campaign" | "ad group",
    param: string,
    collection: string,
  ) =>
    server.tool(
      name,
      `Pause, reactivate or archive a Pinterest ${label}. Previews by default: without ` +
        `confirm: true, the tool describes the change without applying it.`,
      {
        adAccountId: z.string().describe("Pinterest ad account ID."),
        [param]: z.string().describe(`${label} ID.`),
        status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).describe("New status."),
        confirm: confirmSchema,
      },
      async (a: Record<string, unknown>) => {
        const id = String(a[param]);
        if (!a.confirm) {
          return preview(name, { adAccount: a.adAccountId, target: id, newStatus: a.status });
        }
        const result = await patch(
          String(a.adAccountId), collection, [{ id, status: a.status }], `Pinterest ${label} status`,
        );
        return ok({ applied: true, action: name, result });
      },
    );

  statusTool("pinterest_update_campaign_status", "campaign", "campaignId", "campaigns");
  statusTool("pinterest_update_adgroup_status", "ad group", "adGroupId", "ad_groups");

  // ── Create campaign (always paused) ───────────────────────────────
  server.tool(
    "pinterest_create_campaign",
    "Create a Pinterest campaign. It is always created PAUSED and there is no option to " +
      "create it active. Previews by default.",
    {
      adAccountId: z.string().describe("Pinterest ad account ID."),
      name: z.string().min(1).max(255).describe("Campaign name."),
      objective: z
        .enum(["AWARENESS", "CONSIDERATION", "WEB_CONVERSION", "CATALOG_SALES", "VIDEO_VIEW", "WEB_SESSIONS"])
        .describe("Objective type."),
      dailyBudget: z.number().positive().describe("Daily budget in the account currency."),
      confirm: confirmSchema,
    },
    async (a: Record<string, unknown>) => {
      let micro: number;
      try {
        micro = toMicroCurrency(Number(a.dailyBudget));
      } catch (error) {
        return ko(error instanceof Error ? error.message : String(error));
      }
      if (!a.confirm) {
        return preview("pinterest_create_campaign", {
          adAccount: a.adAccountId, name: a.name, objective: a.objective,
          dailyBudget: a.dailyBudget, inMicroCurrency: micro, status: "PAUSED",
        });
      }
      const result = await request(
        `${API_BASE}/ad_accounts/${a.adAccountId}/campaigns`,
        {
          method: "POST",
          headers,
          body: JSON.stringify([
            {
              ad_account_id: a.adAccountId,
              name: a.name,
              status: "PAUSED",
              objective_type: a.objective,
              daily_spend_cap: micro,
            },
          ]),
        },
        "Pinterest campaign creation",
      );
      return ok({ applied: true, action: "pinterest_create_campaign", status: "PAUSED", result });
    },
  );

  // ── Budgets ───────────────────────────────────────────────────────
  server.tool(
    "pinterest_update_campaign_budget",
    "Change the daily or lifetime budget of a Pinterest campaign. Amount in the account " +
      "currency (12.50 for 12.50 EUR). Pinterest expects micro units, the conversion is done " +
      "here. Previews by default.",
    {
      adAccountId: z.string().describe("Pinterest ad account ID."),
      campaignId: z.string().describe("Campaign ID."),
      dailyBudget: z.number().positive().optional().describe("New daily budget, in the account currency."),
      lifetimeBudget: z.number().positive().optional().describe("New lifetime budget, mutually exclusive with the daily budget."),
      confirm: confirmSchema,
    },
    async (a: Record<string, unknown>) => {
      const budget = resolveBudget(a.dailyBudget, a.lifetimeBudget, {
        daily: "daily_spend_cap", lifetime: "lifetime_spend_cap",
      });
      if (typeof budget === "string") return ko(budget);
      if (!a.confirm) {
        return preview("pinterest_update_campaign_budget", {
          adAccount: a.adAccountId, campaign: a.campaignId,
          field: budget.field, amount: budget.amount, inMicroCurrency: budget.micro,
        });
      }
      const result = await patch(
        String(a.adAccountId), "campaigns",
        [{ id: a.campaignId, [budget.field]: budget.micro }],
        "Pinterest campaign budget",
      );
      return ok({ applied: true, action: "pinterest_update_campaign_budget", result });
    },
  );

  server.tool(
    "pinterest_update_adgroup_budget",
    "Change the daily or lifetime budget of a Pinterest ad group. Amount in the account " +
      "currency. Pinterest expects micro units, the conversion is done here. Previews by default.",
    {
      adAccountId: z.string().describe("Pinterest ad account ID."),
      adGroupId: z.string().describe("Ad group ID."),
      dailyBudget: z.number().positive().optional().describe("New daily budget, in the account currency."),
      lifetimeBudget: z.number().positive().optional().describe("New lifetime budget, mutually exclusive with the daily budget."),
      confirm: confirmSchema,
    },
    async (a: Record<string, unknown>) => {
      const budget = resolveBudget(a.dailyBudget, a.lifetimeBudget, {
        daily: "budget_in_micro_currency", lifetime: "lifetime_budget_in_micro_currency",
      });
      if (typeof budget === "string") return ko(budget);
      if (!a.confirm) {
        return preview("pinterest_update_adgroup_budget", {
          adAccount: a.adAccountId, adGroup: a.adGroupId,
          field: budget.field, amount: budget.amount, inMicroCurrency: budget.micro,
        });
      }
      const result = await patch(
        String(a.adAccountId), "ad_groups",
        [{ id: a.adGroupId, [budget.field]: budget.micro }],
        "Pinterest ad group budget",
      );
      return ok({ applied: true, action: "pinterest_update_adgroup_budget", result });
    },
  );
}
