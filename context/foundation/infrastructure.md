---
project: Plant It
researched_at: 2026-05-24T14:25:00+02:00
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 + React 19
  runtime: Cloudflare Workers (via @astrojs/cloudflare)
  database: Supabase (external)
---

## Recommendation

**Deploy on Cloudflare Workers.**

Cloudflare Workers provides the most generous free tier (100k requests/day = 3M/month vs Vercel's 1M/month), matches the tech-stack.md deployment target, scores 5/5 on agent-friendly criteria (CLI-first with wrangler, Code Mode MCP server, markdown docs on GitHub), and supports WebSockets for potential future real-time features. The platform's edge-first architecture delivers fast global performance with minimal configuration. Trade-off: 10ms CPU limit on free tier may require upgrade to Workers Paid ($5/month for 30s CPU limit) if SSR pages with Supabase queries + external API calls exceed the budget. Plan to test realistic page render times early and upgrade if needed; the $5/month paid tier remains more cost-effective than competitors while unlocking production-grade CPU limits.

## Platform Comparison

### Scoring Matrix

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total Score |
|---|---|---|---|---|---|---|
| **Vercel** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass (Official MCP) | 5/5 |
| **Cloudflare Workers** | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass (Code Mode MCP) | 5/5 |
| **Netlify** | ⚠️ Partial (no CLI rollback) | ✅ Pass | ✅ Pass | ✅ Pass | ✅ Pass (Official MCP) | 4.5/5 |
| **Railway** | ⚠️ Partial (no rollback) | ✅ Pass | ✅ Pass | ✅ Pass | ⚠️ Partial (Agent, token-metered) | 4/5 |
| **Fly.io** | ✅ Pass | ✅ Pass | ❌ Fail (no markdown docs) | ✅ Pass | ⚠️ Partial (MCP beta) | 3.5/5 |
| **Render** | ❌ Fail (no CLI rollback/logs) | ✅ Pass | ❌ Fail (HTML-only docs) | ⚠️ Partial (API hooks) | ❌ Fail (no MCP) | 2/5 |

**Explanation:**
- **CLI-first:** Vercel CLI provides `vercel deploy`, `vercel rollback`, `vercel logs --follow` (real-time only, not historical). Cloudflare, Fly.io, and Railway also pass. Netlify and Railway lack CLI rollback. Render fails (dashboard-only for rollback/historical logs).
- **Managed/Serverless:** All six platforms pass — serverless functions or managed containers, no OS patching required.
- **Agent-readable docs:** Vercel, Cloudflare, Netlify, Railway provide markdown docs on GitHub or llms.txt. Fly.io and Render serve HTML-only docs (fail).
- **Stable deploy API:** Vercel (`vercel --prod`), Cloudflare (`wrangler deploy`), Netlify (`netlify deploy --prod`), Railway (`railway up`), Fly.io (`fly deploy`) all pass. Render uses deploy hooks (partial).
- **MCP / Integration:** Vercel has official MCP server (GA), Cloudflare has Code Mode MCP (GA), Netlify has official MCP (GA). Railway has Railway Agent (token-metered, shares plan credit). Fly.io MCP is beta. Render has no MCP.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

**Why it won:** Most generous free tier (100k requests/day = 3M/month vs Vercel 1M/month), perfect agent-friendly score (5/5), matches tech-stack.md `deployment_target` intent, strong MCP integration via Code Mode server (`mcp.cloudflare.com`), and WebSocket support for potential future real-time features. Official Astro 6 adapter (@astrojs/cloudflare v13+) with React 19 support. External Supabase already in tech stack, so co-located D1/KV not required but available if needed. Cost path: start on free tier, upgrade to Workers Paid ($5/month) if 10ms CPU limit blocks SSR — still more cost-effective than Vercel Pro ($20/month) or Netlify paid tiers.

**Key strengths:**
- CLI-first: `wrangler deploy`, `wrangler rollback [version-id]`, `wrangler tail` (live logs), `wrangler versions list`
- 3x higher free tier request ceiling than Vercel (3M vs 1M/month)
- WebSocket support (configure `protocol="tcp"` in wrangler.toml)
- Co-located storage (R2 for photos, KV for sessions, D1 for relational data, Queues for async jobs) — all GA
- Code Mode MCP server exposes entire Cloudflare API through 2 tools (~1k tokens vs traditional MCP's 244k tokens)
- Astro 6 dev environment uses real `workerd` runtime (same as production) via Cloudflare Vite plugin

**Known limitations:**
- **10ms CPU limit on free tier** — SSR pages with Supabase queries + external API calls may exceed limit (Error 1027). Upgrade to Workers Paid ($5/month) lifts limit to 30 seconds.
- Astro 6 removed Cloudflare Pages support (breaking change) — deploy to Workers only, not Pages (tech-stack.md referenced Pages, now obsolete)
- R2 storage metered separately ($4.50 per million writes, $0.015/GB/month) — photo uploads add cost beyond Workers request pricing
- Cold starts: 50-200ms for SSR Workers with external Supabase connections (faster than AWS Lambda, slower than Vercel Edge)

#### 2. Vercel

**Why it scored second:** Tied with Cloudflare on agent-friendly criteria (5/5), familiar platform (interview Q3), official Astro 6 adapter (v10.0.6, April 2026), Supabase Marketplace integration with auto-synced env vars, official MCP server for Cursor, and no CPU time metering (eliminates Cloudflare's 10ms free tier concern). Free tier (1M requests/month) covers 10k-100k MVP target but offers 3x less headroom than Cloudflare (1M vs 3M/month). Bandwidth cap (100GB/month) requires monitoring photo serving.

**Key strengths:**
- No CPU time limits (free or paid) — SSR pages with heavy compute don't hit artificial caps
- Supabase Marketplace integration auto-syncs env vars (SUPABASE_URL, SUPABASE_ANON_KEY)
- React 19 SSR resolved: Astro 6.1.8 fixed Float preload injection bug (Issue #16212) and esbuild parse errors (Issue #16258)
- MCP integration: `https://mcp.vercel.com` with OAuth, structured deploy/status/logs tools

**Gap vs Cloudflare:**
- 3x lower free tier ceiling (1M vs 3M requests/month)
- No WebSocket support (explicitly unsupported) — requires external provider (Ably, Pusher, Supabase Realtime)
- Free tier bandwidth cap: 100GB/month (Cloudflare has no bandwidth limits)
- Vendor lock-in risk: Vercel-specific APIs (`@vercel/analytics`, edge config) create migration friction

#### 3. Netlify

**Why it scored third:** Familiar platform (interview Q3), official Astro 6 adapter, official MCP server, and co-located Netlify Database (serverless Postgres, GA as of April 2026). Scores 4.5/5 on agent-friendly criteria (loses 0.5 for no CLI rollback command). Falls behind Vercel and Cloudflare on cost: credit-based free tier (300 credits/month) covers ~150k requests at Pro rate, making 100k requests push into paid territory. 10k requests (20 credits) fit comfortably, but scaling past 50k/month burns credits fast.

**Key strengths:**
- Netlify Database (serverless Postgres, GA) offers co-located alternative to external Supabase
- Official MCP server (`@netlify/mcp`) for Cursor integration
- Familiar DX (interview Q3) with strong documentation

**Gap vs Vercel:**
- Credit-based metering less transparent than request counts (2 credits per 10k requests + compute/bandwidth meters)
- Free tier ceiling lower: 300 credits (~150k requests) vs Vercel 1M requests
- No CLI rollback (must publish previous deploy via dashboard)
- Astro 6.1.3 known bug: inline script dynamic imports break Netlify builds on Linux (Issue #16209)

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **10ms CPU limit on free tier is a landmine for SSR.** Every Supabase query, weather API call, and React island hydration eats CPU time. A single page render with 2-3 external calls will blow past 10ms and fail with Error 1027. You won't know until production.

2. **Astro 6 removed Cloudflare Pages support.** Your tech-stack.md says `deployment_target: cloudflare-pages` but Astro 6 + @astrojs/cloudflare v13 deploy to Workers only. Pages deployment will fail. This is a breaking change shipped 3 months ago (February 2026).

3. **No persistent storage included in free tier.** KV has a 1,000 write/day limit (free), D1 is 5M reads/day but writes cost money. If your app tracks plant actions locally (not just in Supabase), you'll hit KV write limits fast.

4. **Cold start uncertainty.** Cloudflare Workers market themselves as "near-zero cold starts" but that's for edge-cached Workers. SSR Workers with external Supabase connections see 50-200ms cold starts in practice — faster than AWS Lambda, but not instant.

5. **Wrangler dev experience vs production mismatch (Astro 6).** The new `workerd` dev runtime in Astro 6 is *closer* to production than Node, but it's not identical. Bindings (KV, R2, D1) work differently in local dev vs deployed Workers, and the error messages don't always clarify which environment broke.

### Pre-Mortem — How This Could Fail

The team deployed Plant It on Cloudflare Workers Free tier in July 2026. By September, the project was dead.

Here's what went wrong: They deployed the MVP without load-testing SSR render times. Each plant card page fetched weather data from an external API (150ms), queried Supabase for plant actions (80ms), and rendered React islands (20ms CPU). Total: 250ms wall time, 15-20ms CPU time. The free tier's 10ms CPU limit rejected 60% of requests with Error 1027. Users saw "Worker exceeded CPU limit" instead of their garden.

They upgraded to Workers Paid ($5/month) to lift the CPU limit. That fixed the errors, but now they were paying $0.30 per million requests beyond the 10M included. By mid-August, traffic hit 15M requests/month (50k daily active users checking plant status multiple times/day). Bill: $5 base + $1.50 overage = $6.50/month. Not catastrophic, but 30% over budget.

The real failure was photo uploads. They used Cloudflare R2 for plant photos (5 photos per action, max). R2 writes cost $4.50 per million operations. 10k users each logging 5 actions/month with 3 photos/action = 150k photos/month = 150k R2 PUTs = $0.68/month. Add R2 storage ($0.015/GB/month) for 15GB of photos = $0.23/month. New bill: $6.50 + $0.68 + $0.23 = $7.41/month, still affordable.

But they didn't monitor usage. A single user uploaded 500 test photos in one afternoon (testing the "add multiple photos" feature). That spiked R2 PUTs by 500 unplanned operations in an hour. No automatic rate limiting, no user-facing upload quota. By month-end, R2 costs jumped to $2.80 (620k PUTs). Final bill: $10.21/month.

The breaking point: in September, Cloudflare changed R2 pricing (hypothetical). Free egress disappeared; they added $0.01/GB egress. Plant It served 50GB of photo thumbnails/month (users browsing plant cards). New monthly cost: $10.21 + $0.50 = $10.71/month. The founder had budgeted $5/month total. Project abandoned.

### Unknown Unknowns

1. **Astro 6 + Cloudflare adapter version lock-in.** The `@astrojs/cloudflare` adapter v13 requires Astro 6+. If you need to pin Astro 5.x for any reason (e.g., a React 19 regression), you're stuck on adapter v12, which means no `workerd` dev environment and no new Cloudflare features.

2. **Supabase pooler is mandatory, not optional.** Cloudflare Workers can't maintain persistent Postgres connections (10ms CPU limit kills connection setup). You *must* use Supabase's Supavisor pooler (port 6543, transaction mode), not the direct connection. If Supavisor goes down or rate-limits you (rare but happens), your entire app is offline. There's no fallback.

3. **Workers observability is dashboard-only for free tier.** `wrangler tail` streams logs live, but historical logs (e.g., "show me all errors from 2 hours ago") require the Cloudflare dashboard. No CLI export, no `wrangler logs --since 2h`. For debugging production issues after the fact, you're clicking through a web UI.

4. **R2 eventual consistency can break "just uploaded" flows.** R2 is eventually consistent (~1 second). If a user uploads a plant photo and immediately views the plant card, the photo might 404 for 1-2 seconds. You need client-side retry logic or optimistic UI state — the platform won't guarantee instant read-after-write.

5. **No built-in cron for free tier beyond 5 triggers.** Cloudflare Workers Free tier allows 5 cron triggers total (not per Worker, per account). If you plan scheduled tasks (e.g., "send planned action reminders," "fetch weather updates," "generate weekly garden reports"), you'll hit the limit fast. Workaround: use external cron (GitHub Actions) to call a Worker HTTP endpoint, but that burns request quota.

## Operational Story

How Cloudflare Workers actually operates day to day:

- **Preview deploys**: Git integration (GitHub, GitLab, Bitbucket) triggers automatic deploys on every push. Each branch deploys to a unique preview URL (`<branch>.<worker-name>.<account>.workers.dev`). Preview URLs are public by default (no auth) — use Cloudflare Access (free for up to 50 users) to gate previews if needed. Fork PRs do not auto-deploy (security: forks lack secrets). Manual approval via dashboard required.

- **Secrets**: Environment variables and secrets live in `wrangler.toml` (for non-sensitive config) or Cloudflare dashboard → Workers & Pages → Settings → Variables. Secrets stored encrypted, injected at runtime only (never exposed in client-side code). For Supabase: add `SUPABASE_URL` (plain var) and `SUPABASE_KEY` (encrypted secret) via dashboard or `wrangler secret put SUPABASE_KEY`. Rotation: update secret via dashboard or `wrangler secret put` → redeploy (`wrangler deploy`) to apply. Secrets are visible to account members with "Workers Scripts:Edit" permission (no per-Worker RBAC on free tier).

- **Rollback**: `wrangler rollback [version-id]` or dashboard → Deployments → select previous version → "Rollback". Rollback changes production traffic routing to 100% on target version (instant, global edge propagation ~30 seconds). Caveat: rollback creates a new deployment (it's not a true "undo" — just a deploy of an old version). Database migrations don't roll back — if a deployment included Supabase schema changes, rolling back code leaves DB in new state. Manual SQL rollback required.

- **Approval**: Free tier: all deploys via `wrangler deploy` or Git push to `main` go live immediately (no approval gate). Paid tier: use Gradual Rollouts (canary deployments) to route partial traffic first, or external approval via GitHub Actions workflow with manual trigger. Agent may perform: deploy via `wrangler deploy`, rollback via `wrangler rollback`, tail logs via `wrangler tail`. Agent must not perform without approval: delete Worker, purge KV namespace, rotate API tokens (breaks production), change DNS routing rules.

- **Logs**: `wrangler tail` streams real-time logs (console.log, errors, request/response) from live production traffic. Historical logs: Cloudflare dashboard → Workers & Pages → [Worker name] → Logs (limited to recent 24 hours on free tier, 30 days on paid). No CLI command for historical log export (`wrangler logs --since 2h` does not exist). For debugging past errors, use dashboard Logs tab or enable Workers Logpush (paid feature, sends logs to R2/S3/GCS). MCP Code Mode server (`mcp.cloudflare.com`) exposes `search()` and `execute()` tools to query Workers Analytics API for aggregated metrics (requests, errors, CPU time), but not raw logs.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **10ms CPU limit exceeded on free tier** | Devil's advocate #1, Pre-mortem | High | High (Error 1027, 60% requests rejected per pre-mortem) | **Plan to upgrade to Workers Paid ($5/month) immediately** if MVP launch shows realistic SSR page renders exceed 10ms. Test early: deploy a single plant card page, measure CPU time with `wrangler tail` (logs show `cpuTime` per request), and upgrade proactively before user traffic arrives. Paid tier lifts limit to 30s (3,000x headroom). Alternatively, optimize: cache weather API responses (KV, 1 hour TTL), use Supabase RPC for complex queries (runs DB-side, not in Worker CPU budget), minimize React island hydration code. |
| **Astro 6 removed Pages support (breaking change from tech-stack.md)** | Devil's advocate #2, Research finding | Low | Medium (confusion during deployment, Pages deploy fails) | Update tech-stack.md to reflect Workers-only deployment. When running `wrangler deploy`, deploy to Workers (`wrangler deploy`), not Pages (`wrangler pages deploy ./dist` — this will fail). Document in `AGENTS.md`: "Astro 6 + @astrojs/cloudflare v13 targets Workers, not Pages. Do not use `wrangler pages deploy`." |
| **R2 storage costs for photo uploads** | Devil's advocate #3, Pre-mortem | Medium | Medium ($0.68-2.80/month per pre-mortem, can spike with abuse) | Set user-facing upload quotas: max 5 photos per action (already in PRD FR-007), max 50 actions/user/month (soft limit via UI warning). Monitor R2 usage in Cloudflare dashboard → R2 → [Bucket] → Metrics. Set billing alert at $2/month. If abuse detected (e.g., 500 uploads in 1 hour): implement rate limiting (max 10 uploads/hour/user) via KV-backed counter. Alternative: serve photos via Supabase Storage (1GB free, $0.021/GB/month beyond) instead of R2 to consolidate billing. |
| **Cold starts (50-200ms)** | Devil's advocate #4, Research finding | Medium | Medium (slow first page load per user session) | Accept for MVP — Workers warm after first request per region. Optimize: keep Worker bundle under 1MB (use code splitting for large dependencies), avoid top-level `await` in Worker script (delays startup), use Supabase pooler (port 6543, transaction mode) to skip connection setup overhead. Pre-warm with synthetic monitor (external cron hitting homepage every 5 minutes from 2-3 regions). |
| **Workerd dev vs production mismatch** | Devil's advocate #5 | Low | Medium (local dev works, production breaks) | Test every Cloudflare binding (KV, R2, D1) in a deployed Preview environment before merging to `main`. Astro 6's `astro dev` uses real `workerd` runtime (closer to production than Node), but bindings (e.g., `env.MY_KV`) are mocked locally. Document in `CLAUDE.md`: "Always deploy to Preview (`wrangler deploy --env preview`) and test bindings before promoting to production." |
| **Supabase pooler is mandatory** | Unknown unknowns #2 | Medium | High (entire app offline if Supavisor down) | Use Supabase pooler (port 6543, transaction mode) from day 1 — Workers cannot maintain direct Postgres connections (10ms CPU limit kills connection setup). Monitor Supabase status page (status.supabase.com) for pooler incidents. If pooler is down: no immediate workaround (Workers can't use direct connection). Fallback: serve cached plant list from KV (stale data, but app stays online). Set up uptime monitor (e.g., Uptime Robot) to alert on 5xx errors indicating pooler failure. |
| **No historical logs via CLI** | Unknown unknowns #3, Research finding | Medium | Medium (agent blocked on debugging past errors) | `wrangler tail` streams real-time logs only. For historical debugging: use Cloudflare dashboard → Workers & Pages → Logs (24-hour retention on free tier). Set up external log aggregation if retention > 24h needed: enable Workers Logpush (paid feature, $0.50/million logs) to send logs to R2 bucket, or use Sentry/Axiom integration (free tier: 1GB/month). MCP Code Mode server (`mcp.cloudflare.com`) can query Workers Analytics API for aggregated error counts, but not raw logs. |
| **R2 eventual consistency (1-2 second delay)** | Unknown unknowns #4 | Medium | Medium (user uploads photo, sees 404 for 1-2s) | Implement optimistic UI: after photo upload completes (R2 PUT returns 200), immediately show uploaded photo in client-side state (don't refetch from R2). Add retry logic: if plant card page fetches photo and gets 404, retry 3 times with 500ms delay (R2 propagates within 1-2s). Document in `CLAUDE.md`: "R2 is eventually consistent — always use optimistic UI for uploads." |
| **Cron trigger limit (5 per account on free tier)** | Unknown unknowns #5 | Low | Low (limits scheduled tasks, but MVP has none in PRD) | PRD has no scheduled tasks in MVP scope (no push notifications, no reminders). If cron needed later: prioritize the 5 most critical tasks (e.g., "fetch weather updates daily," "clean up expired sessions"). For additional tasks: use external cron (GitHub Actions scheduled workflow) to call Worker HTTP endpoint (e.g., `POST /api/cron/weather-update` with bearer token auth). External cron burns request quota, but free tier (100k/day) has headroom. |
| **Free tier KV write limit (1,000/day)** | Devil's advocate #3 | Low | Low (unlikely to hit unless using KV for sessions or cache) | Free tier allows 1,000 KV writes/day. MVP uses Supabase for all persistent data (plants, actions, user accounts), so KV is optional. If using KV for session storage: 1,000 writes/day = ~40 logins/hour (each login writes session token to KV). Sufficient for MVP (<50 DAU). If limit hit: upgrade to Workers Paid ($5/month, 1M writes/month included) or switch to Supabase for sessions (store `session_id` in `sessions` table). |
| **Astro 6 + @astrojs/cloudflare v13 version lock-in** | Unknown unknowns #1 | Low | Medium (can't downgrade Astro if regression found) | `@astrojs/cloudflare` v13 requires Astro 6+. If a critical Astro 6 bug blocks production, downgrading to Astro 5.x forces downgrade to adapter v12 (loses `workerd` dev runtime, loses Astro 6 features). Mitigation: pin Astro + adapter versions in `package.json` (already done by bootstrapper), test thoroughly in Preview before each Astro upgrade. If regression found: file GitHub issue, roll back to last known-good Astro version, wait for patch release. |
| **Workers Paid upgrade decision paralysis** | Pre-mortem | Medium | High (delays launch or causes free-tier production failures) | **Decision rule:** If any plant card page render exceeds 8ms CPU time in `wrangler tail` logs during testing, upgrade to Workers Paid ($5/month) before launch. Do not attempt to "optimize down to 10ms" — the CPU budget is too tight for realistic SSR workloads (Supabase query + weather API + React hydration). Treat $5/month as the true MVP cost, not $0. Budget accordingly. |

## Getting Started

Five concrete first steps to deploy Plant It to Cloudflare Workers:

1. **Install Wrangler CLI and authenticate**
   ```bash
   npm install -g wrangler
   wrangler login
   ```
   Wrangler opens browser to authenticate with your Cloudflare account. Choose the account you'll use for Plant It deployment.

2. **Verify Astro adapter version and configuration**
   ```bash
   npm list @astrojs/cloudflare
   ```
   Confirm `@astrojs/cloudflare@13.0.0` or higher (Astro 6 + React 19 support, required for Workers deployment). If lower, upgrade:
   ```bash
   npm install @astrojs/cloudflare@latest
   ```
   Verify `astro.config.mjs` has `output: "server"` and `adapter: cloudflare()`. The bootstrapper already configured this.

3. **Create `wrangler.toml` configuration**
   Astro 6 generates a Workers-compatible entrypoint. Create `wrangler.toml` in project root (or verify if bootstrapper created it):
   ```toml
   name = "plant-it"
   main = "dist/_worker.js/index.js"
   compatibility_date = "2026-05-24"
   compatibility_flags = ["nodejs_compat"]
   
   [assets]
   directory = "./dist"
   binding = "ASSETS"
   
   [observability]
   enabled = true
   ```
   **Note:** `main` points to the Astro 6 build output (`dist/_worker.js/index.js`), not the old entrypoint. Do not change this path.

4. **Configure Supabase connection pooler and add secrets**
   Workers require Supabase pooler (port 6543, transaction mode) — direct connections fail due to 10ms CPU limit. Verify `src/lib/supabase.ts` uses pooler connection string:
   ```typescript
   // Pooler format: postgresql://postgres.[project-ref]:[password]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   const supabaseUrl = import.meta.env.SUPABASE_URL;
   const supabaseKey = import.meta.env.SUPABASE_KEY;
   ```
   Add secrets via Wrangler:
   ```bash
   wrangler secret put SUPABASE_URL
   # Paste: https://[project-ref].supabase.co
   wrangler secret put SUPABASE_KEY
   # Paste: your anon/public key from Supabase dashboard
   ```
   Secrets are encrypted and injected at runtime (not visible in `wrangler.toml` or Git).

5. **Build and deploy**
   ```bash
   npm run build
   wrangler deploy
   ```
   Wrangler uploads the built Worker to Cloudflare, deploys to `plant-it.[account].workers.dev`. Test the URL to confirm SSR works. Check logs:
   ```bash
   wrangler tail
   ```
   Make a request to your Worker (open the URL in browser). `wrangler tail` shows real-time logs including `cpuTime` per request. **Critical:** If `cpuTime` exceeds 8ms on plant card pages, plan to upgrade to Workers Paid ($5/month) before launch.

**Next:** Set up GitHub Actions CI/CD (already configured per tech-stack.md: `ci_provider: github-actions`, `ci_default_flow: auto-deploy-on-merge`). Add Wrangler to GitHub Actions workflow with `CLOUDFLARE_API_TOKEN` secret (generate from Cloudflare dashboard → Profile → API Tokens → Create Token → Edit Cloudflare Workers template).

## Out of Scope

The following were not evaluated in this research:

- **Docker image configuration** — Cloudflare Workers use JavaScript/WebAssembly runtime (no Docker required for Astro SSR)
- **CI/CD pipeline setup** — GitHub Actions already configured per tech-stack.md; Cloudflare Workers auto-deploy on push to `main` via GitHub integration or Wrangler CLI in CI workflow
- **Production-scale architecture** (multi-region, HA, DR) — MVP scope only; Cloudflare Workers deploy globally across 300+ edge locations by default (no configuration needed), but formal HA/DR planning (failover policies, backup regions) is post-MVP
- **Alternative runtimes** (Bun, Deno) — Astro 6 SSR on Cloudflare Workers uses `workerd` runtime (Cloudflare's open-source JavaScript runtime based on V8); Bun/Deno not evaluated as they require different deployment targets
- **Cloudflare Pages deployment** — Astro 6 removed Pages support (@astrojs/cloudflare v13 targets Workers only); Pages was not evaluated
