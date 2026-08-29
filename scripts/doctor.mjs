#!/usr/bin/env node

const requiredAccess = ["PINTEREST_ACCESS_TOKEN"];
const requiredRefresh = ["PINTEREST_REFRESH_TOKEN", "PINTEREST_APP_ID", "PINTEREST_APP_SECRET"];
const optional = ["PINTEREST_AD_ACCOUNT_ID", "LOG_LEVEL"];

function present(name) {
  return typeof process.env[name] === "string" && process.env[name].length > 0;
}

const hasAccess = requiredAccess.every(present);
const hasRefresh = requiredRefresh.every(present);

const result = {
  package: "@getmcpads/pinterest-ads-mcp-server",
  ok: hasAccess || hasRefresh,
  auth: {
    accessTokenMode: hasAccess,
    refreshTokenMode: hasRefresh,
    requiredAccess: requiredAccess.map((name) => ({ name, present: present(name) })),
    requiredRefresh: requiredRefresh.map((name) => ({ name, present: present(name) })),
    optional: optional.map((name) => ({ name, present: present(name) })),
  },
  note: "Set PINTEREST_ACCESS_TOKEN or PINTEREST_REFRESH_TOKEN + PINTEREST_APP_ID + PINTEREST_APP_SECRET.",
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
