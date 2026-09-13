/**
 * pinterest-ads-mcp-server: an open-source MCP server for the Pinterest Ads API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
const REDACTED = "[REDACTED]";

const USER_SUMMARY_FIELDS = new Set(["id", "email", "username"]);
const USER_SUMMARY_KEYS = new Set(["user", "created_by_user", "created_by_business"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactUserSummary(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    key,
    USER_SUMMARY_FIELDS.has(key.toLowerCase()) ? REDACTED : redactNestedUserSummaries(nested),
  ]));
}

function redactNestedUserSummaries(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactNestedUserSummaries);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    key,
    USER_SUMMARY_KEYS.has(key.toLowerCase())
      ? redactUserSummary(nested)
      : redactNestedUserSummaries(nested),
  ]));
}

function redactMemberRecord(value: unknown): unknown {
  const redacted = redactNestedUserSummaries(value);
  if (!isRecord(redacted)) return redacted;
  return { ...redacted, ...(Object.prototype.hasOwnProperty.call(redacted, "id") && { id: REDACTED }) };
}

/** Redact member IDs plus nested member/invite email, username and user IDs. */
export function redactPinterestBusinessPersonalIdentifiers(value: unknown, mode: string): unknown {
  const redactTopLevelMemberId = mode === "MEMBERS";
  if (Array.isArray(value)) {
    return value.map((item) => redactTopLevelMemberId ? redactMemberRecord(item) : redactNestedUserSummaries(item));
  }
  if (!isRecord(value)) return value;
  if (Array.isArray(value.items)) {
    const redacted = redactNestedUserSummaries(value);
    return {
      ...(isRecord(redacted) ? redacted : {}),
      items: value.items.map((item) => redactTopLevelMemberId ? redactMemberRecord(item) : redactNestedUserSummaries(item)),
    };
  }
  return redactTopLevelMemberId ? redactMemberRecord(value) : redactNestedUserSummaries(value);
}

export const PINTEREST_REDACTION_MARKER = REDACTED;

/** Feed responses may include stored credentials; never expose them through MCP. */
export function redactPinterestSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactPinterestSecrets);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key,
    /^(credentials|password|access_token|refresh_token|client_secret|app_secret|authorization)$/i.test(key)
      ? REDACTED : redactPinterestSecrets(nested),
  ]));
}
