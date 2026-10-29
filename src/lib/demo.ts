/**
 * `npm run demo` seeds a disposable database and sets this flag so the
 * interface can label itself as demo data and block writes that would hit
 * external APIs.
 */
export function isDemoMode(): boolean {
  return process.env.TERMIN_DEMO === "1";
}
