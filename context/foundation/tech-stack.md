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

## Why this stack

Plant It is a solo after-hours project (3-week MVP) requiring authentication (user accounts), PostgreSQL database (plants, actions, user data), file storage (photo uploads, max 5 per action), and weather API integration. The 10x Astro Starter (Astro + React + TypeScript + Supabase + Cloudflare) is the recommended default for `(web-app, js)` and ships with auth, database, and storage out of the box. All four agent-friendly gates pass (typed, convention-based, popular in training data, well-documented), making it ideal for AI-assisted development. Cloudflare Pages provides edge deployment with a generous free tier; GitHub Actions handles CI/CD with auto-deploy-on-merge for fast iteration. Bootstrapper confidence is first-class, so scaffolding will be smooth with minimal manual intervention.
