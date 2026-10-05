# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing product architecture: Next.js, React, TypeScript, Tailwind CSS/shadcn UI, and TanStack Query on the frontend; Spring Boot, PostgreSQL, and JPA/Hibernate on the backend.

## Users

- Gamefowl farm owners and breeders/managers oversee farm operations, review batch history, monitor expenses, manage inventory, and make breeding or selection decisions.
- Farm handlers perform and record daily work, including population changes, health-related events, medicine use, product consumption, and other batch observations.

Managers primarily review and decide; handlers primarily perform and record daily work.

## Product Purpose

Poultry Prophet helps a gamefowl farm organize birds into batches, maintain a traceable history of population and health-related observations, record product use and financial activity, manage inventory, operate through unreliable connectivity, and produce a concise batch review report for an owner or manager. It turns scattered farm records into evidence that supports human review while leaving breeding and selection decisions to experienced people.

## Positioning

Poultry Prophet combines batch health history, operations, inventory, and finance records into one clear, traceable report for farm review. Its value is the connection between source records and reviewable decisions, not automated diagnosis, individual-bird selection, or a claim to predict future performance.

## Operating Context

- Handlers may use the system from the farm on a mobile device with unreliable internet. Entries must queue locally and synchronize later with retry handling and duplicate prevention.
- Managers and owners use the system to review batch history, alerts and observations, inventory, expenses and recorded income, operations summaries, and concise batch reports.
- Work is organized around farm-scoped batches. The current system does not maintain individual-bird records.
- A manager-only Test Lab can create synthetic or accelerated data for validation; that data must remain isolated from real farm data.

## Capabilities and Constraints

- Organize birds into batches and record population changes, health-related events, daily observations, medicine, feed, and other product usage.
- Deduct tracked products from inventory while preventing negative stock; insufficient-stock records go to manager review.
- Track batch-related expenses and recorded income, and distinguish recorded cash flow from actual profit in reports.
- Generate a concise, transparent batch review report that shows its source records.
- Preserve manager/handler permissions, secure authentication, controlled CORS, farm authorization, and strict farm-scoped data isolation.
- Preserve offline-first logging, queued entries, synchronization, retries, and duplicate prevention.
- Keep records append-only and traceable. Corrections must retain the source record and an auditable correction trail rather than silently erasing history.
- Preserve Test Lab isolation so synthetic or accelerated data cannot affect real farm data.
- Provide human decision support only: no disease diagnosis, automatic individual-bird selection, or future-performance prediction.
- Preserve the existing Next.js/Spring Boot/PostgreSQL/JPA-Hibernate architecture unless a future request explicitly changes it.

## Brand Commitments

The product name is Poultry Prophet. It is a gamefowl-farm operations and decision-support product, and future work must preserve that purpose and context.

## Evidence on Hand

- The repository contains an authenticated farm dashboard with manager and handler role gates, batch routes, daily data entry, alerts, tasks, incubation, product inputs, inventory, finance, operations analytics, settings, offline sync, and a manager-only Test Lab.
- `README.md` documents the rule-based batch-monitoring and decision-support scope and explicitly states that the product does not diagnose disease or predict future biological or fighting performance.
- `app/(app)/batches/[batchId]/selection/` and `components/selection-review-summary.tsx` provide existing selection-review/reporting workflow evidence.
- No customer testimonials, benchmarks, or other external proof were provided. Future work must not fabricate them.

## Product Principles

1. Keep every important farm fact connected to its batch and source record.
2. Make field work dependable when connectivity is poor, and make synchronization state understandable.
3. Protect farm boundaries, permissions, and real data from accidental access or synthetic test activity.
4. Surface evidence for experienced managers; never replace human diagnosis or selection judgment.
5. Treat inventory and financial records as safe, traceable operational facts rather than hidden calculations.

## Accessibility & Inclusion

The interface must be simple, mobile-friendly, and accessible for handlers with limited technical experience. Controls, status, synchronization state, errors, and reports must be understandable without relying only on color or advanced technical knowledge.
