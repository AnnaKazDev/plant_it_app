# Cloudflare Workers Integration & Deployment Plan

## Quick Start Path

**For first deployment (minimum viable path):**

1. ✅ **Phase 0** - Create accounts (20-30 min)
2. ✅ **Phase 1** - Update config files (5 min)
3. ✅ **Phase 2** - Configure Supabase connection (10 min)
4. ✅ **Phase 3** - Test locally (15 min)
5. ✅ **Phase 4** - Deploy to Cloudflare (20 min)
6. ⚠️ **Phase 5** - CI/CD (optional, 15 min if Option B)
7. ⚠️ **Phase 6** - Production hardening (optional, 30 min)
8. ⚠️ **Phase 7** - Documentation (optional, 20 min)

**Total time for MVP deployment:** 70-90 minutes (Phases 0-4 only)

**Phase priority:**

- **MUST HAVE (for first deploy):** Phase 0, 1, 2, 3, 4
- **RECOMMENDED (for production):** Phase 5 (manual deploy at minimum), Phase 6 (monitoring + alerts)
- **OPTIONAL (can defer):** Phase 5 auto-deploy, Phase 6 custom domain/Sentry, Phase 7

---

## Context

Based on context/foundation/infrastructure.md, we're deploying Plant It to Cloudflare Workers with:

Astro 6 SSR with React 19 islands

Supabase for auth and database (external)

@astrojs/cloudflare v13.5.0 adapter (already installed)

Wrangler 4.90.0 (already installed)

Critical trade-offs identified:

10ms CPU limit on free tier likely insufficient for SSR with Supabase queries

Plan to upgrade to Workers Paid ($5/month) if realistic page renders exceed 8ms

Must use Supabase connection pooler (port 6543) to avoid connection setup overhead

## Phase 0: Account Setup (For First-Time Users)

**Prerequisites:** You need accounts on both Cloudflare and Supabase. If you already have these accounts, skip to Phase 1.

### 0.1 Create Cloudflare Account

**Step-by-step registration:**

1. **Navigate to Cloudflare signup**
   - Go to https://dash.cloudflare.com/sign-up
   - You'll see "Create your Cloudflare account" page

2. **Enter account details**
   - Email address: Use a valid email you can access
   - Password: Strong password (min 8 characters, mix of letters, numbers, symbols)
   - Click "Create Account"

3. **Verify email**
   - Check your inbox for "Verify your Cloudflare account" email
   - Click the verification link
   - You'll be redirected to Cloudflare dashboard

