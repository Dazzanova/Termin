/**
 * Termin renders every route at build time, so the shipped site is a
 * read-only snapshot. `npm run demo` runs the dev server against seeded
 * fixtures instead, and sets this flag so the interface can say so.
 */
export function isDemoMode(): boolean {
  return process.env.TERMIN_DEMO === "1";
}
