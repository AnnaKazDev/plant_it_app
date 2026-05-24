Cloudflare Workers Integration & Deployment Plan

Context

Based on context/foundation/infrastructure.md, we're deploying Plant It to Cloudflare Workers with:





Astro 6 SSR with React 19 islands



Supabase for auth and database (external)



@astrojs/cloudflare v13.5.0 adapter (already installed)



Wrangler 4.90.0 (already installed)

Critical trade-offs identified:





10ms CPU limit on free tier likely insufficient for SSR with Supabase queries



Plan to upgrade to Workers Paid ($5/month) if realistic page renders exceed 8ms



Must use Supabase connection pooler (port 6543) to avoid connection setup overhead

Phase 1: Pre-Deployment Configuration

1.1 Update Wrangler Configuration

Current wrangler.jsonc needs updates per latest Cloudflare docs:

{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "plant-it",  // Updated from "10x-astro-starter"
  "main": "./dist/_worker.js/index.js",  // Changed: Astro 6 generates this entrypoint
  "compatibility_date": "2026-05-24",  // Updated to today
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "binding": "ASSETS",
    "directory": "./dist",
    "not_found_handling": "404-page"
  },
  "observability": {
    "enabled": true
  }
}

Key changes:





name: "plant-it" (matches project)



main: "./dist/_worker.js/index.js" (new Astro 6 output path, not the entrypoint reference)



compatibility_date: today's date (2026-05-24)

Edge case: If using Cloudflare bindings (KV, R2, D1) later, add them here and run npx wrangler types to generate TypeScript definitions.

1.2 Verify Astro Configuration

astro.config.mjs is already correctly configured:





output: "server" ✅



adapter: cloudflare() ✅



env.schema with SUPABASE_URL and SUPABASE_KEY ✅

No changes needed.

1.3 Prepare Environment Variables Template

Create .dev.vars.example to document required secrets (.dev.vars is already gitignored):

# Cloudflare Workers local development secrets
# Copy this to .dev.vars and fill in real values
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_KEY=[anon-key-from-supabase-dashboard]

Why: Wrangler uses .dev.vars for local secrets (not .env). Cloudflare's workerd runtime reads from this file during npm run dev.

Phase 2: Supabase Connection Configuration

2.1 Decision: Cloud Supabase Project Setup

Two paths available:

Path A: Local Supabase (Docker-based)

Already documented in README.md. Requires Docker + 7GB RAM.





✅ Good for: isolated development, no cloud costs