4. **Initial dashboard setup**
   - Skip "Add a site" prompt (we're deploying Workers, not a website)
   - Click "Workers & Pages" in left sidebar
   - You'll see "Get started with Workers" page
   - **Important:** You don't need to create a Worker yet - we'll do this via CLI

5. **Verify free tier**
   - Click your profile icon (top right) → Billing
   - Confirm you're on "Free" plan
   - Free tier includes: 100,000 requests/day, 10ms CPU time, 128MB memory

**Edge cases:**

- **"Email already registered"**: Use password reset or sign in with existing account
- **Verification email not received**: Check spam folder, wait 5 minutes, or request resend
- **Corporate email blocked**: Some corporate domains block Cloudflare emails - use personal email

### 0.2 Create Supabase Account

**Step-by-step registration:**

1. **Navigate to Supabase signup**
   - Go to https://supabase.com/dashboard
   - Click "Start your project" or "Sign Up"

2. **Choose authentication method**
   - **Option A (Recommended):** Sign up with GitHub
     - Click "Continue with GitHub"
     - Authorize Supabase OAuth app
     - Faster, no email verification needed
   - **Option B:** Sign up with email
     - Enter email and password
     - Click "Sign Up"
     - Verify email (check inbox for "Confirm your mail" from Supabase)

3. **Create organization**
   - After login, you'll see "Create a new organization"
   - Organization name: "Personal" or your name (e.g., "Anna's Projects")
   - Plan: Select "Free" (includes 500MB database, 1GB file storage, 50K monthly active users)
   - Click "Create organization"

4. **Review free tier limits**
   - Database: 500MB storage, unlimited API requests
   - Auth: 50,000 monthly active users
   - Storage: 1GB files
   - Realtime: 200 concurrent connections
   - Edge Functions: 500K invocations/month

**Edge cases:**

- **GitHub OAuth fails**: Use email signup instead, or check if GitHub is accessible
- **"Organization name taken"**: Add a number or unique identifier (e.g., "plant-it-dev-2026")
- **No email verification received**: Check spam, wait 10 minutes, or use GitHub OAuth

### 0.3 Create Supabase Project

**Step-by-step project setup:**

1. **Start new project**
   - In Supabase dashboard, click "New project"
   - You'll see "Create a new project" form

2. **Configure project settings**
   - **Name:** `plant-it` (lowercase, hyphens allowed)
   - **Database Password:** Generate strong password
     - Click "Generate a password" button (recommended)
     - **CRITICAL:** Copy password immediately and save in password manager
     - You'll need this if you ever need direct database access
   - **Region:** Choose closest to your target users
     - For Poland/Europe: **"Europe (Frankfurt)" (eu-central-1)** or **"Europe (London)" (eu-west-2)**
     - For USA: "East US (N. Virginia)" or "West US (Oregon)"
     - Note: Cannot change region after creation
   - **Pricing Plan:** Confirm "Free" is selected

3. **Create project**
   - Click "Create new project"
   - **Wait 2-5 minutes** for provisioning
   - You'll see "Setting up project..." with progress indicator
   - When ready, dashboard shows "Project is ready"

4. **Locate project credentials**

   After project is ready:
   - **Navigate to API settings:**
     - Look at **left sidebar** of Supabase dashboard
     - Click the **⚙️ gear icon** (labeled "Project Settings")
     - In the Project Settings page, look at **left submenu**
     - Click **"API"** section
     - Alternatively, direct link: `https://supabase.com/dashboard/project/[project-ref]/settings/api`
   - You'll need these two values:

   **Project URL:**

   ```
   https://[project-ref].supabase.co
   ```

   Example: `https://xyzabcdefgh.supabase.co`
   - Location in UI: Under "Configuration" → "Project URL"

   **anon/public key:**

   ```
   eyJhbGc...very-long-jwt-token...
   ```

   - Location in UI: Under "Project API keys" → "anon" → "public" (click eye icon to reveal)
   - **Copy both values** - you'll need them in Phase 2
   - **Security note:** The `anon` key is safe to expose client-side (it's scoped by Row Level Security policies)
   - **DO NOT share:** The `service_role` key (gives full database access, bypasses RLS)

5. **Verify project health**
   - In dashboard, click "Table Editor" (database icon in sidebar)
   - You should see default `auth.users` table (may be empty)
   - Click "SQL Editor" - you should see SQL query interface
   - Run test query: `SELECT current_database();` → should return `postgres`

**Edge cases:**

- **Provisioning stuck > 10 minutes**: Refresh page, check status.supabase.com for incidents
- **"Project name already taken"**: Add suffix like `plant-it-prod` or `plant-it-2026`
- **Wrong region selected**: You must delete project and recreate (region cannot be changed)
- **Lost database password**: Can reset via Project Settings → Database → Reset database password (requires ~5 min downtime)
- **"Organization has reached free tier limit"**: Free tier allows 2 active projects - pause/delete unused projects

### 0.4 Prepare Local Development Environment

**Verify prerequisites:**

1. **Node.js 22.x**

   ```bash
   node -v
   # Expected: v22.14.0 or higher
   ```

   **If not installed or wrong version:**
   - Download from https://nodejs.org (LTS version)
   - Or use nvm (Node Version Manager):
     ```bash
     nvm install 22
     nvm use 22
     ```
   - Verify: `node -v` shows v22.x.x

2. **npm (comes with Node.js)**

   ```bash
   npm -v
   # Expected: 10.x or higher
   ```

3. **Git**

   ```bash
   git --version
   # Expected: git version 2.x or higher
   ```

   **If not installed:**
   - macOS: `xcode-select --install` or download from https://git-scm.com
   - Windows: https://git-scm.com/download/win
   - Linux: `sudo apt-get install git` (Ubuntu/Debian) or `sudo yum install git` (CentOS/RHEL)

4. **Code editor (optional but recommended)**
   - VS Code: https://code.visualstudio.com
   - Cursor: https://cursor.sh (VS Code fork with AI features)

**Verify project repository:**

1. **Check repository location**

   ```bash
   pwd
   # Should show: /Users/akazmierczak/Documents/10xdevs3/plant_it_app
   ```

2. **Verify git repository**

   ```bash
   git status
   # Should NOT show: "fatal: not a git repository"
   # Should show current branch and file status
   ```

3. **Check dependencies installed**

   ```bash
   ls node_modules/
   # Should list installed packages (astro, react, etc.)
   # If empty or doesn't exist: run `npm install`
   ```

4. **Verify package.json scripts**
   ```bash
   npm run
   # Should list available scripts: dev, build, preview, lint, etc.
   ```

**Checklist before Phase 1:**

- [ ] Cloudflare account created and email verified
- [ ] Supabase account created (GitHub or email)
- [ ] Supabase organization created (on Free plan)
- [ ] Supabase project `plant-it` provisioned and ready
- [ ] Project URL and anon key copied and saved securely
- [ ] Node.js 22.x installed and verified
- [ ] npm 10.x+ available
- [ ] Git installed and working
- [ ] Project repository cloned/located at correct path
- [ ] `npm install` completed (node_modules/ exists)

**Time estimate for Phase 0:** 20-30 minutes (including account verification waits)

---

## Phase 1: Pre-Deployment Configuration

### 1.1 Update Wrangler Configuration

**Current state:** The project already has `wrangler.jsonc` (created by the 10x Astro Starter).

**Action required:** Update specific fields to match the deployment requirements.

**How to update:**

1. **Open** `wrangler.jsonc` in your editor
2. **Verify current content** - you should see something like:

   ```jsonc
   {
     "$schema": "node_modules/wrangler/config-schema.json",
     "name": "10x-astro-starter",
     "main": "@astrojs/cloudflare/entrypoints/server",
     // ... other fields
   }
   ```

3. **Update these specific fields:**

   **Change `name`:** from `"10x-astro-starter"` to `"plant-it"`

   ```jsonc
   "name": "plant-it",
   ```

   **Change `main`:** from `"@astrojs/cloudflare/entrypoints/server"` to `"./dist/_worker.js/index.js"`

   ```jsonc
   "main": "./dist/_worker.js/index.js",
   ```

   **Why:** Astro 6 changed the worker output path. The new path points to the actual built worker file.

   **Update `compatibility_date`:** to today (2026-05-24)

   ```jsonc
   "compatibility_date": "2026-05-24",
   ```

   **Why:** Ensures you get the latest Cloudflare Workers runtime features and fixes.

4. **Complete updated file should look like:**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "plant-it",
  "main": "./dist/_worker.js/index.js",
  "compatibility_date": "2026-05-24",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "binding": "ASSETS",
    "directory": "./dist",
    "not_found_handling": "404-page",
  },
  "observability": {
    "enabled": true,
  },
}
```

**Don't change:**

- `$schema` - keep as-is
- `compatibility_flags` - `nodejs_compat` is required
- `assets` section - configured correctly
- `observability` - already enabled

**Edge case:** If using Cloudflare bindings (KV, R2, D1) later, add them here and run `npx wrangler types` to generate TypeScript definitions.

---

### 1.2 Verify Astro Configuration

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

astro v6.3.1 started in [N]ms
┃ Local http://localhost:4321/
┃ Runtime Cloudflare (workerd)

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

### 4.3 First Deployment

```bash
npm run build
npx wrangler deploy
```

**Expected output:**

```
Total Upload: [N] KiB / gzip: [N] KiB
Deployed plant-it triggers (1.23 sec)
  https://plant-it.[account-subdomain].workers.dev
