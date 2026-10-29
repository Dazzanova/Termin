import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "termin_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secret(): string {
  return process.env.TERMIN_SECRET || process.env.TERMIN_PASSWORD || "";
}

function sign(expiry: string): string {
  return createHmac("sha256", secret()).update(expiry).digest("base64url");
}

/** `<expiry>.<hmac>`; expiry is a millisecond timestamp. */
export function createSessionToken(now: number = Date.now()): string {
  const expiry = String(now + SESSION_MAX_AGE_SECONDS * 1000);
  return `${expiry}.${sign(expiry)}`;
}

export function verifySessionToken(
  token: string | null | undefined,
  now: number = Date.now()
): boolean {
  if (!token) {
    return false;
  }

  const separator = token.lastIndexOf(".");

  if (separator <= 0) {
    return false;
  }

  const expiry = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  if (!/^\d+$/.test(expiry) || Number(expiry) <= now) {
    return false;
  }

  const expected = Buffer.from(sign(expiry));
  const provided = Buffer.from(signature);

  return (
    expected.length === provided.length && timingSafeEqual(expected, provided)
  );
}

/** Constant-time comparison against TERMIN_PASSWORD. */
export function checkPassword(input: string): boolean {
  const expected = process.env.TERMIN_PASSWORD;

  if (!expected) {
    return false;
  }

  const expectedBytes = Buffer.from(expected);
  const inputBytes = Buffer.from(input);

  if (expectedBytes.length !== inputBytes.length) {
    // Keep the comparison cost independent of where the length diverges.
    timingSafeEqual(expectedBytes, expectedBytes);
    return false;
  }

  return timingSafeEqual(expectedBytes, inputBytes);
}

export function isAuthEnabled(): boolean {
  return Boolean(process.env.TERMIN_PASSWORD);
}

export function readSessionCookie(
  cookieHeader: string | null
): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");

    if (name === SESSION_COOKIE) {
      return rest.join("=");
    }
  }

  return null;
}

export function isAuthenticated(request: Request): boolean {
  return verifySessionToken(
    readSessionCookie(request.headers.get("cookie"))
  );
}

export function isSecureRequest(request: Request): boolean {
  return (
    request.headers.get("x-forwarded-proto") === "https" ||
    new URL(request.url).protocol === "https:"
  );
}

export function serializeSessionCookie(
  token: string,
  secure: boolean
): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearSessionCookie(secure: boolean): string {
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}
