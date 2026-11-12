# Frontend dependency audit

Audit date: 2026-11-11. Run `pnpm audit` and `pnpm audit --prod` to refresh this snapshot. Advisory counts can change as the registry adds findings.

After upgrading Next.js and refreshing compatible lockfile resolutions, both reports show **0 critical, 0 high, 1 moderate, and 1 low** advisories. The previous full audit reported 6 critical, 21 high, 15 moderate, and 5 low.

- **Moderate — minimatch 10.2.6**, [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249): transitive through `shadcn > ts-morph > @ts-morph/common` and `eslint-config-next`/`@tanstack/eslint-plugin-query > @typescript-eslint/typescript-estree`. The advisory identifies 11.0.1 or later as patched. Forcing a new major across these consumers may break their glob handling; revisit when upstream dependencies support a patched version.
- **Low — deepmerge 4.3.1**, [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4): transitive through `shadcn` and `shadcn > @shadcn/registry`. The advisory identifies 4.3.2 or later as patched, but npm reported 4.3.1 as the latest published version on the audit date. Recheck upstream releases.

The production audit includes these paths because `shadcn` is currently a production dependency. Audit inclusion does not establish that a vulnerable code path is reachable in the deployed application.