```

**Understanding your Worker URL:**

The URL format is `https://plant-it.[account-subdomain].workers.dev` where:

- `plant-it` = your worker name (from `wrangler.jsonc`)
- `[account-subdomain]` = your Cloudflare account's unique subdomain (assigned automatically)

**How to find your account subdomain:**

1. After first deploy, it's shown in the output above
2. Or visit Cloudflare Dashboard → Workers & Pages
3. Or check the URL bar: `https://dash.cloudflare.com/[account-id]/workers-and-pages`
4. The `[account-subdomain]` is typically a shortened version of your account ID

**Example:** If output shows `https://plant-it.abc123.workers.dev`, your account subdomain is `abc123`.

**Save this URL** - you'll need it for testing in Phase 4.4 and 4.5.

---

**Edge case - build fails:**

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
"cpuTime": 12 // <-- THIS NUMBER IN MILLISECONDS
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
steps: - uses: actions/checkout@v4 - uses: actions/setup-node@v4
with:
node-version: 22
cache: npm - run: npm ci - run: npx astro sync - run: npm run lint - run: npm run build
env:
SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}

      # New: Auto-deploy on push to master
      - name: Deploy to Cloudflare Workers
        if: github.event_name == 'push' && github.ref == 'refs/heads/master'
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

**If choosing Option B, add GitHub Secret:**

