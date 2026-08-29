# Contributing

Thanks for considering a contribution. This project is maintained by
[GetMCPAds](https://www.getmcpads.com) and is open to outside patches.

## Getting set up

```bash
git clone https://github.com/getmcpads-com/pinterest-ads-mcp-server.git
cd pinterest-ads-mcp-server
npm install
cp .env.example .env
```

Then run the checks:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

All four must pass. CI runs them on Node 18, 20 and 22.

## Ground rules

**Never commit a token.** `.env` is gitignored. Before opening a PR, re-read
your diff for anything starting with `pina_`, which is the prefix of a
Pinterest access token.

**Tests use recorded or synthetic data.** Do not add a test that needs live
credentials to pass; CI has none.

**Reporting column names are the load-bearing part.** This server accepts
Pinterest's raw reporting column names rather than inventing friendly aliases.
If you add or change one, say in the PR description where it comes from: a link
to the Pinterest documentation, or the API error you observed. A
plausible-looking column that does not exist fails at request time, in front of
a user.

**Do not widen what reaches the model.** Two protections are deliberate and
must not be relaxed without saying why in the PR: lead record exports are not
exposed at all, and business member identifiers are redacted by default.

**Keep the async report URL guarded.** Pinterest returns a download URL on a
host it chooses. `assertSafeReportUrl` refuses anything that is not HTTPS or
that points at a private address. Removing that check reopens a request-forgery
path.

**Write tools must preview first.** Any new write tool has to accept `confirm`
and return a preview when it is absent. A tool that mutates an account on the
first call will not be merged.

**Keep it self-contained.** Runtime dependencies are `@modelcontextprotocol/sdk`
and `zod`. Adding a third needs a good reason.

## Credentials never reach the logs or another host

Two tests enforce this: one fails if any `fetch` omits `redirect: "error"`, and
one fails if a host other than `api.pinterest.com` appears in the source. Both
are load-bearing, not decoration.

## Commit and PR style

- One logical change per PR.
- Explain *why*, not just *what*. The diff already says what.
- If you fix a bug, add the test that would have caught it.

## Reporting bugs

Open an issue with: what you called, what you expected, what you got, and the
Pinterest API version in use. Redact IDs and tokens.

For anything security-related, do not open an issue. See [SECURITY.md](SECURITY.md).

## Licence

By contributing, you agree that your contributions are licensed under the
Apache License 2.0, as stated in [LICENSE](LICENSE).
