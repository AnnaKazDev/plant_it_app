# `@plant-it/code-review-agent`

Niezależna paczka: lokalny, oskryptowany code review na Cursor SDK (`@cursor/sdk`).
v1 pod ręczne uruchomienie; w kolejnej lekcji — CI/CD.

## Wymagania

- Node.js **≥ 22.13** (`.nvmrc` w root: `22.14.0`)
- `CURSOR_API_KEY` — [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations)

## Setup

```bash
cd packages/code-review-agent
npm install
```

Ustaw klucz (jedna z opcji):

```bash
# shell
export CURSOR_API_KEY="crsr_..."

# albo w root repo (gitignored) — skrypt ładuje oba pliki:
# .env  lub  .dev.vars
CURSOR_API_KEY=crsr_...
```

## Uruchomienie

Z katalogu paczki (cwd agenta = **root repo**, nie paczka):

```bash
npm run review
# lub jawny zakres:
npm run review -- --base main --head HEAD
```

Opcjonalnie:

```bash
export CURSOR_MODEL=composer-2.5   # default
export REVIEW_BASE=origin/main
export REVIEW_HEAD=HEAD
```

## Zachowanie

| Aspekt | v1 |
| --- | --- |
| Runtime | **local** (`local.cwd` = root monorepo) |
| Wywołanie | `Agent.prompt` (one-shot, auto-dispose) |
| Zakres | `git diff base...head` |
| Edycje | zabronione w prompcie (review only) |
| Exit codes | `0` finished · `1` startup/`CursorAgentError` · `2` run error/cancel |

Kontekst dokumentacji SDK: `context/sdk/`.
