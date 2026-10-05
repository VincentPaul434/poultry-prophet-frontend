# Poultry Prophet Next.js Development Stability Implementation Plan

**Status:** Phases 1–3 implemented; Phases 4–7 remain planned

**Implemented in this pass:** Webpack/Turbopack development commands, Next memory settings, VS Code generated-artifact exclusions, reduced dashboard/alert polling, and on-demand handler quick-log batch loading.

**Verification completed:** `npm run lint`, `npx tsc --noEmit`, and `npm run build` passed. `npm run dev:webpack` started successfully; the compiled `/login` route returned HTTP 200.

**Not implemented in this pass:** backend pagination/filter API work, Node version pinning, bundle splitting, heap profiling, and the 30-minute memory soak test.
**Prepared:** September 26, 2026  
**Primary target:** `poultry-prophet-frontend`  
**Related target:** `poultry-prophet-backend` only for later, backward-compatible query filtering  

## 1. Objective

Prevent local `next-server` memory exhaustion and VS Code crashes without removing Poultry Prophet features, changing research behavior, altering production data, or weakening validation safeguards.

The implementation must preserve:

- Manager and handler workflows
- Dashboard and batch monitoring
- Event and daily-record logging
- Finance and operations analytics
- Selection Review preview, snapshots, and PDF generation
- Local Test Lab and its synthetic-data isolation
- Authenticated WebSocket updates
- Current REST API contracts unless an explicitly backward-compatible extension is introduced
- Existing production build and deployment behavior until a separate production verification passes

## 2. Evidence and working diagnosis

The stabilization work is justified by measured behavior, not by the normal existence of a development server:

- Linux invoked the OOM killer against `next-server` twice at approximately 8.2 GB and 9.2 GB resident memory.
- The computer has approximately 15.5 GB RAM and was already using swap, so the dev server can force VS Code and browser processes into severe memory pressure.
- The frontend currently uses Next.js `16.2.6`, React `19.2.4`, and Node.js `24.14.0`.
- Next.js 16 uses Turbopack by default for `next dev`.
- The generated `.next` directory is approximately 2.5 GB.
- `turbopack.root` is already pinned to the frontend repository, so an incorrectly inferred project root is not the leading remaining cause.
- The 100-day Test Lab generator is bounded. A daily-coverage run creates about 100 observations, 14 events, 2 input records, 3 financial records, 1 task, and 3 review snapshots. This volume cannot reasonably explain 8–9 GB in `next-server` by itself.
- The application combines WebSocket invalidation with recurring queries: batch lists every 15 seconds, dashboard batches every 15 seconds, and farm alerts every 30 seconds.
- `MobileBottomNav` requests the complete batch list even for managers, although managers do not use its handler quick-log sheet.
- Finance history currently downloads the complete transaction collection and filters it in the browser.
- VS Code is opened broadly enough to index generated frontend and backend artifacts, while multiple Java language services are active.

The likely failure is primarily a local development-tooling/cache problem. Recurring queries and growing test data are secondary efficiency issues that should be corrected without being misrepresented as the proven OOM root cause.

## 3. Non-negotiable implementation rules

1. Do not delete, reset, checkout, or overwrite existing uncommitted work.
2. Do not delete any production, local real, or validation database records as part of memory stabilization.
3. Do not remove the Test Lab, analytics, finance, reports, WebSockets, or role-specific workflows.
4. Do not disable TypeScript, ESLint, authentication, authorization, CORS, validation guards, or automated tests to reduce resource use.
5. Do not change `build` or `start` until the development-only intervention has been measured.
6. Do not use a larger swap file or a Node heap cap as the primary fix. Those can delay failure without removing retained memory.
7. Change one major variable at a time and record the result before proceeding.
8. Use generated-cache deletion only while the dev server is stopped. `.next` is recoverable; source and data are not targets.
9. Extend APIs with optional filters and limits. Do not silently replace a response shape consumed by existing clients.
10. Every phase must have a rollback point and must pass the feature smoke tests before the next phase begins.

## 4. Phase 0 — Preserve work and establish a baseline

### 4.1 Repository safeguard

Before implementation:

- Record `git status --short` for frontend and backend.
- Preserve the current dirty worktree. Do not use `git reset --hard`, `git checkout --`, or bulk cleanup commands.
- Create a named checkpoint commit only after the owner confirms the current feature changes are ready to checkpoint. If they are not ready, preserve a reviewed patch outside the repository and keep the worktree untouched.
- Record the current commit SHA, Node version, npm version, Next.js version, active branch, and test database environment.

### 4.2 Baseline functional checks

Run from the frontend repository:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Do not proceed by suppressing an error. Record and resolve unrelated baseline failures separately.

