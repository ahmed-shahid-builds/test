# Vercel deployment notes

This project keeps its existing Express server for Manus Preview and adds a single Vercel Function at `api/index.ts` for the four `/api/*` operations. The function uses the standard Web `fetch` handler and shared database/auth helpers; one function handles all API paths after a Vercel rewrite. Vercel's Node.js runtime documentation recommends a shared function for related API routes, and its Vite guide calls for an explicit SPA rewrite for deep links. The included `vercel.json` therefore sends `/api/:path*` to the shared `/api` function while preserving the captured path in a query parameter, and maps `/teacher` to the generated `/index.html`.

Vercel's Vite build serves static output separately from functions. This archive keeps the frontend output in `dist/client` and configures the install and build commands in `vercel.json`. The API initializes its MySQL table lazily on a function instance and only records anonymous random attempt UUIDs and timestamps. No Manus secrets or database connection string belong in this archive.

Before deploying, provide an externally reachable MySQL-compatible connection as Vercel environment variable `DATABASE_URL` and a strong teacher password as `TEACHER_PASSWORD` (at least 16 characters). Use Vercel's environment-variable settings; do not prefix these server-only values with `VITE_`. The existing Manus-managed database URL and password are not portable through a source ZIP. Once Vercel has these values, its build installs from the committed pnpm lockfile, builds the Vite frontend and TypeScript server, and serves the SPA plus serverless API.

## Official references

- [1] [Express on Vercel](https://vercel.com/docs/frameworks/backend/express) — Express apps on Vercel run as Functions; Express static middleware does not serve CDN assets, which should be in Vercel's static output or `public`.
- [2] [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite) — Vite build output, environment variables, functions, and SPA deep-link rewrites.
- [3] [Getting started with Vercel Functions](https://vercel.com/docs/functions/quickstart) — shared fetch-handler functions and routing related API paths to one handler.
- [4] [Node.js Runtime with Vercel Functions](https://vercel.com/docs/functions/runtimes/node-js) — Node function files under `api/`, TypeScript support, and dependency detection.
- [5] [Vercel rewrites](https://vercel.com/docs/routing/rewrites) — same-project source/destination rewrites and wildcard path forwarding.
- [6] [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json) — `installCommand`, `buildCommand`, `outputDirectory`, and `rewrites` settings.