1. **Generate Cloudflare API Token:**
   - Go to Cloudflare Dashboard → Profile → API Tokens
   - **Direct link:** `https://dash.cloudflare.com/profile/api-tokens`
   - Click "Create Token" button (blue, top right)
   - Scroll to "Custom token" section → Click "Get started"
   - Or use **"Edit Cloudflare Workers" template** (faster):
     - Find in "API token templates" section
     - Click "Use template" next to "Edit Cloudflare Workers"

   **Token configuration:**
   - **Token name:** "GitHub Actions - Plant It" (or any descriptive name)
   - **Permissions:**
     - Account → Workers Scripts → Edit
     - Account → Account Settings → Read
   - **Account Resources:** Include → [Your account name]
   - **Zone Resources:** Not needed for Workers
   - **TTL:** Default (no expiration) or set custom expiration
   - Click "Continue to summary" → "Create Token"
   - **CRITICAL:** Copy token immediately (shown only once)
   - Example token: `1234567890abcdefghijklmnopqrstuvwxyz`

2. **Add to GitHub:**
   - Open your repository on GitHub
   - Go to: Repository → Settings → Secrets and variables → Actions
   - **Direct link pattern:** `https://github.com/<username>/<repo>/settings/secrets/actions`
   - Example: `https://github.com/akazmierczak/plant-it/settings/secrets/actions`

   **Add three secrets:**

   a. **CLOUDFLARE_API_TOKEN**
   - Click "New repository secret"
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: paste token from step 1
   - Click "Add secret"

   b. **SUPABASE_URL** (if not already added)
   - Click "New repository secret"
   - Name: `SUPABASE_URL`
   - Value: `https://[project-ref].supabase.co`
   - Click "Add secret"

   c. **SUPABASE_KEY** (if not already added)
   - Click "New repository secret"
   - Name: `SUPABASE_KEY`
   - Value: your anon/public key from Phase 0.3
   - Click "Add secret"

**Edge case - CI deployment fails:**

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

## Phase 6: Production Readiness Checks

### 6.1 Custom Domain Setup (Optional)

**Default URL:** `plant-it.[account-subdomain].workers.dev`

**To use custom domain (e.g., `plantit.app` or `app.plantit.com`):**

**Prerequisites:**

