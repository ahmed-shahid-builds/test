# Deploy Entrepreneur Test to Vercel

This ZIP contains the complete source project. Extract it, then deploy the folder that contains `package.json` and `vercel.json` as the Vercel project root. You can import the extracted project from a Git repository or run the Vercel CLI from that folder.

## Required before deployment

The backend needs a MySQL-compatible database that Vercel Functions can reach over the network. Create/provision that database with your chosen provider; the archive does not contain the Manus-managed database connection or its credentials. On the Vercel project's **Settings → Environment Variables**, set:

- `DATABASE_URL` — the connection URI from your database provider.
- `TEACHER_PASSWORD` — a strong password of at least 16 characters.

Set these as server-side environment variables for the Vercel environments where you want the app to run. Do not prefix them with `VITE_`, and do not add real values to the source files or ZIP. `.env.example` contains blank placeholders only. The `quiz_attempts` table is created automatically on the first API request. The backend records only anonymous attempt references plus start/completion timestamps; it does not store student names, answers, or scores.

## Deploy

1. Extract the ZIP and open a terminal in the extracted project root.
2. Connect that root to a Vercel project using the Vercel dashboard's Git import flow, or install/sign in to the Vercel CLI and run `vercel` from the root.
3. Ensure the Vercel environment variables above are saved for the deployment environment, then build/deploy. The included `vercel.json` sets `pnpm install --frozen-lockfile`, `pnpm build`, and `dist/client` as the static output directory.
4. Check the deployed homepage and `/teacher` route. Teacher totals are available at `/teacher` after signing in with `TEACHER_PASSWORD`.

The Vercel Function in `api/index.ts` handles all quiz and teacher API calls. The routing rules send `/api/*` through that function and map `/teacher` to the built single-page app. The original Express/Vite server and Dockerfile remain for the existing Manus Preview; Vercel uses the included Vercel configuration instead.

For complete source references informing this deployment setup, see [VERCEL-DEPLOYMENT.md](./VERCEL-DEPLOYMENT.md).
