# Poultry Prophet — Frontend

Next.js (App Router) dashboard for the [Poultry Prophet Spring Boot backend](https://github.com/VincentPaul434/poultry-prophet-backend).
Tracks game fowl brooding/ranging, computes readiness indicators, and supports
the manager's month-5 selection decision.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (Nova preset, Base UI + Lucide icons)
- **TanStack Query v5** for server state, caching, and cache invalidation
- **axios** for the HTTP client (JWT bearer auth)

## Getting started

```bash
npm install
npm run dev
```

The app expects the backend on `http://localhost:8080`. Configure via `.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api
```

## Architecture

```
app/
  layout.tsx            Root layout → wraps everything in <Providers>
  page.tsx              Redirects to /dashboard or /login
  login, register/      Public auth screens
  (app)/                Authenticated area (guarded + nav shell)
    layout.tsx          RouteGuard + AppShell
    dashboard/          Batch list + create
    batches/[batchId]/  Overview (KPIs, records, alerts)
      data-entry/       Daily record form
      selection/        Month-5 ranked selection (manager only)
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
- **Hierarchical keys** ([lib/query-keys.ts](lib/query-keys.ts)): everything for a batch
  lives under `["batches", id, ...]`, so a mutation can invalidate the whole subtree
  (e.g. logging a daily record recomputes indicators + alerts, so it invalidates
  `qk.batches.detail(batchId)`).
- **Cache seeding & patching**: creating a batch seeds its detail cache; threshold and
  selection mutations patch the cached list in place, then revalidate.
- On logout the entire query cache is cleared so no data leaks between users.
