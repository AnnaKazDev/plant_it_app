# 10x Astro Starter

![](./public/template.png)

A modern, opinionated starter template for building fast, accessible web applications.

## Tech Stack

- [Astro](https://astro.build/) v6 - Modern web framework with server-first rendering
- [React](https://react.dev/) v19 - UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v5 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Authentication and backend-as-a-service
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/przeprogramowani/10x-astro-starter.git
cd 10x-astro-starter
```

2. Install dependencies:

```bash
npm install
```

3. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

4. Create a `.dev.vars` file for local Cloudflare dev secrets:

```bash
cp .env.example .dev.vars
```

5. Run the development server:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier

## Project Structure

```md
.
├── src/
│ ├── layouts/ # Astro layouts
│ ├── pages/ # Astro pages
│ │ └── api/ # API endpoints
│ ├── components/ # UI components (Astro & React)
│ └── assets/ # Static assets
├── public/ # Public assets
├── wrangler.jsonc # Cloudflare Workers config
```

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication. Environment variables are declared via Astro's `astro:env` schema and are treated as **server-only secrets** — they are never exposed to the client.

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Initialize the local Supabase project (creates a `supabase/` config folder):

```bash
npx supabase init
```

3. Start the local stack (downloads Docker images on first run):

```bash
npx supabase start
```

4. Copy the credentials printed by the CLI into your `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

5. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

No database tables or migrations are required — this project uses Supabase Auth's built-in `auth.users` table only.

### Using a cloud Supabase project instead

If you prefer to use a hosted Supabase project, add these variables to your `.env` and `.dev.vars` files:

| Variable       | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API       |
| `SUPABASE_KEY` | `anon` public key from Supabase dashboard → Settings → API |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

### Email confirmation in local development

By default Supabase requires email confirmation before a user can sign in. To skip this during local development:

1. Open the Supabase dashboard for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

Users can then sign in immediately after sign-up without clicking a confirmation link.

### Auth routes

| Route                 | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form                                             |
| `/auth/signup`        | Email/password sign-up form                                             |
| `/auth/confirm-email` | Post-signup "check your inbox" page                                     |
| `/dashboard`          | Example protected page (redirects to `/auth/signin` if unauthenticated) |

Route protection is handled in `src/middleware.ts`. Add paths to the `PROTECTED_ROUTES` array there to require authentication.

## Photo Storage

This project uses Supabase Storage for managing plant photos with user-level security.

### Setup

The storage infrastructure is created automatically via database migrations:

1. **Storage bucket:** `plant-photos` (private, 10MB limit, JPEG/PNG/WebP only)
2. **RLS policies:** Path-based access control ensures users can only access their own photos
3. **Database integration:** Photos are linked to actions via the `photos` table

### Local Development

After running `npx supabase start` and applying migrations (`npx supabase migration up`), you can:

- View storage in the dashboard: `http://localhost:54323` → Storage → `plant-photos`
- Upload photos via API: `POST /api/photos/upload` (requires authentication)
- Photos are stored at path: `{user_id}/{action_id}/{uuid}.{ext}`

### Upload API

**Endpoint:** `POST /api/photos/upload`

**Authentication:** Required (session cookie)

**Body:** multipart/form-data
- `action_id` (string, UUID) - Action to attach photo to
- `file` (File) - Image file (JPEG/PNG/WebP, max 10MB)

**Response:**
```json
{
  "success": true,
  "photo": {
    "id": "uuid",
    "photo_url": "https://...",
    "size_bytes": 1234,
    "order_index": 1,
    "created_at": "2026-06-05T..."
  }
}
```

**Validation:**
- Max 5 photos per action
- File type: JPEG, PNG, or WebP only
- File size: ≤10MB
- User must own the action (enforced via RLS)

**Testing:**
```bash
# Create test image
echo "iVBORw0KGgo..." | base64 -d > test.png

# Upload (replace ACTION_ID and TOKEN)
curl -X POST http://localhost:4321/api/photos/upload \
  -H "Cookie: sb-access-token=YOUR_TOKEN" \
  -F "action_id=YOUR_ACTION_ID" \
  -F "file=@test.png"
```

### Production Deployment

Migrations auto-apply via GitHub Actions. Verify the bucket exists in the Supabase Dashboard → Storage after deployment.

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/) with automatic deployment via GitHub Actions.

**Production URL:** https://plant-it.anna-kazmierczak-it.workers.dev

### Development Workflow

```bash
# 1. Work on a feature branch
git checkout -b feature/my-feature
# ... make changes ...
git add .
git commit -m "Add my feature"
git push origin feature/my-feature

# 2. Create Pull Request on GitHub
# → GitHub Actions runs: lint + build + tests

# 3. Merge PR to main
# → Automatic deployment to Cloudflare Workers 🚀
```

### Manual Deployment

If you need to deploy manually:

```bash
npm run build
npx wrangler deploy
```

### Required Secrets

Configure these secrets in GitHub repository settings (Settings → Secrets and variables → Actions):

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase anon/public key
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Workers permissions

For local development, set these in `.dev.vars` file.

### Monitoring Deployments

- **GitHub Actions:** Check deployment status at `https://github.com/[username]/plant_it_app/actions`
- **Cloudflare Dashboard:** View deployments at https://dash.cloudflare.com → Workers & Pages
- **Logs:** Run `npx wrangler tail` to stream live logs from production

### Detailed Deployment Guide

For complete deployment setup instructions, see [context/deployment/deploy-plan.md](context/deployment/deploy-plan.md).

## CI/CD

GitHub Actions workflow runs on every push and PR to `main`:

- **On Pull Requests:** Runs lint + build (no deployment)
- **On Push to `main`:** Runs lint + build + **automatic deployment to Cloudflare Workers**

The workflow is defined in `.github/workflows/ci.yml`.

## License

MIT
