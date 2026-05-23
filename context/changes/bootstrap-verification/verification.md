---
bootstrapped_at: 2026-05-23T17:13:30Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: plant-it
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
---
starter_id: 10x-astro-starter
package_manager: npm
project_name: plant-it
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---
```

### Why this stack

Plant It is a solo after-hours project (3-week MVP) requiring authentication (user accounts), PostgreSQL database (plants, actions, user data), file storage (photo uploads, max 5 per action), and weather API integration. The 10x Astro Starter (Astro + React + TypeScript + Supabase + Cloudflare) is the recommended default for `(web-app, js)` and ships with auth, database, and storage out of the box. All four agent-friendly gates pass (typed, convention-based, popular in training data, well-documented), making it ideal for AI-assisted development. Cloudflare Pages provides edge deployment with a generous free tier; GitHub Actions handles CI/CD with auto-deploy-on-merge for fast iteration. Bootstrapper confidence is first-class, so scaffolding will be smooth with minimal manual intervention.

## Pre-scaffold verification

| Signal      | Value                                                      | Severity | Notes                    |
| ----------- | ---------------------------------------------------------- | -------- | ------------------------ |
| GitHub repo | przeprogramowani/10x-astro-starter last pushed 2026-03-12 | fresh    | from card.docs_url       |
| npm package | not run                                                    | n/a      | git clone starter (no npm package) |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`

**Strategy**: git-clone

**Exit code**: 0

**Files moved**: 20

**Conflicts (.scaffold siblings)**: none

**.gitignore handling**: moved silently

**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: `npm audit --json`

**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW

**Direct vs transitive**: 0/2/0/0 direct of total 0/1/9/0

### CRITICAL findings

None.

### HIGH findings

1. **devalue** (5.6.3 - 5.8.0)
   - Advisory: GHSA-77vg-94rm-hx3p
   - Svelte devalue: DoS via sparse array deserialization
   - CWE-770: Allocation of Resources Without Limits or Throttling
   - CVSS: 7.5 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H)
   - Fix available: true
   - Via: transitive dependency

### MODERATE findings

1. **@astrojs/check** (>=0.9.3)
   - Severity: moderate
   - Via: @astrojs/language-server (transitive: volar-service-yaml)
   - Fix available: downgrade to 0.9.2 (major version change)
   - Direct dependency

2. **@astrojs/language-server** (>=2.14.0)
   - Severity: moderate
   - Via: volar-service-yaml (transitive)
   - Effects: @astrojs/check
   - Fix available: via @astrojs/check downgrade

3. **@cloudflare/vite-plugin** (<=0.0.0-fff677e35 || 0.0.7 - 1.37.2)
   - Severity: moderate
   - Via: miniflare, wrangler, ws (transitive)
   - Fix available: true

4. **miniflare** (<=0.0.0-fff677e35 || 3.20250204.0 - 4.20260518.0)
   - Severity: moderate
   - Via: ws (transitive)
   - Effects: @cloudflare/vite-plugin, wrangler
   - Fix available: true

5. **volar-service-yaml** (<=0.0.70)
   - Severity: moderate
   - Via: yaml-language-server (transitive)
   - Effects: @astrojs/language-server
   - Fix available: via @astrojs/check downgrade

6. **wrangler** (<=0.0.0-kickoff-demo || 3.108.0 - 4.93.0)
   - Severity: moderate
   - Via: miniflare (transitive)
   - Effects: @cloudflare/vite-plugin
   - Fix available: true
   - Direct dependency

7. **ws** (8.0.0 - 8.20.0)
   - Advisory: GHSA-58qx-3vcg-4xpx
   - ws: Uninitialized memory disclosure
   - CWE-908: Use of Uninitialized Resource
   - CVSS: 4.4 (CVSS:3.1/AV:N/AC:H/PR:H/UI:N/S:U/C:H/I:N/A:N)
   - Effects: @cloudflare/vite-plugin, miniflare
   - Fix available: true
   - Via: transitive dependency

8. **yaml** (2.0.0 - 2.8.2)
   - Advisory: GHSA-48c2-rrv3-qjmp
   - yaml is vulnerable to Stack Overflow via deeply nested YAML collections
   - CWE-674: Uncontrolled Recursion
   - CVSS: 4.3 (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L)
   - Effects: yaml-language-server
   - Fix available: via @astrojs/check downgrade
   - Via: transitive dependency

9. **yaml-language-server** (1.11.1-08d5f7b.0 - 1.21.1-f1f5a94.0 || 1.22.1-0ae5603.0 - 1.22.1-fc5f874.0)
   - Severity: moderate
   - Via: yaml (transitive)
   - Effects: volar-service-yaml
   - Fix available: via @astrojs/check downgrade

### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                    | Value                     |
| ----------------------- | ------------------------- |
| bootstrapper_confidence | first-class               |
| quality_override        | false                     |
| path_taken              | standard                  |
| self_check_answers      | null                      |
| team_size               | solo                      |
| deployment_target       | cloudflare-pages          |
| ci_provider             | github-actions            |
| ci_default_flow         | auto-deploy-on-merge      |
| has_auth                | true                      |
| has_payments            | false                     |
| has_realtime            | false                     |
| has_ai                  | false                     |
| has_background_jobs     | false                     |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