❌ Bad for: production deployment (can't deploy local DB to cloud)

Path B: Cloud Supabase Project (Recommended for deployment)





✅ Good for: production deployment, matches infrastructure.md assumptions



❌ Requires: Supabase account (free tier available)

Action required: User must decide which path. For production deployment, Path B is mandatory.

If Path B (Cloud Supabase):





Create Supabase project at https://supabase.com/dashboard



Get credentials from Dashboard → Settings → API:





Project URL: https://[project-ref].supabase.co



Anon/public key: eyJ... (safe to expose client-side)



Create .dev.vars file:

   SUPABASE_URL=https://[project-ref].supabase.co
   SUPABASE_KEY=[anon-key]
   


2.2 Verify Supabase Client Configuration

src/lib/supabase.ts uses @supabase/ssr correctly:





Reads from astro:env/server (SUPABASE_URL, SUPABASE_KEY) ✅



Server-side client with cookie-based sessions ✅

Critical edge case: For Cloudflare Workers production, Supabase's @supabase/supabase-js client will automatically use the connection pooler when available. However, if using direct Postgres access (e.g., via Prisma or pg driver), you MUST use the pooler connection string:

postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

Note: Current implementation uses Supabase client (not direct Postgres), so pooler is handled automatically. Only relevant if switching to direct DB access later.

2.3 Auth Configuration Note

Per README.md, Supabase requires email confirmation by default. For production:





Keep email confirmation ON (security best practice)



Add email templates in Supabase Dashboard → Authentication → Email Templates



Configure SMTP (or use Supabase's default sender)

For testing deployments, can toggle off in Dashboard → Authentication → Email → Confirm email.

Phase 3: Local Development Verification

Before deploying, verify the app runs locally with Cloudflare's workerd runtime.

3.1 Install Dependencies (if not done)

npm install

3.2 Create Local Environment File

cp .env.example .dev.vars
# Edit .dev.vars with real Supabase credentials

3.3 Start Development Server

npm run dev

Expected: Astro dev server starts with Cloudflare workerd runtime. Check console output for:

astro  v6.3.1 started in [N]ms
  ┃ Local    http://localhost:4321/
  ┃ Runtime  Cloudflare (workerd)

Edge case - if dev server fails:





"SUPABASE_URL is not defined": .dev.vars not created or missing variables



"Module not found": Run npm install again



"Port 4321 already in use": Kill existing process or use different port

3.4 Test Auth Flow Locally





Navigate to http://localhost:4321/auth/signup



Create test account



If email confirmation is enabled: check Supabase Dashboard → Authentication → Users to manually confirm



Sign in at http://localhost:4321/auth/signin



Verify redirect to http://localhost:4321/dashboard

Checklist:





Signup form works



Signin form works



Protected route (/dashboard) redirects when not authenticated



Protected route accessible when authenticated

Phase 4: Cloudflare Workers Deployment

4.1 Authenticate Wrangler

npx wrangler login

Expected: Browser opens to Cloudflare login. Choose the account for Plant It deployment.

Edge case - authentication fails:





If behind corporate proxy: npx wrangler login --proxy http://proxy-url:port



If no browser available: Use npx wrangler login --no-browser and follow CLI instructions

4.2 Configure Production Secrets

Cloudflare Workers requires secrets to be set separately (not in wrangler.jsonc).

npx wrangler secret put SUPABASE_URL
# When prompted, paste: https://[project-ref].supabase.co

npx wrangler secret put SUPABASE_KEY
# When prompted, paste: your anon/public key

Security note: These secrets are encrypted at rest and only injected at runtime. Not visible in Cloudflare dashboard to non-admin users.

Edge case - secret update fails:





"Authentication error": Re-run npx wrangler login



"Worker not found": Deploy once first (npx wrangler deploy), then add secrets

4.3 First Deployment

npm run build
npx wrangler deploy

Expected output:

Total Upload: [N] KiB / gzip: [N] KiB
Deployed plant-it triggers (1.23 sec)
  https://plant-it.[account].workers.dev

Edge case - build fails:





"SUPABASE_URL is required": Set as Wrangler secret first (step 4.2)



TypeScript errors: Run npm run lint locally first



"Worker exceeded size limit": Use code splitting or remove unused dependencies

Edge case - deployment fails:





"Authentication error": Re-run npx wrangler login



"Account limit exceeded": Check Cloudflare dashboard → Workers & Pages → Settings → Usage (free tier: 100k requests/day)



"Invalid wrangler.jsonc": Verify JSON syntax (use npx jsonlint wrangler.jsonc)

4.4 Critical: CPU Time Measurement

After first deployment, immediately test SSR performance:

# Open 2 terminals:

# Terminal 1: Stream live logs
npx wrangler tail

# Terminal 2: Make requests
curl https://plant-it.[account].workers.dev/
curl https://plant-it.[account].workers.dev/auth/signin

In Terminal 1, look for cpuTime in logs:

{
  "event": { ... },
  "logs": [ ... ],
  "outcome": "ok",
  "scriptName": "plant-it",
  "cpuTime": 12  // <-- THIS NUMBER IN MILLISECONDS
}

Decision rule:





If cpuTime > 8ms on any page: Plan to upgrade to Workers Paid ($5/month) before user-facing launch



If cpuTime > 10ms consistently: Upgrade immediately (free tier will reject ~60% of requests with Error 1027)

Mitigation if upgrade not possible:





Cache external API calls (weather data) in KV (1 hour TTL)



Use Supabase RPC for complex queries (runs DB-side, saves Worker CPU)



Minimize React island hydration code



Consider switching to Vercel (no CPU limits, but 3x lower request ceiling)

4.5 Verify Deployment





Open https://plant-it.[account].workers.dev in browser



Test auth flow (signup, signin, protected routes)



Check logs for errors: npx wrangler tail

Checklist:





Homepage loads



Signup flow works



Signin flow works



Dashboard redirects correctly



No 500 errors in logs



CPU time measured and acceptable (< 8ms) or upgrade planned

Phase 5: CI/CD Integration

5.1 Update GitHub Actions Workflow

Current .github/workflows/ci.yml only runs lint + build. Add deployment step.

Two workflow options:

Option A: Manual Deployment (Recommended for MVP)

Keep CI as-is (lint + build only). Deploy manually via npx wrangler deploy when ready.





✅ Safer: human approval before production changes



❌ Slower: requires manual step

Option B: Auto-Deploy on Merge to Master

Add deployment step to CI workflow:

name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx astro sync
      - run: npm run lint
      - run: npm run build
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
      
      # New: Auto-deploy on push to master
      - name: Deploy to Cloudflare Workers
        if: github.event_name == 'push' && github.ref == 'refs/heads/master'
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

If choosing Option B, add GitHub Secret:





Generate Cloudflare API Token:





Go to Cloudflare Dashboard → Profile → API Tokens



Click "Create Token"



Use "Edit Cloudflare Workers" template



Scope to your account + "All Zones" (or specific zone)



Copy token (shown once)



Add to GitHub:





Repository → Settings → Secrets and variables → Actions



Click "New repository secret"



Name: CLOUDFLARE_API_TOKEN



Value: paste token

Edge case - CI deployment fails:





"Authentication error": Regenerate API token, ensure "Edit Cloudflare Workers" permission



"Secrets not found": Verify SUPABASE_URL and SUPABASE_KEY are set in GitHub repository secrets



"Build timeout": Increase timeout in workflow (timeout-minutes: 15)

5.2 Configure Branch Previews (Optional, Recommended)

Cloudflare supports automatic preview deployments for branches/PRs. Two approaches:

Approach A: GitHub Integration (Zero Config)





Cloudflare Dashboard → Workers & Pages → plant-it → Settings → Builds & deployments



Connect GitHub repository



Enable "Automatic deployments" for branches

Result: Every branch/PR auto-deploys to [branch].plant-it.[account].workers.dev

Edge case: Preview URLs are public by default. To restrict:





Use Cloudflare Access (free for up to 50 users): Dashboard → Zero Trust → Access → Applications



Add auth rule (e.g., "Allow email domain: @yourdomain.com")

Approach B: Wrangler CLI in GitHub Actions

Add preview deployment to CI workflow:

- name: Deploy Preview
  if: github.event_name == 'pull_request'
  run: npx wrangler deploy --env preview
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

Requires adding [env.preview] section to wrangler.jsonc:

{
  "name": "plant-it",
  // ... existing config ...
  "env": {
    "preview": {
      "name": "plant-it-preview"
    }
  }
}

Recommendation: Start with Approach A (simpler, no config). Only use Approach B if you need custom preview environment variables.

Phase 6: Production Readiness Checks

6.1 Custom Domain Setup (Optional)

Default URL: plant-it.[account].workers.dev. To use custom domain:





Add domain to Cloudflare (Dashboard → Websites → Add site)



Update DNS nameservers to Cloudflare's



Cloudflare Dashboard → Workers & Pages → plant-it → Settings → Domains & Routes



Click "Add Custom Domain"



Enter domain (e.g., plantit.app or app.plantit.com)



Cloudflare auto-generates SSL certificate (1-5 minutes)

Edge case - domain setup fails:





"DNS verification failed": Ensure domain's nameservers point to Cloudflare



"Certificate generation failed": Wait 24 hours for DNS propagation, try again



"Domain already in use": Check if another Worker uses this domain

Update in Astro:
Add site to astro.config.mjs:

export default defineConfig({
  site: "https://plantit.app",  // or your custom domain
  // ... rest of config
});

Rebuild and redeploy: npm run build && npx wrangler deploy

6.2 Monitoring Setup

Included by default:





"observability": { "enabled": true } in wrangler.jsonc enables Workers Analytics



View in Cloudflare Dashboard → Workers & Pages → plant-it → Analytics

Metrics available:





Requests per second



Error rate



CPU time percentiles (p50, p90, p99)



Success/failure breakdown

Alerting (Optional):





Dashboard → Notifications → Destinations → Add destination (email, webhook, PagerDuty)



Dashboard → Notifications → Notifications → Create



Set alert: "Worker error rate > 5% for 5 minutes" → notify destination

Edge case - no metrics showing:





Wait 5-10 minutes after first deployment (metrics delayed)



Verify observability.enabled: true in wrangler.jsonc



Check free tier limits: historical metrics available up to 24 hours (paid: 30 days)

6.3 Error Tracking Integration (Recommended)

Cloudflare logs are ephemeral (24 hours on free tier). For persistent error tracking:

Option A: Sentry (Recommended)





Create Sentry project at https://sentry.io



Install: npm install @sentry/astro



Add to astro.config.mjs:

   import sentry from "@sentry/astro";
   
   export default defineConfig({
     integrations: [
       sentry({
         dsn: "https://[key]@[org].ingest.sentry.io/[project]",
         environment: "production",
       }),
       // ... other integrations
     ],
   });
   






Add SENTRY_DSN to wrangler secrets: npx wrangler secret put SENTRY_DSN

Edge case - Sentry bundle too large:





Sentry client adds ~50KB to bundle. If approaching 1MB Worker limit, use Sentry's SDK lazy loading.

Option B: Axiom





Create Axiom account at https://axiom.co (1GB/month free)



Dashboard → Settings → API Tokens → Create token



Add Axiom integration to Worker (via Wrangler binding or fetch in error handler)

Trade-off: Axiom better for log aggregation, Sentry better for structured error tracking with stack traces.

6.4 Rollback Plan

Cloudflare supports instant rollbacks:

# List deployments
npx wrangler deployments list

# Rollback to previous version
npx wrangler rollback [deployment-id]

How rollback works:





Changes production traffic routing to selected version (instant, global edge propagation ~30s)



Does NOT create a new deployment (just routes to existing one)



Does NOT rollback database migrations (Supabase schema changes are separate)

Critical edge case: If a deployment included Supabase schema changes (new tables, columns), rolling back code will NOT rollback the database. You must manually revert migrations:





Identify migration: ls supabase/migrations/



Create reverse migration: npx supabase migration new rollback_[feature]



Write reverse SQL (e.g., DROP TABLE plants;)



Apply: npx supabase db push (or push via Supabase Studio)

Recommendation: Avoid schema changes in early deployments. If unavoidable, document rollback SQL in the migration file.

6.5 Cost Monitoring (Critical)

Per infrastructure.md pre-mortem, cost surprises are a real risk.

Set billing alerts:





Cloudflare Dashboard → Billing → Notifications



Create alert: "Workers usage > 90% of free tier" → email



Create alert: "R2 usage > $1/month" → email (if using R2 for photos later)

Free tier limits (as of 2026-05-24):





Requests: 100,000/day (3M/month)



CPU time: 10ms per request



Duration: 30 seconds per request



KV writes: 1,000/day

Upgrade triggers:





CPU time consistently > 10ms → Workers Paid ($5/month, 30s CPU limit)



Requests > 3M/month → Workers Paid ($5/month + $0.30/million beyond 10M)



KV writes > 1,000/day → Workers Paid ($5/month, 1M writes included)

Projected MVP cost:





Baseline: $0/month (free tier covers < 50 DAU, no photo uploads)



With photo uploads: $0-2/month (R2: $4.50/million writes, ~30k photos = $0.14/month)



With scale (100+ DAU): $5-7/month (Workers Paid + R2 storage)

Phase 7: Post-Deployment Tasks

7.1 Update Documentation

Files to update:





README.md - Add "Production Deployment" section:

   ## Production Deployment
   
   Deployed to Cloudflare Workers at https://plant-it.[account].workers.dev
   
   To deploy changes:
   

```bash
   npm run build
   npx wrangler deploy
   


   See context/foundation/infrastructure.md for deployment architecture and cost estimates.


2. [AGENTS.md](AGENTS.md) - Add deployment notes:
   

```markdown
   ## Deployment
   
   - Platform: Cloudflare Workers (SSR)
   - Secrets: SUPABASE_URL, SUPABASE_KEY (set via `npx wrangler secret put`)
   - Rollback: `npx wrangler rollback [deployment-id]`
   - Logs: `npx wrangler tail` (real-time) or Dashboard → Workers & Pages → plant-it → Logs (historical, 24h)
   
   **Critical:** CPU time limit on free tier is 10ms. Measure with `npx wrangler tail` after each deployment. If consistently > 8ms, upgrade to Workers Paid ($5/month).
   






Create deployment runbook: docs/deployment.md (or add to context/):

   # Deployment Runbook
   
   ## Pre-deployment checklist
   - [ ] All tests pass locally
   - [ ] Lint checks pass: `npm run lint`
   - [ ] Build succeeds: `npm run build`
   - [ ] New environment variables added to Wrangler secrets
   
   ## Deploy to production
   

```bash
   npm run build
   npx wrangler deploy
   


Post-deployment verification





Homepage loads: https://plant-it.[account].workers.dev



Auth flow works (signup, signin, dashboard)



Check logs for errors: npx wrangler tail (run for 2-3 minutes)



CPU time acceptable: look for cpuTime in logs, verify < 10ms

Rollback procedure

   npx wrangler deployments list
   npx wrangler rollback [previous-deployment-id]
   


   If deployment included database migrations, manually revert in Supabase Studio.

Emergency contacts





Cloudflare Status: https://www.cloudflarestatus.com



Supabase Status: https://status.supabase.com


### 7.2 Security Hardening (Recommended)

**Immediate actions:**

1. **Review Supabase RLS policies**
   - Ensure all tables have Row Level Security enabled
   - Test policies: try accessing another user's data
   - Document policies in `docs/security.md`

2. **Rate limiting (Optional for MVP, Critical for scale)**
   Cloudflare Workers Free tier has no built-in rate limiting. If traffic spikes:
   - Use Cloudflare Rate Limiting Rules (paid: $5/month for 10k rules)
   - Or implement KV-based rate limiting in middleware (track requests per IP in KV)

3. **Content Security Policy**
   Add CSP headers in `src/middleware.ts`:
   

```ts
   export async function onRequest(context, next) {
     const response = await next();
     response.headers.set(
       "Content-Security-Policy",
       "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
     );
     return response;
   }
   






Environment variable audit





Verify no secrets in git history: git log -p --all -S "SUPABASE_KEY"



Rotate Supabase anon key if leaked (Supabase Dashboard → Settings → API → Reset)

7.3 Capture Deployment Artifacts

Create deployment log file: context/changes/deployments/2026-05-24-first-deployment.md

# First Production Deployment - 2026-05-24

## Deployment Details
- **Date:** 2026-05-24
- **Deployed by:** [Your Name]
- **Worker URL:** https://plant-it.[account].workers.dev
- **Deployment ID:** [from wrangler output]
- **Git commit:** [git rev-parse HEAD]

## Configuration
- Astro: 6.3.1
- @astrojs/cloudflare: 13.5.0
- Wrangler: 4.90.0
- Node.js: 22.14.0

## Secrets Configured
- SUPABASE_URL: ✅
- SUPABASE_KEY: ✅

## Verification Results
- [ ] Homepage loads: https://plant-it.[account].workers.dev
- [ ] Auth flow: signup, signin, dashboard
- [ ] CPU time measured: [X]ms (avg from wrangler tail)
- [ ] Error rate: [Y]% (from Workers Analytics)

## Issues / Notes
[Any issues encountered, edge cases hit, or notes for future deployments]

## Rollback Command
```bash
npx wrangler rollback [deployment-id]


## Risk Mitigation Summary

Based on infrastructure.md Risk Register, key mitigations in this plan:

| Risk | Mitigation in Plan |
|------|-------------------|
| **10ms CPU limit exceeded** | Phase 4.4: Immediate CPU time measurement after first deploy. Decision rule to upgrade if > 8ms. |
| **Astro 6 Pages removal** | Phase 1.1: wrangler.jsonc correctly targets Workers (`main: ./dist/_worker.js/index.js`), not Pages. |
| **Supabase pooler required** | Phase 2.2: Note that @supabase/supabase-js handles pooler automatically. Only relevant if switching to direct Postgres later. |
| **No historical logs via CLI** | Phase 6.2: Document that historical logs (> 24h) require Dashboard or external log aggregation (Sentry/Axiom). |
| **Secrets exposure** | Phase 4.2: Secrets via `wrangler secret put` (encrypted), not wrangler.jsonc. Phase 7.2: Audit git history. |
| **Deployment breaks DB** | Phase 6.4: Document that rollback doesn't revert Supabase migrations. Manual SQL rollback required. |
| **Cost surprises** | Phase 6.5: Set billing alerts at 90% free tier. Document upgrade triggers and projected MVP costs. |

## Out of Scope (For Future Iterations)

The following are NOT included in this deployment plan:

- **Database migrations:** No Supabase tables exist yet (using auth.users only per README)
- **R2 photo storage:** PRD includes photo uploads (max 5/action) but implementation is post-MVP
- **WebSocket support:** PRD has no real-time features in MVP scope
- **Cloudflare KV/D1 integration:** Using external Supabase for all data
- **Multi-region optimization:** Workers deploy globally by default, no additional config needed
- **Load testing:** MVP scope (10k-100k users/month per PRD) fits comfortably in free tier
- **Disaster recovery:** Formal HA/DR planning is post-MVP
- **Performance optimization:** Address only if CPU time > 10ms in Phase 4.4

## Implementation Checklist

### Phase 1: Configuration ✓
- [ ] Update wrangler.jsonc (name, main, compatibility_date)
- [ ] Create .dev.vars.example

### Phase 2: Supabase ✓
- [ ] Decide: Local (Docker) or Cloud Supabase
- [ ] If Cloud: Create project, get credentials
- [ ] Create .dev.vars with credentials
- [ ] Configure email confirmation (ON for prod, optional OFF for testing)

### Phase 3: Local Verification ✓
- [ ] npm install
- [ ] npm run dev (verify workerd runtime)
- [ ] Test auth flow: signup, signin, dashboard

### Phase 4: Deployment ✓
- [ ] npx wrangler login
- [ ] npx wrangler secret put SUPABASE_URL
- [ ] npx wrangler secret put SUPABASE_KEY
- [ ] npm run build
- [ ] npx wrangler deploy
- [ ] Measure CPU time (npx wrangler tail)
- [ ] Decision: upgrade to Workers Paid if needed
- [ ] Verify deployment (homepage, auth, no errors)

### Phase 5: CI/CD ✓
- [ ] Decide: Manual deploy (Option A) or Auto-deploy (Option B)
- [ ] If Option B: Add CLOUDFLARE_API_TOKEN to GitHub secrets
- [ ] If Option B: Update .github/workflows/ci.yml
- [ ] Optional: Configure branch previews (Approach A or B)

### Phase 6: Production Readiness ✓
- [ ] Optional: Set up custom domain
- [ ] Verify Workers Analytics enabled
- [ ] Optional: Configure alerts (error rate, usage)
- [ ] Optional: Integrate Sentry or Axiom
- [ ] Document rollback plan
- [ ] Set billing alerts (90% free tier, $1/month R2)

### Phase 7: Post-Deployment ✓
- [ ] Update README.md (Production Deployment section)
- [ ] Update AGENTS.md (deployment notes)
- [ ] Create docs/deployment.md runbook
- [ ] Security hardening (RLS review, CSP, rate limiting)
- [ ] Create deployment log in context/changes/deployments/
- [ ] Audit environment variables (no secrets in git)

---

**Estimated time:** 2-3 hours (includes Cloud Supabase setup, first deployment, verification, docs)

**Prerequisites:**
- Cloudflare account (free tier sufficient for MVP)
- Cloud Supabase project (if not using local Docker)
- GitHub repository with Actions enabled (for CI/CD)

**Next steps after deployment:**
1. Implement core features per PRD (plants, actions, photos, weather)
2. Set up Supabase tables with RLS policies
3. Monitor CPU time and upgrade to Workers Paid if needed
4. Configure custom domain when ready for users

