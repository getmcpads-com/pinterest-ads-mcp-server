# pinterest-ads-mcp-server

[![CI](https://github.com/getmcpads-com/pinterest-ads-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/getmcpads-com/pinterest-ads-mcp-server/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](package.json)

An open-source [Model Context Protocol](https://modelcontextprotocol.io) server for the
**Pinterest Ads API**. It lets Claude, ChatGPT, Cursor or any MCP client read and analyse
your Pinterest advertising data, and change it if you choose to.

You run it. Your token stays on your machine. Nothing is proxied through a third party.

```bash
npx -y @getmcpads/pinterest-ads-mcp-server
```

> **Prefer not to run it yourself?** [getmcpads.com](https://www.getmcpads.com) is the hosted
> version of this server, with Pinterest Ads alongside Meta Ads, Google Ads, TikTok Ads,
> Google Analytics and Search Console behind a single endpoint, hosted OAuth, and
> cross-platform reporting. Same tools, same safety model, no setup.

---

## What you get

| | |
|---|---|
| **26 read tools** | Reporting, campaigns and ad groups, audiences, targeting, keywords, conversions, catalogs, business assets, billing, Pins and trends |
| **5 write tools** | Off by default. Campaign and ad group status and budgets, campaign creation. Each one **previews before it applies** |
| **7 resources** | Live catalogues the model can read: reporting columns, attribution windows, creative assets, catalog reporting, surface map, recipes |
| **Organic alongside paid** | Pin analytics and trends, not just the ad account |
| **Privacy by construction** | Lead records are not exposed at all, and member identifiers are redacted by default |

### Raw column names, on purpose

Pinterest names its reporting columns in its own way, and this server accepts those names
directly rather than inventing friendly aliases on top. A column that exists in the API works
here; one that does not fails immediately rather than being silently translated into
something else.

`pinterest://reporting-columns` lists what is available, and `pinterest_validate_report`
checks a request before it runs.

---

## How this compares to Pinterest's own MCP server

Pinterest shipped an official MCP server in June 2026, with authentication handled by
Pinterest's own systems. **It launched read-only**: an agent can pull performance data and
account context, but cannot change a budget, pause a campaign or edit a bid.

| | Pinterest's official server | This server | [getmcpads.com](https://www.getmcpads.com) |
|---|---|---|---|
| Hosting | Pinterest-hosted | **You host it.** stdio, local process | Hosted for you |
| Data path | Through Pinterest's endpoint | **Direct to the API.** No intermediary | Through our gateway |
| Writes | ❌ read-only at launch | ✅ **preview first**, applied only on `confirm: true` | ✅ preview first |
| Auditable | No | **Yes.** Apache-2.0, read every line | This server, audited |
| Modifiable | No | **Fork it** | No |
| Auth | Handled by Pinterest | You bring a token, which is more setup | Hosted OAuth |

**Choose Pinterest's** for the least setup, if reporting is all you need.
**Choose this one** if you want your data to stay on your infrastructure, want to audit or
extend what the model can do, or want guarded writes rather than none.
**Choose [getmcpads.com](https://www.getmcpads.com)** if you want this server's capabilities
without running it, or you need more than one ad platform in the same conversation.

---

## Privacy, built into what the tools return

Two protections, and they work differently.

**Lead records are never exposed.** `pinterest_get_lead_assets` returns lead form and
subscription configuration, but never the lead export itself, because those rows carry
personal information submitted by end users. This is an exclusion, not a redaction: the data
does not leave Pinterest through this server at all.

**Business member identifiers are redacted by default.** Member IDs, email addresses and
usernames are replaced before they reach the model when you read members, asset members or
invites. `includePersonalIdentifiers: true` returns the raw values and defaults to `false`.
These are your colleagues' addresses, so the default is the safe one.

---

## Getting a token

You need a Pinterest access token with the **`ads:read`** scope.

1. Create an app in the [Pinterest developer portal](https://developers.pinterest.com/).
2. Note the **App ID** and **App secret**.
3. Run the OAuth flow while signed in to the account that can access your ad accounts.
   Request `ads:read`, and `ads:write` only if you plan to enable writes.
4. Keep the **access token**, and the **refresh token** if you want the server to renew it.

📖 [Pinterest API authentication](https://developers.pinterest.com/docs/getting-started/authentication/)

You can run with just `PINTEREST_ACCESS_TOKEN`, but it expires. Supplying
`PINTEREST_REFRESH_TOKEN`, `PINTEREST_APP_ID` and `PINTEREST_APP_SECRET` together lets the
server renew the token itself, which is what you want for daily use.

Run **`pinterest_health_check`** as your first call. It verifies the token and lists the ad
accounts you can reach, without printing the token.

---

## Setup

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "pinterest-ads": {
      "command": "npx",
      "args": ["-y", "@getmcpads/pinterest-ads-mcp-server"],
      "env": {
        "PINTEREST_ACCESS_TOKEN": "your-token-here"
      }
    }
  }
}
```

Restart Claude Desktop. Ask it: *"list my Pinterest ad accounts"*.

### Claude Code

```bash
claude mcp add pinterest-ads --env PINTEREST_ACCESS_TOKEN=your-token -- npx -y @getmcpads/pinterest-ads-mcp-server
```

### Cursor

`.cursor/mcp.json` in your project, same shape as the Claude Desktop config above.

### From source

```bash
git clone https://github.com/getmcpads-com/pinterest-ads-mcp-server.git
cd pinterest-ads-mcp-server
npm install && npm run build
cp .env.example .env   # then fill in your credentials
npm start
```

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PINTEREST_ACCESS_TOKEN` | none | Access token with `ads:read` |
| `PINTEREST_REFRESH_TOKEN` | none | With the two below, lets the server renew the token |
| `PINTEREST_APP_ID` | none | App ID, needed for refresh |
| `PINTEREST_APP_SECRET` | none | App secret, needed for refresh |
| `PINTEREST_AD_ACCOUNT_ID` | none | Optional default, saves passing it on every call |
| `PINTEREST_ENABLE_WRITES` | *unset* | Set to `1` to register the 5 write tools |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

Either the access token, or the refresh trio. The server refuses to start with neither.

```bash
npm run doctor
```

---

## Writes, and why they preview first

Write tools are **disabled by default**. Enable them with `PINTEREST_ENABLE_WRITES=1`, and
grant `ads:write` on top of `ads:read`.

When enabled, every write tool returns a preview and changes nothing:

```jsonc
// pinterest_update_adgroup_budget { adAccountId: "549…", adGroupId: "268…", dailyBudget: 50 }
{
  "applied": false,
  "action": "pinterest_update_adgroup_budget",
  "change": { "adAccount": "549…", "adGroup": "268…",
              "field": "budget_in_micro_currency", "amount": 50,
              "inMicroCurrency": 50000000 },
  "message": "Preview only, nothing was changed. Repeat the same call with confirm: true to apply this change to the live account."
}
```

Only a second call carrying `confirm: true` touches the live account.

This is deliberate. An assistant composes these calls, and it can pick the wrong ad account,
the wrong campaign, or the wrong order of magnitude on a budget. A mandatory preview makes
the mistake visible before it costs money, and gives a human the stopping point the protocol
does not guarantee on its own.

Two further guardrails:

- **`pinterest_create_campaign` always creates the campaign `PAUSED`.** There is no option to
  create it active.
- **Amounts are converted to micro units for you.** Pinterest holds money in millionths, so
  12.50 in the account currency is `12500000`. The preview shows both, so a
  factor-of-a-million mistake is visible before it applies. A daily and a lifetime budget
  sent together are refused rather than silently resolved.

| Tool | What it changes |
|---|---|
| `pinterest_update_campaign_status` / `pinterest_update_adgroup_status` | Pause, reactivate or archive |
| `pinterest_update_campaign_budget` / `pinterest_update_adgroup_budget` | Daily or lifetime budget |
| `pinterest_create_campaign` | Creates a campaign, always `PAUSED` |

---

## Tools

<details>
<summary><b>26 read tools</b></summary>

### Discovery and health
| Tool | Purpose |
|---|---|
| `pinterest_health_check` | Verifies the token and lists reachable ad accounts |
| `pinterest_list_ad_accounts` | Every ad account the token can reach |
| `pinterest_get_account_entities` | Campaigns, ad groups and ads in one call |
| `pinterest_get_business_assets` | Businesses, members and invites. Identifiers redacted |
| `pinterest_get_platform_resources` | Enumerations and reference data the API exposes |

### Reporting
| Tool | Purpose |
|---|---|
| `pinterest_run_report` | The main reporting tool, on raw column names |
| `pinterest_validate_report` | Check a request *before* running it |
| `pinterest_get_delivery_metrics` | Delivery and pacing signals |
| `pinterest_run_targeting_report` | Performance broken down by targeting |
| `pinterest_run_specialized_export` | Async exports for large result sets |
| `pinterest_estimate_delivery` | Forecast reach for a targeting set |

### Audiences and targeting
| Tool | Purpose |
|---|---|
| `pinterest_get_audiences` / `pinterest_get_audience_insights` | Audiences and their composition |
| `pinterest_get_targeting_options` | Available targeting dimensions and values |
| `pinterest_get_keyword_intelligence` | Keyword metrics and suggestions |
| `pinterest_get_trends` | What is rising on Pinterest |

### Creatives and organic
| Tool | Purpose |
|---|---|
| `pinterest_get_creative_assets` | Ad creatives, media and their metadata |
| `pinterest_get_organic_inventory` | Organic Pins and boards |
| `pinterest_get_pin_analytics` | Performance of individual Pins |

### Commerce
| Tool | Purpose |
|---|---|
| `pinterest_get_catalog_inventory` / `pinterest_get_catalog_diagnostics` | Product feeds and their health |
| `pinterest_run_catalog_report` | Catalog performance |
| `pinterest_run_conversion_product_report` | Conversions by product |
| `pinterest_get_conversion_setup` | Conversion tags and events |

### Operations
| Tool | Purpose |
|---|---|
| `pinterest_get_billing_and_orders` | Billing and order history |
| `pinterest_get_lead_assets` | Lead form configuration. **Lead records are never returned** |

</details>

<details>
<summary><b>7 resources</b></summary>

| URI | Contents |
|---|---|
| `pinterest://manifest` | What this server exposes, and its current mode |
| `pinterest://reporting-columns` | Every reporting column the API accepts |
| `pinterest://attribution` | Attribution windows and their defaults |
| `pinterest://creative-assets` | How creative assets are shaped |
| `pinterest://catalog-reporting` | Catalog-specific reporting columns |
| `pinterest://surface-map` | Which tool covers which part of the API |
| `pinterest://recipes` | Step-by-step workflows |

</details>

---

## Security

- **The token is never logged**, at any log level, or written to disk.
- **One host is contacted, and only one**: `api.pinterest.com`. *A test fails the build if a
  second host appears in the source.*
- **No fetch follows a redirect.** Every outbound call sets `redirect: "error"`, so a redirect
  cannot forward your token to another host. *A test fails the build if any fetch omits this.*
- **Async report URLs are validated before being fetched.** Pinterest returns a download URL
  on a host it chooses; that value is data from the API, not something to trust. HTTPS only,
  no private or loopback address, no redirect, and no credential attached.
- **No telemetry.** The server makes no network call other than to Pinterest.

Full policy, including how personal data is handled: [SECURITY.md](SECURITY.md).

---

## Looking for a managed, multi-platform version?

This server does one platform, on your machine, with your token. That is on purpose.

If you'd rather not run it yourself, or you need Pinterest Ads **alongside Meta Ads, Google
Ads, TikTok Ads, Google Analytics and Search Console** behind one endpoint, with hosted OAuth
and cross-platform reporting, that's what we build at **[getmcpads.com](https://www.getmcpads.com)**.

Same philosophy, less plumbing. This project stays open source and independently useful
either way.

---

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).
Please read [SECURITY.md](SECURITY.md) before reporting anything security-related.

## Licence

[Apache License 2.0](LICENSE). See also [NOTICE](NOTICE).

Pinterest is a trademark of Pinterest, Inc.
**This project is not affiliated with, endorsed by, or sponsored by Pinterest, Inc.**
It is an independent client of a public API.
