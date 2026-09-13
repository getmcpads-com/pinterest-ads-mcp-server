/** Copyright 2026 GetMCPAds. SPDX-License-Identifier: Apache-2.0 */
import { z } from "zod";
import { logger } from "./core/logger.js";

const configSchema = z.object({
  enableWrites: z.boolean().optional(),
  environment: z.enum(["production", "sandbox"]).optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  defaultAdAccountId: z.string().optional(),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
}).refine((config) => {
  if (config.accessToken) return true;
  return Boolean(config.refreshToken && config.appId && config.appSecret);
}, {
  message: "Set PINTEREST_ACCESS_TOKEN or PINTEREST_REFRESH_TOKEN + PINTEREST_APP_ID + PINTEREST_APP_SECRET",
});

export type RefreshedPinterestTokens = { accessToken: string; refreshToken?: string; expiresIn?: number };
export type PinterestConfig = z.infer<typeof configSchema> & {
  onTokenRefresh?: (tokens: RefreshedPinterestTokens) => Promise<void>;
};

export function pinterestApiBase(config: Pick<PinterestConfig, "environment">): string {
  if (config.environment && !["production", "sandbox"].includes(config.environment)) throw new Error("Invalid Pinterest environment");
  return config.environment === "sandbox" ? "https://api-sandbox.pinterest.com/v5" : "https://api.pinterest.com/v5";
}

export function loadConfig(): PinterestConfig {
  const raw = {
    enableWrites: ["1", "true", "yes", "on"].includes((process.env["PINTEREST_ENABLE_WRITES"] ?? "").trim().toLowerCase()),
    environment: process.env["PINTEREST_ENVIRONMENT"] || "production",
    accessToken: process.env["PINTEREST_ACCESS_TOKEN"] || undefined,
    refreshToken: process.env["PINTEREST_REFRESH_TOKEN"] || undefined,
    appId: process.env["PINTEREST_APP_ID"] || undefined,
    appSecret: process.env["PINTEREST_APP_SECRET"] || undefined,
    defaultAdAccountId: process.env["PINTEREST_AD_ACCOUNT_ID"] || process.env["PINTEREST_DEFAULT_AD_ACCOUNT_ID"] || undefined,
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