### 4.3 Baseline memory scenario

Measure the current Turbopack behavior using one repeatable route sequence:

1. Start `npm run dev` from a stopped state.
2. Log in as manager.
3. Visit Dashboard, one batch, data entry, Finance, Operations, Test Lab, and Selection Review.
4. Generate exactly one daily-coverage Test Lab batch.
5. Make ten small source edits that trigger Fast Refresh.
6. Leave the application idle for ten minutes.
7. Record `next-server` RSS and CPU every two seconds, total swap before/after, peak RSS, and whether memory falls or stabilizes.

Use the same account, routes, dataset, browser tabs, and edit sequence in all later comparisons.

## 5. Phase 1 — Stabilize the development bundler

### 5.1 Add an explicit Webpack comparison command

**File:** `package.json`

Initially retain the current command and add a comparison command:

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:webpack": "next dev --webpack",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  }
}
```

This first change is diagnostic. It does not affect deployment or application behavior.

### 5.2 Apply documented memory options

**File:** `next.config.ts`

Preserve the existing Turbopack root and add:

```ts
const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    preloadEntriesOnStart: false,
    webpackMemoryOptimizations: true,
  },
};
```

Expected trade-off: the first request to a route may compile more slowly. Feature output and API behavior must remain unchanged. `webpackMemoryOptimizations` applies only to the Webpack path.

### 5.3 Perform a fair cold-cache comparison

With the dev server stopped:

1. Remove only `.next`.
2. Run the baseline scenario with `npm run dev:webpack`.
3. Stop the server.
4. Remove only `.next` again.
5. Run the identical scenario with `npm run dev`.
6. Compare peak RSS, final idle RSS, CPU after compilation, swap growth, compile duration, and functional results.

### 5.4 Bundler decision gate

- If Webpack passes the stability criteria and Turbopack fails, make Webpack the default local command:

  ```json
  {
    "dev": "next dev --webpack",
    "dev:turbo": "next dev"
  }
  ```

- Leave `build` and `start` unchanged.
- If both fail, do not guess or immediately downgrade dependencies. Continue to Phase 2 and then capture profiles under Phase 7.
- If both pass after cache removal, retain both scripts and repeat the soak test after several development sessions before choosing the default.

### 5.5 Rollback

Revert only `package.json` and the new `experimental` block in `next.config.ts`. No data or API rollback is required.

## 6. Phase 2 — Reduce editor and runtime contention

### 6.1 VS Code watcher exclusions

**File:** `.vscode/settings.json`

Merge, rather than overwrite, the following exclusions:

```json
{
  "files.watcherExclude": {
    "**/.next/**": true,
    "**/node_modules/**": true,
    "**/target/**": true,
    "**/validation-artifacts/**": true,
    "**/.git/**": true
  },
  "search.exclude": {
    "**/.next": true,
    "**/node_modules": true,
    "**/target": true,
    "**/validation-artifacts": true
  }
}
```

These settings affect only editor indexing and search. They must not be added to application runtime logic.

### 6.2 Workspace and extension policy

- Open frontend and backend as separate VS Code workspaces during intensive development.
- Use one Java language implementation. Prefer Red Hat Java for the backend and disable Oracle Java for this workspace.
- Keep Spring Boot tooling enabled only in the backend workspace.
- Do not commit personal extension-disable settings unless the team agrees on a shared workspace recommendation.
- Close unused browser tabs during the controlled memory test so measurements remain comparable.

### 6.3 Node version decision gate

Current runtime: Node `24.14.0`.

Only if Webpack remains unstable on Node 24:

1. Test the identical scenario using Node 22 in a clean dependency installation.
2. Do not change package versions during this test.
3. If Node 22 is materially more stable, add `.nvmrc` with `22` and a compatible `engines.node` range to `package.json`.
4. Run the complete static and feature verification suite before adopting the pin for the team.

Node switching is a controlled compatibility test, not a claim that Node 24 is unsupported.

## 7. Phase 3 — Remove unnecessary recurring frontend work

This phase improves the running UI and backend load. It is not a substitute for resolving the dev-server memory problem.

### 7.1 Batch query behavior

**Files:**

- `hooks/use-batches.ts`
- `components/app-shell.tsx`
- `app/(app)/dashboard/page.tsx`

Required changes:

1. Give `useBatches` an `enabled` option and remove its unconditional 15-second interval.
2. Retain `refetchOnWindowFocus` and add a reasonable `staleTime` such as 30 seconds.
3. In `MobileBottomNav`, do not fetch batches for managers.
4. For handlers, enable the quick-log batch query only when needed, preferably when the quick-log sheet opens. Display a loading state inside the sheet.
5. Keep the dedicated dashboard summary query separate from the full batch list.
6. Increase dashboard fallback polling to 60 seconds and explicitly disable background polling.

### 7.2 Alert refresh behavior

**Files:**

- `hooks/use-analytics.ts`
- `hooks/use-farm-realtime.ts`
- `components/app-shell.tsx`

Required changes:

1. Preserve authenticated WebSocket subscriptions and reconnection.
2. Continue invalidating React Query keys when farm events arrive.
3. Increase alert fallback polling from 30 seconds to 60–120 seconds.
4. Do not poll while the browser tab is hidden.
5. Test a two-client scenario before reducing polling further: handler records an event; manager must receive the update without manual refresh.
6. If not every cross-user mutation has a corresponding WebSocket event, retain fallback polling for that resource until backend event coverage is added.

### 7.3 Mutation invalidation audit

For every create/update workflow, verify that only the affected query keys are invalidated:

- Batch creation and population events
- Daily records
- Product/medicine inputs
- Finance transactions
- Tasks and task completion
- Selection Review snapshots/finalization
- Alert acknowledgement

Do not use broad `queryClient.clear()` calls. They cause unnecessary refetching and can remove useful cache state.

### 7.4 Phase acceptance criteria

- Manager pages no longer issue the unused full-batch query from mobile navigation.
- Hidden tabs produce no recurring batch/dashboard request.
- WebSocket-driven manager updates still arrive during the two-client test.
- Returning focus refreshes stale data.
- No user action requires an added manual refresh button.

## 8. Phase 4 — Bound data returned to the browser

Implement this phase only after Phase 1 stability is measured. These API improvements must be backward-compatible.

### 8.1 Finance history first

**Frontend files:**

- `lib/api.ts`
- `lib/query-keys.ts`
- `hooks/use-operations.ts`
- `app/(app)/finance/page.tsx`

**Backend areas:** finance controller, service, and repository.

Extend the existing transaction endpoint with optional parameters:

- `batchId`
- `type`
- `start`
- `end`
- `limit`
- `offset` or a documented page number

Rules:

- Existing calls without parameters must continue to work during migration.
- The chart must continue using the aggregate analytics endpoint.
- The history list should request the selected batch and a bounded page instead of downloading all transactions.
- Display a simple “Load more” action rather than rendering an unlimited list.
- Query keys must include all active filter and page parameters.

### 8.2 Batch and Test Lab visibility

- Preserve every generated `[TEST COPY]` batch.
- Add an explicit normal/test/all filter instead of silently losing test records.
- Default normal stakeholder dashboards to real batches when Test Lab is enabled locally.
- Keep a visible way to show test batches.
- Prefer archive over hard deletion for cleanup.
- Any cleanup endpoint must be local/validation-only, manager-authorized, and restricted to batches positively identified as synthetic test copies.
- Never infer that a batch is disposable merely from a user-editable display name.

### 8.3 Other potentially unbounded lists

After finance, measure before modifying:

- Product and medicine history
- Tasks
- Saved review reports
- Incubation cycles
- Farm-wide batches

Add optional server-side limits and filters only where payload size or render time justifies the work. Recent events and daily records already use explicit limits and should retain them.

## 9. Phase 5 — Bundle and component audit

Run only if `next-server` still grows after the bundler and editor interventions.

1. Analyze the production bundle and identify route-only dependencies imported by the root layout or app shell.
2. Ensure large route-specific views are not imported by `app-shell.tsx`.
3. Dynamically load only genuinely heavy, below-the-fold visualizations; do not fragment small components without evidence.
4. Audit effects, intervals, WebSocket clients, and browser event listeners for cleanup functions.
5. Confirm that one authenticated WebSocket client exists per mounted application shell and that it deactivates on logout/unmount.
6. Remove unused dependencies only after proving they are unused through source search and a successful clean build.

No feature is to be removed merely to lower bundle size.

## 10. Phase 6 — Verification matrix

### 10.1 Static verification

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Run relevant backend tests if Phase 4 changes backend APIs.

### 10.2 Functional smoke tests

#### Authentication and roles

- Manager login/logout
- Handler login/logout
- Farm scoping remains enforced
- Unauthorized Test Lab access remains denied

#### Manager

- Dashboard and active-batch cards
- Open batch and preview Selection Review
- Save/finalize review and download PDF
- Finance batch selection, chart, history, and transaction creation
- Operations analytics
- Task assignment
- Test Lab generation in local mode only

#### Handler

- Mobile navigation and quick log
- Event/population logging
- Daily observation logging
- Product/medicine logging
- Task completion

#### Cross-client freshness

- Open manager and handler sessions simultaneously.
- Submit a handler event.
- Verify manager alert/batch state updates through WebSocket or the documented fallback interval.
- Temporarily interrupt WebSocket connectivity and verify recovery/fallback behavior.

#### Safety

- Production/deployed environment does not expose Test Lab.
- Original source batch is unchanged after synthetic generation.
- Test records remain labelled and distinguishable.
- No real or synthetic record is deleted during the test.

### 10.3 Memory soak test

Repeat the Phase 0 scenario for at least 30 minutes.

Pass conditions:

- No kernel OOM event and no `next-server` termination.
- Target peak `next-server` RSS below 3 GB on the current machine.
- Hard investigation threshold: 4 GB or a continuously rising trend after activity stops.
- Final ten-minute idle memory varies within approximately 20% rather than rising monotonically.
- CPU returns near idle after compilation; it does not remain at a full core while untouched.
- Swap does not grow by more than 512 MB during the controlled run.
- Every functional smoke test passes.

The trend is more important than a single brief compile peak.

### 10.4 Production-mode comparison

With `next dev` stopped:

```bash
npm run build
npm run start
```

Smoke-test the same read-only routes. This comparison confirms whether the abnormal use is development-only. Do not use production mode as the everyday coding workflow because it does not provide normal Fast Refresh.

## 11. Phase 7 — Escalation if memory still grows

Only after Phases 1–3 fail their acceptance criteria:

1. Capture a Next.js/Turbopack trace using the option documented for the installed Next version.
2. Run `next dev` with the Node inspector and collect two heap snapshots: one after startup and one after the repeatable edit/navigation sequence.
3. Determine whether retained memory is JavaScript heap, native/Turbopack memory, PostCSS workers, repeated module instances, or application-side subscriptions.
4. Reproduce with the smallest route set possible.
5. Test a newer patched Next.js release in a temporary branch only after reviewing its release notes and peer compatibility.
6. If necessary, test a known-compatible earlier release in a temporary branch. Do not downgrade the main branch without the full smoke and build suite.
7. Prepare a minimal reproduction and trace for an upstream Next.js issue if the growth persists without Poultry Prophet business code.

## 12. Risk and mitigation summary

| Change | Main risk | Mitigation |
|---|---|---|
| Webpack for local dev | Slower first compile | Keep Turbopack script; compare measurements |
| Disable entry preloading | Slower first visit per route | Accept only if memory improves; verify all routes |
| Reduce polling | Delayed cross-device refresh | Preserve WebSockets and a visible-tab fallback |
| Conditional mobile batch query | Brief loading state when quick log opens | Add explicit loading UI and cache results |
| API filtering/pagination | Missing records or client incompatibility | Optional parameters, existing defaults, load-more tests |
| Hide test copies by default | Tester may think data vanished | Explicit Normal/Test/All filter and persistent labels |
| Node 22 pin | Team/runtime mismatch | Use only after A/B test and clean verification |
| Cache removal | Cold compile delay | Delete only `.next`; never source or databases |

## 13. Recommended execution order and estimate

1. **Baseline and safeguards:** 1–2 hours
2. **Webpack/config comparison:** 2–4 hours including soak testing
3. **VS Code/workspace cleanup:** 30–60 minutes
4. **Polling and query lifecycle refinement:** 4–8 hours
5. **Finance filtering/pagination:** 1–2 development days across frontend/backend
6. **Complete regression and memory verification:** 4–6 hours
7. **Profiling/escalation:** only if required; estimate after trace review

Do not combine all phases into one commit. Suggested commits:

1. `chore(frontend): add reproducible dev memory modes`
2. `chore(vscode): exclude generated build artifacts`
3. `perf(frontend): reduce redundant background queries`
4. `perf(finance): request bounded transaction history`
5. `test(frontend): document stability and regression results`

## 14. Definition of done

The work is complete only when:

- The repeatable 30-minute development scenario no longer causes OOM or VS Code termination.
- `next-server` memory stabilizes within the agreed threshold.
- Production build and start behavior remain valid.
- Manager, handler, Test Lab, finance, analytics, report, and real-time workflows pass.
- No production or validation data was deleted or modified merely to achieve stability.
- The team has one documented default development command and one troubleshooting command.
- The measured before/after results and selected bundler/Node decisions are recorded in a short implementation report.

## 15. Primary references

- Next.js memory usage guide: <https://nextjs.org/docs/app/guides/memory-usage>
- Next.js CLI and `--webpack`: <https://nextjs.org/docs/app/api-reference/cli/next>
- Turbopack caching and tracing: <https://nextjs.org/docs/app/api-reference/turbopack>
- Next.js system requirements: <https://nextjs.org/docs/app/getting-started/installation#system-requirements>

