# Final Grading Readiness Implementation Plan

**Goal:** Correct misleading or unsafe behavior and prepare real-user usability sessions without altering existing farm records.

**Architecture:** Validate structured health-death observations at the backend boundary and retain compatible handling for valid queued legacy records. Present batch attention and demo-data context accurately in the existing interface. Fix underlying button semantics rather than hiding development warnings. Supply a session guide for researchers.

**Tech stack:** Spring Boot, React/Next.js, TypeScript, PostgreSQL, Playwright.

**Requirements:** The user's five final-grading findings in the current request.

## Work and verification

- [x] Trace direct and offline health-death paths; reject missing signs before population changes and preserve valid legacy observations. Test all three choices and sync rejection.
- [x] Send structured observation information from both frontend population-event paths, retaining readable historical notes. Verify the form and queued payloads. Provide explicit correction of rejected legacy records without losing queue order.
- [x] Replace misleading dashboard wording with language matching its attention rules; resolve underlying non-native button warning. Verify manager/handler cards and mobile tally access.
- [x] Identify demonstration inventory and cost provenance without guessing or editing historic transactions. Clearly label marked entries, affected inventory and finance, and possible batch/chart impacts. Verify relevant screens and calculations.
- [x] Prepare a concise, repeatable session guide for real managers and handlers, including consent, realistic tasks, success measures, and demo-data safeguards.
- [ ] Conduct and document real-user sessions with recruited participants. This requires actual managers and handlers and cannot be simulated.
- [x] Run focused backend, frontend, and browser regression checks. Record conditional skips and the outstanding real-user sessions in the handoff. No database migration was required; the backend was restarted.
