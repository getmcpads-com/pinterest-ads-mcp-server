/**
 * pinterest-ads-mcp-server: an open-source MCP server for the Pinterest Ads API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

class Logger {
  private level: LogLevel = "info";

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(scope: string, message: string, extra?: unknown): void {
    this.log("debug", scope, message, extra);
  }

  info(scope: string, message: string, extra?: unknown): void {
    this.log("info", scope, message, extra);
  }

  warn(scope: string, message: string, extra?: unknown): void {
    this.log("warn", scope, message, extra);
  }

  error(scope: string, message: string, extra?: unknown): void {
    this.log("error", scope, message, extra);
  }

  system(message: string): void {
    this.info("system", message);
  }

  private log(level: LogLevel, scope: string, message: string, extra?: unknown): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;
    const suffix = extra === undefined ? "" : ` ${JSON.stringify(extra)}`;
    console.error(`[pinterest-ads-mcp] ${level.toUpperCase()} ${scope}: ${message}${suffix}`);
  }
}

export const logger = new Logger();
