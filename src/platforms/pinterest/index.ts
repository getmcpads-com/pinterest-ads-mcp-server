/**
 * pinterest-ads-mcp-server: an open-source MCP server for the Pinterest Ads API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PinterestConfig } from "../../config.js";
import { registerPinterestTools } from "./tools.js";
import { registerPinterestSurfaceTools } from "./surface-tools.js";
import { registerPinterestResources } from "./resources.js";
import { registerPinterestWrites } from "./writes.js";
import { logger } from "../../core/logger.js";

export function registerPinterest(server: McpServer, config: PinterestConfig): void {
  registerPinterestTools(server, config);
  registerPinterestWrites(server as never, config as never, true);
  registerPinterestSurfaceTools(server, config);
  registerPinterestResources(server, config.enableWrites ?? false);
  logger.info("pinterest", "Registered 28 read tools and 7 resources");

  if (config.enableWrites) {
    registerPinterestWrites(server as never, config as never);
    logger.info("pinterest", "Registered 25 write tools (every one previews before it applies)");
  }
}
