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

Use Node.js 24.13.0 (see `.nvmrc`) and pnpm 11.8.0. With Corepack available, enable it before installing. The `pnpm-lock.yaml` file is the canonical lockfile; use frozen installs to keep local and CI dependencies aligned.

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Configure the backend API URL in `.env.local`:

```
BACKEND_API_URL=http://localhost:8080/api
```

The server-side `/api/backend` route reads this setting and forwards browser
requests to the backend. The client only calls the same-origin proxy, so the
backend host is not included in the client bundle. `BACKEND_API_URL` is
server-only and must be configured in the deployment environment.
`NEXT_PUBLIC_API_BASE_URL` remains supported as a compatibility fallback for
existing deployments and should be replaced with `BACKEND_API_URL`.

Offline daily-measurement replay is disabled by default. Set
`NEXT_PUBLIC_OFFLINE_DAILY_RECORDS=true` only after deploying the matching backend and
applying the reviewed V27 receipt migration to the intended database. Older backends reject
the new operation type, so enabling it early can block a batch's offline queue.

Authentication uses a separate IndexedDB database to coordinate credential changes across
tabs. An interrupted credential request can leave its lock abandoned, preventing sign-in.
If the login page offers to reset an abandoned lock, first close every other app tab and wait
for all sign-in requests to finish, then acknowledge this and reset the lock on that page.
This recovery clears only the expired lock, not offline records. Never reset it while an old
tab or sign-in request could still be active. If browser storage is unavailable, enable it and
try again. Do not clear all site data or delete `poultry-prophet-offline-v1`: it contains
unsynced records.

## Architecture

```
app/
  api/backend/[...path]/route.ts  Server-side proxy to BACKEND_API_URL
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
- **Live refresh**: active farm queries refresh every 60 seconds while the app is visible and online. The Refresh button also sends due queued records and reloads active data without replacing form input.
- **Hierarchical keys** ([lib/query-keys.ts](lib/query-keys.ts)): everything for a batch
  lives under `["batches", id, ...]`, so a mutation can invalidate the whole subtree
  (e.g. logging a daily record recomputes indicators + alerts, so it invalidates
  `qk.batches.detail(batchId)`).
- **Cache seeding & patching**: creating a batch seeds its detail cache; threshold and
  selection mutations patch the cached list in place, then revalidate.
- On logout the entire query cache is cleared so no data leaks between users.

For controlled stakeholder validation, point `BACKEND_API_URL` at the isolated validation API,
set the version/environment variables from `.env.validation.example`, and confirm the in-app
validation banner before entering synthetic data. The primary MVP flow excludes individual
selection, offline capability claims, report UI, and advanced charts.


### Local backend and refresh verification

Start the local backend on port 18080 with your existing local database. To create
a separate disposable database instead, use the backend repository’s
`bash scripts/validation-up.sh` after loading its validation environment settings.
Then run `pnpm dev:local` here and open `http://localhost:3000`. This command
explicitly uses `http://127.0.0.1:18080/api`, overriding the usual backend URL.
It also enables the existing offline development mode for local recording tests.

Run `pnpm check:local-sync` to verify receipt-backed death-event syncing. This
check accepts only HTTP loopback URLs and refuses redirects; it cannot contact
a live deployment. An optional first argument selects another local version URL.

Population totals show confirmed records. Locally queued deaths are labelled
separately until their original operation IDs are acknowledged, so a lost reply
cannot produce a second deduction.

### Disposable outage-recovery test

Use a separate local validation backend on `127.0.0.1:18081` backed by a
disposable database. The test creates synthetic farms, accounts and records;
never point that backend at real farm data. Start the local test gate in one
terminal:

```bash
RUN_DISPOSABLE_RECOVERY=true RECOVERY_QA_PORT=18084 node scripts/qa-outage-gate.cjs
```

In a separate frontend checkout or build directory, build with
`NEXT_PUBLIC_ENABLE_OFFLINE=true`, `NEXT_PUBLIC_OFFLINE_DAILY_RECORDS=true` and
`NEXT_PUBLIC_APP_ENVIRONMENT=validation`. Start the built frontend on port
33309 with `BACKEND_API_URL=http://127.0.0.1:18084/api`. Then run:

```bash
RUN_DISPOSABLE_RECOVERY=true RECOVERY_QA_GATE=http://127.0.0.1:18084 \
  PLAYWRIGHT_BASE_URL=http://127.0.0.1:33309 \
  pnpm exec playwright test e2e/disposable-outage-recovery.spec.ts --project=chromium
```

Before creating fixtures, the test checks that the frontend is connected to
the exact local gate and that the backend advertises receipt-backed validation
mode. It exercises an unavailable refresh, a 504 after a committed measurement,
and an automatic retry of the original operation.
