# ChannelLens frontend

Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + Recharts. See the [root README](../README.md)
for the full project.

```bash
npm install
npm run dev          # http://localhost:3000, proxies /api/* to BACKEND_URL (default http://localhost:8000)
npm run lint
npm run typecheck
npm test             # Vitest unit tests
npm run test:e2e     # Playwright: starts the API in demo mode + a production build
SCREENSHOTS=1 npx playwright test screenshots --project=desktop   # regenerate docs/screenshots
```

| Path | What it is |
|---|---|
| `src/app/` | Routes: `/`, `/channel/[id]`, `/compare`, `/watchlist`, `/login`, `/register` |
| `src/components/` | Dashboard, compare view, charts, search box, auth context |
| `src/lib/` | API client, `useApi` hook, formatting helpers, types |
| `e2e/` | Playwright specs |
