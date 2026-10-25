# Termin

> Every upcoming competitive programming contest in one place — plus a calendar
> feed you can subscribe to.

[![CI](https://github.com/Dazzanova/Termin/actions/workflows/ci.yml/badge.svg)](https://github.com/Dazzanova/Termin/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%3E%3D22.12-3c873a?logo=node.js&logoColor=white)

![Termin dashboard](assets/dashboard.png)

Termin pulls upcoming contests from Codeforces, AtCoder, CodeChef, and LeetCode
into a single local SQLite database. It shows what is happening next, tracks
which contests you actually joined, and publishes iCalendar feeds that Google
Calendar, Apple Calendar, and Outlook can subscribe to.

No account, no server, no telemetry — your data stays in `.data/termin.db`.

## Features

| Feature | Status |
| --- | --- |
| Aggregates Codeforces, AtCoder, CodeChef, and LeetCode | ✅ |
| Resilient sync — one failing provider never wipes the others | ✅ |
| Rejects invalid provider payloads instead of storing them | ✅ |
| Detects schedule changes between syncs | ✅ |
| Re-sync from the dashboard with the toolbar button | ✅ |
| Personal preferences: platforms, weekly cap, preferred days and hours | ✅ |
| Weekly planning with recommendations and conflict detection | ✅ |
| Participation history and behavioural insights | ✅ |
| Codeforces handle import: catalog + submission history | ✅ |
| Upsolve queue with spaced review (1 → 3 → 7 → 21 days) | ✅ |
| Weakness profile, rating chart, and practice suggestions | ✅ |
| Beginner contest guide and C++ starter packs | ✅ |
| iCalendar feeds per platform and combined | ✅ |
| Reminder delivery (push, email, Discord) | 🚧 roadmap |
| Hosted multi-user version | 🚧 roadmap |

## Quick start

Requires Node 22.12 or newer.

```bash
git clone https://github.com/Dazzanova/Termin.git
cd Termin
npm install
npm run sync   # fetch upcoming contests into SQLite
npm run dev    # http://localhost:4321
```

`npm run dev` is the full app: syncing, preferences, participation tracking, and
the calendar feeds all work. The **Sync** button in the toolbar re-fetches
contests without leaving the page. A production build (`npm run build`) is a
read-only snapshot, because the write endpoints only exist in the dev server.
See [Limitations](#limitations).

### Try the demo

```bash
npm install
npm run demo   # http://localhost:4321
```

No network, API keys, or provider sync needed. The demo seeds a disposable
database at `.data/demo.db` with upcoming contests, a week of planning
(including an overlapping pair), three weeks of history, and insights, then
starts the dev server. Your real `.data/termin.db` is never touched. The toolbar
shows a **Demo data** badge instead of **Sync**, because a fixture set is a
snapshot. Set `PORT` to use another port, and delete `.data/demo.db` when you are
done.

## Practice and upsolving

Link a Codeforces handle in [Settings](/settings), or import from the CLI:

```bash
npm run import -- --handle yourhandle
```

The import pulls the public problem catalog, your submission history, and your
rating history (three requests to the keyless Codeforces API), then queues
every problem you did not solve from contests you marked as **Participated**.
Solved problems retire themselves on the next import.

Practice schedules failures at 1 → 3 → 7 → 21 days. **Again** advances the
interval, **Solved** closes the problem, **Drop** removes it. The Contests page
shows the due count in the rail, and `/practice` holds the full queue.

The **Profile** page turns that record into guidance: current and peak rating
with a chart, weak tags ranked by solve rate and the median rating you solve,
and five untried problems from your weakest tags between your rating and +200.
**Open & queue** opens the problem and adds it to the review queue in one step.
Tags need at least three attempts before they rank, and unrated handles fall
back to the upper range of problems they have solved.

Only Codeforces is importable today; the schema is keyed by platform so other
providers can follow. Your handle is only sent to Codeforces, and the imported
catalog stays in your local SQLite file.

## Beginner guide and starter packs

`/learn` is a short playbook for a first contest — before, during, and after —
plus a table of what Codeforces, AtCoder, CodeChef, and LeetCode each expect.

Below it, every upcoming contest gets a C++17 **starter pack**: one file per
problem, with fast IO and a `TODO`. **Save to folder** asks for a directory and
writes the files straight into it (Chrome and Edge); the `.zip` link does the
same job everywhere else, unpacking into a single named folder. Codeforces
packs use the real problem letters, names, and links when that contest is in
your imported catalog; other platforms use the letters their contests usually
ask for.

## Calendar subscriptions

Termin serves iCalendar feeds from these paths:

| Feed | Path |
| --- | --- |
| All enabled platforms | `/calendar.ics` |
| Codeforces | `/calendar/codeforces.ics` |
| AtCoder | `/calendar/atcoder.ics` |
| CodeChef | `/calendar/codechef.ics` |
| LeetCode | `/calendar/leetcode.ics` |

While `npm run dev` is running, subscribe to
`http://localhost:4321/calendar.ics`. After `npm run build`, the same files are
written to `dist/calendar.ics` and `dist/calendar/`, ready to host on any static
host.

- **Google Calendar**: Other calendars → From URL → paste the feed URL.
- **Apple Calendar**: File → New Calendar Subscription → paste the feed URL.
- **Outlook**: Add calendar → Subscribe from web → paste the feed URL.

The dashboard's **Calendar feeds** card copies the absolute URL for you. Feeds are
regenerated on each build, so a deployed feed is as fresh as the last deploy.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with full read/write behaviour |
| `npm run demo` | Seed a disposable demo database and start the dashboard |
| `npm run import` | Import the Codeforces catalog and your submissions |
| `npm run sync` | Fetch contests from every provider and reconcile them into SQLite |
| `npm run sync:worker` | Long-running sync loop (`TERMIN_SYNC_INTERVAL_HOURS`, default 24) |
| `npm run build` | Static build of the dashboard and calendar files |
| `npm run preview` | Serve the built output |
| `npm test` | Run the Vitest suite against an in-memory database |

## Architecture

```
src/
  lib/
    contests/          providers, validation, reconciliation, persistence
      providers/       one adapter per platform
    calendar/          iCalendar serialization (ics.ts) and response helper
    preferences/       platform and schedule preferences
    reminders/         reminder scheduling and storage
    db/                SQLite connection and tracked SQL migrations
  pages/               Astro routes, including calendar.ics.ts
  components/          Astro components (no client framework)
  scripts/             sync CLI and background worker
  dev/                 write API mounted on the dev server only
```

Data flow: `sync` → provider adapters → validation → reconciliation → SQLite →
`getUpcomingContests()` → dashboard or `buildCalendar()` → `.ics`.

All times are stored and serialized in UTC. The dashboard renders them in your
local time zone.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `TERMIN_DB_PATH` | `.data/termin.db` | SQLite location; use `:memory:` for throwaway runs |
| `TERMIN_SYNC_INTERVAL_HOURS` | `24` | Interval for `npm run sync:worker` |

## Limitations

- Termin builds to static files, so writes (`participation`, `preferences`,
  **Sync**) are served by a dev-server integration (`src/dev/write-api.ts`)
  that `npm run build` does not include. A static build is read-only.
- Reminders are scheduled and stored, but no delivery channel is implemented
  yet. See the roadmap.
- Training imports and review actions need the dev server, like every other
  write. Submissions and the catalog are only imported for Codeforces.
- Migrations are forward-only. If a pre-1.0 database is incompatible, delete
  `.data/termin.db` and run `npm run sync` again.

## Contributing

Contributions are welcome, and adding a platform is a great first issue — each
adapter is roughly 40 lines. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