- You must own a domain (purchase from registrar like Namecheap, GoDaddy, Cloudflare Registrar, etc.)
- Domain costs: $10-15/year typically
- **Cloudflare does NOT charge for:**
  - SSL certificate (free via Let's Encrypt)
  - DNS hosting (free)
  - Domain transfer to Cloudflare (free)
  - Custom domain routing to Workers (free)

**Steps:**

1. **Add domain to Cloudflare**
   - Dashboard → Websites → "Add site" button
   - Direct link: `https://dash.cloudflare.com/`
   - Enter your domain (e.g., `plantit.app`)
   - Select "Free" plan
   - Click "Continue"

2. **Update DNS nameservers** (at your domain registrar)
   - Cloudflare will show 2 nameservers (e.g., `ns1.cloudflare.com`, `ns2.cloudflare.com`)
   - Log in to your domain registrar (where you bought the domain)
   - Find "Nameservers" or "DNS Settings"
   - Replace registrar's nameservers with Cloudflare's nameservers
   - **Wait 24-48 hours** for DNS propagation (usually takes 1-4 hours)

3. **Connect domain to Worker**
   - Cloudflare Dashboard → Workers & Pages → plant-it
   - Go to "Settings" tab → "Domains & Routes" section
   - Click "Add Custom Domain" button
   - Enter domain:
     - Root domain: `plantit.app`
     - Or subdomain: `app.plantit.com`
   - Click "Add Domain"

4. **SSL certificate generation**
   - Cloudflare auto-generates SSL certificate (1-5 minutes)
   - Status shows "Active" when ready
   - Your Worker is now accessible at `https://plantit.app` (or subdomain)

5. **Update Astro configuration**

   Add `site` to `astro.config.mjs`:

   ```js
   export default defineConfig({
     site: "https://plantit.app", // or your custom domain
     // ... rest of config
   });
   ```

   **Why:** Astro uses this for sitemap generation and canonical URLs.

6. **Rebuild and redeploy**
   ```bash
   npm run build
   npx wrangler deploy
   ```

**Edge case - domain setup fails:**

"DNS verification failed": Ensure domain's nameservers point to Cloudflare

"Certificate generation failed": Wait 24 hours for DNS propagation, try again

"Domain already in use": Check if another Worker uses this domain

Update in Astro:
Add site to astro.config.mjs:

export default defineConfig({
site: "https://plantit.app", // or your custom domain
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

Create reverse migration: npx supabase migration new rollback\_[feature]

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

````bash
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

---

## Troubleshooting Guide

### Common Issues by Phase

#### Phase 0: Account Setup

**Issue:** Supabase project stuck on "Setting up project..." for > 10 minutes
- **Cause:** Rare provisioning delay or region overload
- **Fix:**
  1. Check https://status.supabase.com for incidents
  2. Refresh browser page
  3. If still stuck after 15 min, delete project and recreate
  4. Try different region (e.g., switch from Frankfurt to London)

**Issue:** Can't find Project URL or anon key in Supabase dashboard
- **Cause:** UI navigation confusion
- **Fix:**
  1. Ensure project finished provisioning (status shows "Active")
  2. Click ⚙️ gear icon in left sidebar (not top menu)
  3. Select "Project Settings" (not "Organization Settings")
  4. In left submenu, click "API"
  5. Scroll down to "Project API keys" section

#### Phase 1-2: Configuration

**Issue:** `wrangler.jsonc` syntax error after editing
- **Cause:** Invalid JSON (missing comma, quote, bracket)
- **Fix:**
  1. Run: `npx jsonlint wrangler.jsonc`
  2. Check for common mistakes:
     - Missing comma after `"compatibility_date": "2026-05-24"` line
     - Extra comma after last item in object
     - Comments not using `//` format (JSONC requires `//` not `/* */`)
  3. Compare with working example in Phase 1.1

**Issue:** `.dev.vars` not recognized by `npm run dev`
- **Cause:** Wrong file location or name
- **Fix:**
  1. File must be in project root (same directory as `package.json`)
  2. File must be named exactly `.dev.vars` (not `.env`, not `dev.vars`)
  3. No file extension (not `.dev.vars.txt`)
  4. Check: `ls -la | grep dev.vars` should show `.dev.vars`

#### Phase 3: Local Development

**Issue:** `npm run dev` shows "SUPABASE_URL is not defined"
- **Cause:** `.dev.vars` file missing, empty, or has wrong format
- **Fix:**
  1. Verify `.dev.vars` exists: `cat .dev.vars`
  2. Check format (no quotes, no `export`, plain `KEY=value`):
     ```bash
     SUPABASE_URL=https://xyzabc.supabase.co
     SUPABASE_KEY=eyJhbGc...
     ```
  3. No spaces around `=`
  4. No trailing whitespace
  5. Restart dev server after fixing

**Issue:** Port 4321 already in use
- **Cause:** Previous dev server still running
- **Fix:**
  1. Find process: `lsof -i :4321`
  2. Kill process: `kill -9 [PID]`
  3. Or use different port: `npm run dev -- --port 3000`

**Issue:** Signup/signin forms don't work locally
- **Cause:** Supabase project not configured or wrong credentials
- **Fix:**
  1. Verify credentials in `.dev.vars` match Supabase dashboard
  2. Check Supabase dashboard → Authentication → Users (should see "0 users" or your test accounts)
  3. Test connection: `curl -I https://[project-ref].supabase.co` should return 200
  4. If 404: wrong Project URL
  5. Check browser console for errors (F12)

#### Phase 4: Deployment

**Issue:** `npx wrangler login` fails with "Could not open browser"
- **Cause:** Headless environment or no browser available
- **Fix:** `npx wrangler login --no-browser` → follow CLI instructions (open URL manually)

**Issue:** `npx wrangler deploy` fails with "Authentication error"
- **Cause:** Not logged in or token expired
- **Fix:**
  1. Run: `npx wrangler whoami` (should show your email)
  2. If not logged in: `npx wrangler login`
  3. If still fails: `npx wrangler logout` then `npx wrangler login` again

**Issue:** Build succeeds but deploy fails with "Worker exceeded size limit"
- **Cause:** Bundle > 1MB (Worker limit on free tier)
- **Fix:**
  1. Check size: `ls -lh dist/_worker.js/index.js`
  2. Enable code splitting in `astro.config.mjs`
  3. Remove unused dependencies: `npm prune`
  4. Analyze bundle: `npx astro build --analyze`

**Issue:** Deploy succeeds but Worker returns 500 errors
- **Cause:** Runtime error in Worker code
- **Fix:**
  1. Check logs: `npx wrangler tail`
  2. Look for error stack trace
  3. Common causes:
     - Missing environment variables (SUPABASE_URL, SUPABASE_KEY)
     - Incompatible Node.js APIs (Workers use V8, not full Node)
     - Import errors (dynamic imports may fail)

**Issue:** Can't add secrets with `npx wrangler secret put`
- **Cause:** Worker doesn't exist yet (must deploy first)
- **Fix:**
  1. Deploy once: `npm run build && npx wrangler deploy`
  2. Then add secrets: `npx wrangler secret put SUPABASE_URL`
  3. Deploy again to pick up secrets: `npx wrangler deploy`

#### Phase 5: CI/CD

**Issue:** GitHub Actions workflow fails with "CLOUDFLARE_API_TOKEN not found"
- **Cause:** Secret not set or wrong name
- **Fix:**
  1. Go to: `https://github.com/<username>/<repo>/settings/secrets/actions`
  2. Verify "CLOUDFLARE_API_TOKEN" exists (exact name, all caps, underscores)
  3. If missing, add it (see Phase 5.1)
  4. If exists, regenerate token in Cloudflare dashboard and update secret

**Issue:** CI build fails with "Cannot find module '@astrojs/cloudflare'"
- **Cause:** `npm ci` didn't install dependencies correctly
- **Fix:**
  1. Check `package-lock.json` is committed to git
  2. Delete `.github/workflows/ci.yml` cache
  3. Re-run workflow

#### General Debugging Commands

**Check Cloudflare authentication:**
```bash
npx wrangler whoami
# Should show: "You are logged in as: your-email@example.com"
````

**List deployed Workers:**

```bash
npx wrangler deployments list
```

**View live Worker logs:**

```bash
npx wrangler tail
# Keep running, open Worker URL in browser, watch logs
```

**Test Supabase connection:**

```bash
curl -I https://[project-ref].supabase.co
# Should return: HTTP/2 200
```

**Verify environment variables loaded:**

```bash
# In dev mode, check console output when starting server
npm run dev
# Look for: "Environment variables loaded: SUPABASE_URL, SUPABASE_KEY"
```

**Check Worker bundle size:**

```bash
npm run build
ls -lh dist/_worker.js/index.js
# Should be < 1MB (1,000,000 bytes)
```

---

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

### Phase 0: Account Setup ✓

- [ ] Create Cloudflare account and verify email
- [ ] Create Supabase account (GitHub OAuth or email)
- [ ] Create Supabase organization (Free plan)
- [ ] Create Supabase project `plant-it` (Europe region recommended)
- [ ] Copy Project URL and anon key
- [ ] Verify Node.js 22.x, npm, git installed
- [ ] Confirm project repository ready

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

---

## Document Revision History

**v2.0 - 2026-05-24:**

- ✅ Added "Quick Start Path" section with phase priorities (MUST/RECOMMENDED/OPTIONAL)
- ✅ Added Phase 0: Account Setup with step-by-step registration for Cloudflare & Supabase
- ✅ Enhanced Phase 1.1 with clear instructions on updating vs replacing `wrangler.jsonc`
- ✅ Added exact UI locations for finding Supabase credentials (left sidebar → gear icon → API)
- ✅ Added explanation of Cloudflare account subdomain in Worker URLs
- ✅ Added direct links for GitHub secrets and Cloudflare API tokens
- ✅ Enhanced custom domain section with costs breakdown (domain purchase vs free SSL)
- ✅ Added comprehensive Troubleshooting Guide covering all phases
- ✅ Fixed all git-scm.com links (added https://)
- ✅ Added debugging commands reference section

**v1.0 - Initial version:**

- Base deployment plan with 7 phases (configuration through documentation)
