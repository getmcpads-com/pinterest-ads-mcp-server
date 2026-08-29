/**
 * pinterest-ads-mcp-server: an open-source MCP server for the Pinterest Ads API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import { z } from "zod";
import { logger } from "./core/logger.js";

const configSchema = z.object({
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  defaultAdAccountId: z.string().optional(),
  /** Write tools are registered only when this is true. */
  enableWrites: z.boolean().optional(),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
}).refine((config) => {
  if (config.accessToken) return true;
  return Boolean(config.refreshToken && config.appId && config.appSecret);
}, {
  message: "Set PINTEREST_ACCESS_TOKEN or PINTEREST_REFRESH_TOKEN + PINTEREST_APP_ID + PINTEREST_APP_SECRET",
});

export type PinterestConfig = z.infer<typeof configSchema>;

export function loadConfig(): PinterestConfig {
  const raw = {
    accessToken: process.env["PINTEREST_ACCESS_TOKEN"] || undefined,
    refreshToken: process.env["PINTEREST_REFRESH_TOKEN"] || undefined,
    appId: process.env["PINTEREST_APP_ID"] || undefined,
    appSecret: process.env["PINTEREST_APP_SECRET"] || undefined,
    defaultAdAccountId: process.env["PINTEREST_AD_ACCOUNT_ID"] || process.env["PINTEREST_DEFAULT_AD_ACCOUNT_ID"] || undefined,
    enableWrites: isTruthy(process.env["PINTEREST_ENABLE_WRITES"]),
    logLevel: process.env["LOG_LEVEL"] ?? "info",
  };

  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join(", ");
    logger.error("config", `Missing credentials: ${message}`);
    throw new Error(`Missing Pinterest credentials: ${message}`);
  }

  logger.system("Pinterest Ads MCP Server configured");
  return result.data;
}

/** Accepts the spellings people actually type in an MCP client config. */
function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}
