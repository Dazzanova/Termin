# Contributing to Termin

Thanks for helping out. Termin is a small, dependency-light project, so most
changes are a single focused file plus a test.

## Setup

Requires Node 22.12 or newer.

```bash
git clone https://github.com/Dazzanova/Termin.git
cd Termin
npm install
npm run sync   # optional: fetch real contests so the dashboard is not empty
npm run dev    # http://localhost:4321
```

## Before every pull request

```bash
npm test          # Vitest, runs against an in-memory SQLite database
npm run build     # must produce dist/ without errors
```

Both commands run in CI. A pull request that fails either one will not be
merged.

## Adding a platform

This is the best first contribution: each adapter is about 40 lines and fully
isolated. A new platform touches the following places.

1. **Create the adapter** at
   `src/lib/contests/providers/<platform>.ts`, exporting a function that returns
   `Promise<Contest[]>`. Follow `providers/codechef.ts`:

   ```ts
   import type { Contest } from "../types";

   export async function getExampleContests(): Promise<Contest[]> {
     const response = await fetch("https://example.com/api/contests");

     if (!response.ok) {
       throw new Error(`Example returned ${response.status}`);
     }

     const data = (await response.json()) as ExampleResponse;

     return data.contests.map((contest) => ({
       id: `example:${contest.id}`,
       platform: "example",
       name: contest.name,
       startTime: new Date(contest.start),
       durationSeconds: contest.durationMinutes * 60,
       url: contest.url,
     }));
   }
   ```

   Always use a stable, prefixed `id` (`platform:native-id`) — it is the
   primary key, the calendar `UID`, and the participation key. Read
   `src/lib/contests/providers/` for the four existing adapters.

2. **Add the platform to the type union** in
   `src/lib/contests/types.ts` (`ContestPlatform`).

3. **Register it** in `SUPPORTED_PLATFORMS` in
   `src/lib/preferences/types.ts`. Validation and the calendar routes read from
   this list, so no other backend change is needed.

4. **Wire it into sync** by adding an entry to the `providers` array in
   `src/lib/contests/sync.ts`.

5. **Add a display label** to `PLATFORM_LABELS` in
   `src/lib/calendar/ics.ts`, then to the UI maps in
   `src/pages/settings.astro`, `src/pages/planning.astro`, and
   `src/components/ContestCard.astro`.

6. **Add tests.** At minimum, cover the provider's parsing by mocking `fetch`
   and asserting the mapping to `Contest`, including one malformed payload. See
   `src/lib/contests/validate.test.ts` and
   `src/lib/contests/sync.test.ts` for patterns.

Keep adapters tolerant: throw on network or status errors and let the sync layer
skip the provider. Never return fabricated contests.

## Database changes

Migrations live in `src/lib/db/migrations/` as numbered `.sql` files and are
applied once, in name order, inside a transaction. To change the schema:

1. Add `003_your_change.sql` (never edit an applied migration).
2. Baseline table creation stays in `src/lib/db/database.ts`; migrations are for
   changes after the baseline.
3. Add a test if the change is not covered by an existing one.

Tests use `TERMIN_DB_PATH=:memory:` (set in `vitest.config.ts`), so they never
touch your local `.data/termin.db`.

## Style

- TypeScript everywhere; no client-side framework. Interactive behaviour goes in
  an Astro `<script>` block or a small `.astro` component.
- Keep functions pure where possible — `src/lib/calendar/ics.ts` and
  `src/lib/contests/recommendations.ts` are the model.
- Prefer `async`/`await` over `.then()`.
- Commit messages follow the existing conventional style: `feat:`, `fix:`,
  `refactor:`, `test:`, `docs:`, `chore:`.
- Formatting is two spaces, double quotes, semicolons.

## Pull request checklist

- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] New behaviour has a test.
- [ ] No secrets, tokens, or personal data in the diff.
- [ ] The README still describes what the code does.

## Reporting bugs and ideas

Use the issue templates. For a new platform, include the public API endpoint and
a sample response. For a bug, include the command you ran, what you expected, and
what happened.
