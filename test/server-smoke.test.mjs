import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(repoRoot, "..", "..");
const binName = process.platform === "win32" ? "tsx.cmd" : "tsx";
const localTsxBin = path.join(repoRoot, "node_modules", ".bin", binName);
const workspaceTsxBin = path.join(workspaceRoot, "node_modules", ".bin", binName);
const tsxBin = fs.existsSync(localTsxBin) ? localTsxBin : workspaceTsxBin;

function cleanEnv(extra) {
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([, value]) => typeof value === "string")),
    ...extra,
  };
}

test("Pinterest Ads MCP exposes core tools and resources over stdio", async () => {
  const client = new Client({ name: "pinterest-ads-mcp-smoke", version: "0.0.0" });
  const transport = new StdioClientTransport({
    command: tsxBin,
    args: ["src/cli.ts"],
    cwd: repoRoot,
    env: cleanEnv({
      PINTEREST_ACCESS_TOKEN: "test-access-token",
      PINTEREST_AD_ACCOUNT_ID: "123456789",
      LOG_LEVEL: "error",
    }),
    stderr: "pipe",
  });

  try {
    await client.connect(transport, { timeout: 15000 });
    const tools = await client.listTools(undefined, { timeout: 15000 });
    const toolNames = tools.tools.map((tool) => tool.name);

    assert.equal(toolNames.length, 26);

    for (const name of [
      "pinterest_health_check",
      "pinterest_run_report",
      "pinterest_get_creative_assets",
      "pinterest_run_catalog_report",
      "pinterest_run_conversion_product_report",
      "pinterest_get_account_entities",
      "pinterest_run_targeting_report",
      "pinterest_get_keyword_intelligence",
      "pinterest_get_audiences",
      "pinterest_estimate_delivery",
      "pinterest_get_conversion_setup",
      "pinterest_get_catalog_diagnostics",
      "pinterest_run_specialized_export",
      "pinterest_get_business_assets",
      "pinterest_get_pin_analytics",
      "pinterest_get_trends",
    ]) {
      assert.ok(toolNames.includes(name), `missing tool ${name}`);
    }

    const businessTool = tools.tools.find((tool) => tool.name === "pinterest_get_business_assets");
    assert.equal(businessTool.inputSchema.properties.allowCrossBusinessRead.default, false);
    assert.equal(businessTool.inputSchema.properties.includePersonalIdentifiers.default, false);

    const resources = await client.listResources(undefined, { timeout: 15000 });
    const resourceUris = resources.resources.map((resource) => resource.uri);

    assert.equal(resourceUris.length, 7);

    for (const uri of [
      "pinterest://manifest",
      "pinterest://reporting-columns",
      "pinterest://attribution",
      "pinterest://surface-map",
    ]) {
      assert.ok(resourceUris.includes(uri), `missing resource ${uri}`);
    }
  } finally {
    await transport.close().catch(() => undefined);
  }
});
