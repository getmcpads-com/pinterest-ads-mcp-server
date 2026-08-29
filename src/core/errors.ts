/**
 * pinterest-ads-mcp-server: an open-source MCP server for the Pinterest Ads API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
export class PinterestMcpError extends Error {
  readonly statusCode?: number;
  readonly platformStatus?: string;

  constructor(message: string, statusCode?: number, platformStatus?: string) {
    super(message);
    this.name = "PinterestMcpError";
    this.statusCode = statusCode;
    this.platformStatus = platformStatus;
  }
}

export function formatMcpToolError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const statusCode = error instanceof PinterestMcpError ? error.statusCode : undefined;
  const platformStatus = error instanceof PinterestMcpError ? error.platformStatus : undefined;

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            success: false,
            error: message,
            statusCode,
            platformStatus,
          },
          null,
          2
        ),
      },
    ],
    isError: true,
  };
}
