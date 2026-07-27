# Cursor SDK — Reference

Context for the scripted code-review agent (`packages/code-review-agent`).

## Official Documentation

**Always prefer live documentation:** [cursor.com/docs/sdk/typescript](https://cursor.com/docs/sdk/typescript)

The Cursor SDK docs are maintained upstream and updated frequently. Do not cache or duplicate them locally—they will drift and become stale.

## Minimal Example

`cookbook-quickstart.ts` — A minimal working example from [cursor/cookbook sdk/quickstart](https://github.com/cursor/cookbook/tree/main/sdk/quickstart) showing basic Agent.create + send + streaming pattern.

## Implementation Decision

**v1 approach:** TypeScript SDK (`@cursor/sdk`), **local** runtime
- `Agent.create` with `local.cwd` pointing to repo root
- `agent.send` with precomputed diff in prompt
- Streaming output to stdout
- Edits constrained by prompt instructions + `local.autoReview` (best-effort gate)
- For local manual runs and future CI integration with repo checkout
