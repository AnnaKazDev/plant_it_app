# Cursor SDK — local context

Cached docs for the scripted code-review agent (`packages/code-review-agent`).

| File | Source |
| --- | --- |
| `typescript-sdk.md` | [cursor.com/docs/sdk/typescript](https://cursor.com/docs/sdk/typescript) |
| `cookbook-quickstart.ts` | [cursor/cookbook sdk/quickstart](https://github.com/cursor/cookbook/tree/main/sdk/quickstart) |

**v1 decision:** TypeScript SDK (`@cursor/sdk`), **local** runtime, `Agent.create` + `agent.send` + streaming — for local scripts and later CI with a repo checkout. Edits constrained by the prompt + `local.autoReview` (best-effort).

Prefer the live docs: [cursor.com/docs/sdk/typescript](https://cursor.com/docs/sdk/typescript).

`typescript-sdk.md` is a local snapshot for offline agent context — refresh manually when the SDK API changes. Last noted refresh: 2026-07 (approx.; not auto-synced).
