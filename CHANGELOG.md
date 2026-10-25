# Changelog

Notable changes to Termin. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Practice loop, phase 1–2.** Link a Codeforces handle to import the public
  problem catalog and your submission history, then upsolve the problems you
  did not solve from contests you marked as participated. Failures come back on
  a 1 → 3 → 7 → 21 day schedule. New `/practice` page, a Training card in the
  Contests rail, and `npm run import -- --handle <handle>`.
- Migration `003_training.sql`: `platform_accounts`, `problems`, `submissions`,
  `problem_reviews`, and `training_state`.
- `npm run demo`: seeds a disposable `.data/demo.db` with upcoming contests, a
  deliberate planning conflict, three weeks of history, and insights, then
  starts the dev server — so a fresh clone shows a populated dashboard with no
  network access or provider sync. Your real database is untouched, the toolbar
  shows a **Demo data** badge, and Sync is disabled against fixtures.

### Changed

- Weekly capacity and conflict detection now read the **Planned** participation
  status instead of a separate priority table, so marking a contest as planned
  is the single way to tell Termin you intend to compete. The capacity meter
  and the "Overlaps a contest you planned" warning now reflect real data.

### Removed

- `POST /api/planning` and the contest priority store behind it. Nothing in the
  interface could set a priority, so the endpoint was unreachable and the
  capacity meter always read full.
- Unused `getStoredContests` and `removeStaleUpcomingContests` helpers, and the
  duplicated platform name/monogram maps across five files, now shared from
  `src/lib/contests/platforms.ts`.
- The three static `src/pages/api/*` route files and the inline
  `preferences-form-handler` Vite plugin.

### Fixed

- The history page read the database three times per request; it now reads once.
- Participation status, preference saves, and the **Sync** button could not
  reach the database: Astro renders every route at build time, so the three
  static `pages/api/*` endpoints silently discarded request bodies (writes
  answered `400 Malformed JSON`). All writes now go through one dev-server
  integration, `src/dev/write-api.ts`, replacing both the dead endpoints and the
  duplicate settings middleware in `astro.config.mjs`.

## [0.1.0] - 2026-10-24

First tagged release. Termin is a self-hosted dashboard and calendar feed for
upcoming Codeforces, AtCoder, CodeChef, and LeetCode contests.

### Added

- Contest aggregation from four providers, with per-provider isolation: one
  failing provider never wipes another provider's stored contests.
- Provider payload validation — invalid contests are rejected and existing data
  is preserved instead of being overwritten.
- Reconciliation that detects schedule changes between syncs.
- Personal preferences: enabled platforms, weekly cap, preferred days and hours.
- Weekly planning with ranked recommendations and conflict detection.
- Participation tracking with behavioural insights.
- iCalendar feeds — one combined feed and one per platform.
- Tracked SQL migrations with a `schema_migrations` table.
- A **Sync** button in the toolbar that triggers a sync from the dashboard, plus
  a `POST /api/sync` endpoint behind it.

### Changed

- Interface rebuilt as an instrument panel: neutral slate palette, a single
  accent reserved for links and focus, state colours only for live/soon/error,
  and monospace tabular numerals so times and durations align in columns.
- Planning is a flat ranked list rather than day groups, matching the
  recommendation order.

### Known limitations

- The write endpoints (`/api/preferences`, `/api/participation`, `/api/planning`,
  `/api/sync`) run only in the dev server. A static build is read-only.
- Reminders are scheduled and stored, but no delivery channel is implemented.
- Migrations are forward-only.

[0.1.0]: https://github.com/Dazzanova/Termin/releases/tag/v0.1.0
