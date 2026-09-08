# CLAUDE.md - n8n-nodes-autoelevate

@AGENTS.md

## Project overview

n8n community node for the AutoElevate Partner API (beta). Published to npm as
`n8n-nodes-autoelevate`. MIT. Author: David Szpunar. Programmatic node, `usableAsTool`,
read-only by design (approve/deny are deliberately not implemented).

## Layout

```
credentials/AutoElevateApi.credentials.ts   # scheme (hmac default | bearer), token, hmacSecret, baseUrl; no authenticate block
nodes/AutoElevate/
  AutoElevate.node.ts                       # resource/operation dispatch, credentialTest, loadOptions, agent counts
  descriptions/*Description.ts              # one file per resource; shared.ts has Return All/Limit + filter builders
  transport/request.ts                      # signing (HMAC over METHOD\n<path?query>\nbodyHash\nts), acknowledgment header, walkers
openapi/                                    # vendored spec + provenance README; nothing is generated from it
.claude/rules/                              # n8n code/UI/credential/naming/version rules (apply when editing those paths)
```

## Non-negotiables

- **Zero runtime dependencies.** Only `n8n-workflow` (peer) and `crypto`. Do not add
  `@dszp/autoelevate-lib`; the transport is vendored on purpose. Keep it in step with the lib's
  `src/auth.ts` / `src/http.ts` (the lib has the offline vectors and live test).
- **HMAC signs the request-target** (path + query, no host). Verified live 2026-09-08; the
  absolute URL is rejected with `Invalid signature`.
- **Every request carries `X-Acknowledgment: i-understand-this-is-beta-and-may-change`.**
- **Walkers assert against the first page's `totalCount`** and throw on a short result. The API
  reports `totalCount: 0` once `skip` passes the end.
- No `console.log`, no `process`, no `setTimeout`; lint with `npm run lint` before any commit.
- Bump `nodeVersion` in `AutoElevate.node.json` whenever `package.json` version changes.

## Commands

`npm run lint` · `npm run build` · `npx n8n-node cloud-support` · `n8n-restart autoelevate`
(from `~/workspace/n8n/n8n-dev.sh`, the podman dev loop) · release via the
`npm-release-n8n-node` skill.
