# Security Policy

This server holds a token that can read, and when writes are enabled modify,
live advertising accounts. We take reports seriously.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Use GitHub's private vulnerability reporting on this repository:
[Report a vulnerability](https://github.com/getmcpads-com/pinterest-ads-mcp-server/security/advisories/new).

We aim to acknowledge a report within 3 business days and to ship a fix or a
documented mitigation within 30 days. We will credit you in the advisory unless
you ask us not to.

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |

## What this server does with your token

- The access token, and the refresh credentials when used, are read once from
  the environment at startup and kept in memory. None is ever written to disk
  or logged, at any log level.
- **One host is contacted, and only one**: `api.pinterest.com`. *A test fails
  the build if a second host appears in the source.*
- **No fetch follows a redirect.** Every outbound call sets `redirect: "error"`,
  so a redirect cannot forward your token to another host. *A test fails the
  build if any fetch omits this.*
- No telemetry, no analytics, no phone-home.

## Async report downloads

Pinterest runs large reports asynchronously and returns a download URL on a
host it chooses. That URL is **data returned by the API, not a value to trust
blindly**, so it is validated before being fetched:

- HTTPS only.
- No loopback, link-local or private address, so a crafted or mistaken value
  cannot become a request to the machine running the server or to a cloud
  metadata endpoint.
- No redirect followed.
- No credential attached to that request.

## Personal data

Two distinct protections, and they work differently.

**Lead records are not exposed at all.** `pinterest_get_lead_assets` returns
lead form and subscription configuration, but never the lead export itself,
because those rows carry personal information submitted by end users. This is
an exclusion, not a redaction: the data never leaves Pinterest through this
server.

**Business member identifiers are redacted by default.** Member IDs, email
addresses and usernames are replaced before they reach the model when reading
members, asset members and invites. `includePersonalIdentifiers: true` returns
the raw values, and defaults to `false`. Use it only with explicit
authorisation, since these are your colleagues' addresses.

## Handling your token safely

- Grant `ads:read` only. Add `ads:write` **only** if you enable writes.
- Treat the token like a password: it is a bearer credential.
- Your MCP client config file is usually plain text on disk. Check its
  permissions, and never commit it.
- Rotate the token if you suspect exposure.

## Scope

Vulnerabilities in the Pinterest API itself are not in scope here; report those
to Pinterest.
