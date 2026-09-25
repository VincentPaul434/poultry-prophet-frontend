# Poultry Prophet — Frontend

Next.js (App Router) dashboard for the [Poultry Prophet Spring Boot backend](https://github.com/VincentPaul434/poultry-prophet-backend).
Poultry Prophet is a rule-based batch-monitoring and decision-support prototype. It records farm
observations, compares them with configured ranges, calculates provisional indicators, and flags
conditions for manager review. It does not diagnose disease or predict future biological or
fighting performance.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (Nova preset, Base UI + Lucide icons)
- **TanStack Query v5** for server state, caching, and cache invalidation
- **axios** for the HTTP client (JWT bearer auth)

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configure the backend API URL in `.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api
```

The server-side `/api/backend` route reads this setting and forwards browser
requests to the backend. The client only calls the same-origin proxy, so the
backend host is not included in the client bundle. Although the `NEXT_PUBLIC_`
prefix can expose a variable when client code references it, this setting is
only read by the server route. Keep it out of client-side modules and set it in
the deployment build environment.

## Architecture

```
app/
  api/backend/[...path]/route.ts  Server-side proxy to NEXT_PUBLIC_API_BASE_URL
  layout.tsx            Root layout → wraps everything in <Providers>
  page.tsx              Redirects to /dashboard or /login
  login, register/      Public auth screens
  (app)/                Authenticated area (guarded + nav shell)
    layout.tsx          RouteGuard + AppShell
    dashboard/          Batch list + create
    batches/[batchId]/  Overview (KPIs, records, alerts)
      data-entry/       Daily record form
      selection/        Deferred/marked-not-included CRS view
    settings/           Thresholds + handlers
components/
  providers.tsx         QueryClientProvider + ThemeProvider + Toaster + AuthProvider
  route-guard.tsx       Client-side auth/role gate
  app-shell.tsx         Sidebar + nav
  ui/                   shadcn components
hooks/                  One file per resource — useQuery/useMutation hooks
lib/
  api-client.ts         axios instance (JWT inject + 401 redirect + ApiError)
  api.ts                Typed service layer (one fn per backend endpoint)
  types.ts              Mirrors the backend DTOs
  query-keys.ts         Hierarchical query-key factory
  query-client.ts       QueryClient defaults (caching policy)
  auth-context.tsx      Client auth state
```

### Caching strategy

- **Global defaults** ([lib/query-client.ts](lib/query-client.ts)): `staleTime` 30s,
  `gcTime` 5m, retry transient errors only (never 4xx), refetch on window focus.
- **Per-query tuning**: lifecycle stages are `staleTime: Infinity` (static reference
  data); handlers/thresholds 5m; live data (overview, alerts, indicators) 15s.
- **Live refresh**: active batch queries and the farm alert feed refresh every 30s.
- **Hierarchical keys** ([lib/query-keys.ts](lib/query-keys.ts)): everything for a batch
  lives under `["batches", id, ...]`, so a mutation can invalidate the whole subtree
  (e.g. logging a daily record recomputes indicators + alerts, so it invalidates
  `qk.batches.detail(batchId)`).
- **Cache seeding & patching**: creating a batch seeds its detail cache; threshold and
  selection mutations patch the cached list in place, then revalidate.
- On logout the entire query cache is cleared so no data leaks between users.

For controlled stakeholder validation, point `NEXT_PUBLIC_API_BASE_URL` at the isolated validation API,
set the version/environment variables from `.env.validation.example`, and confirm the in-app
validation banner before entering synthetic data. The primary MVP flow excludes individual
selection, offline capability claims, report UI, and advanced charts.
