import { installToolQuality } from "./tool-quality.js";
/**
 * pinterest-ads-mcp-server: an open-source MCP server for the Pinterest Ads API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PinterestConfig } from "./config.js";
import { registerPinterest } from "./platforms/pinterest/index.js";
import { logger } from "./core/logger.js";

export const PACKAGE_VERSION = "2.0.0";

export function createServer(config: PinterestConfig): McpServer {
  const server = new McpServer(
    { name: "pinterest-ads-mcp", version: PACKAGE_VERSION, title: "Pinterest Ads", websiteUrl: "https://www.getmcpads.com/tools/pinterest-ads", icons: [{ src: "https://mcp.getmcpads.com/icon.svg", mimeType: "image/svg+xml" }] },
    { capabilities: { tools: { listChanged: true }, resources: { subscribe: false, listChanged: true } } },
  );
  installToolQuality(server);
  registerPinterest(server, config);
  logger.system(
    `pinterest-ads-mcp v${PACKAGE_VERSION} ready, writes ${config.enableWrites ? "enabled" : "disabled"}`,
  );
  return server;
}
