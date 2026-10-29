import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkPassword,
  createSessionToken,
  isAuthenticated,
  isSecureRequest,
  readSessionCookie,
  serializeSessionCookie,
  SESSION_MAX_AGE_SECONDS,
  verifySessionToken,
} from "./session";

beforeEach(() => {
  vi.stubEnv("TERMIN_SECRET", "test-secret");
  vi.stubEnv("TERMIN_PASSWORD", "correct horse");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("session tokens", () => {
  it("accepts a fresh token", () => {
    const now = Date.now();

    expect(verifySessionToken(createSessionToken(now), now)).toBe(true);
  });

  it("rejects an expired token", () => {
    const now = Date.now();
    const expired = createSessionToken(
      now - SESSION_MAX_AGE_SECONDS * 1000 - 1000
    );

    expect(verifySessionToken(expired, now)).toBe(false);
  });

  it("rejects a tampered signature", () => {
    const token = createSessionToken();
    const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;

    expect(verifySessionToken(tampered)).toBe(false);
  });

  it("rejects a tampered expiry", () => {
    const now = Date.now();
    const token = createSessionToken(now);
    const [expiry, signature] = token.split(".");
    const extended = String(Number(expiry) + 86_400_000);

    expect(verifySessionToken(`${extended}.${signature}`, now)).toBe(false);
  });

  it("rejects a token signed with another secret", () => {
    const token = createSessionToken();

    vi.stubEnv("TERMIN_SECRET", "different-secret");

    expect(verifySessionToken(token)).toBe(false);
  });

  it("rejects malformed values", () => {
    expect(verifySessionToken(undefined)).toBe(false);
    expect(verifySessionToken("")).toBe(false);
    expect(verifySessionToken("not-a-token")).toBe(false);
    expect(verifySessionToken(".signature")).toBe(false);
    expect(verifySessionToken("123.abc")).toBe(false);
  });
});

describe("cookies", () => {
  it("reads the session cookie among others", () => {
    expect(
      readSessionCookie("theme=dark; termin_session=abc.def; other=1")
    ).toBe("abc.def");
  });

  it("returns null when the cookie is absent", () => {
    expect(readSessionCookie(null)).toBeNull();
    expect(readSessionCookie("theme=dark")).toBeNull();
  });

  it("serialises an HttpOnly, SameSite cookie", () => {
    const cookie = serializeSessionCookie("abc.def", true);

    expect(cookie).toContain("termin_session=abc.def");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain(`Max-Age=${SESSION_MAX_AGE_SECONDS}`);
  });

  it("omits Secure when the request is plain HTTP", () => {
    expect(serializeSessionCookie("abc", false)).not.toContain("Secure");
  });
});

describe("request authentication", () => {
  it("authenticates a request carrying a valid cookie", () => {
    const token = createSessionToken();
    const request = new Request("http://localhost/", {
      headers: { cookie: `termin_session=${token}` },
    });

    expect(isAuthenticated(request)).toBe(true);
  });

  it("rejects a request without a valid cookie", () => {
    expect(isAuthenticated(new Request("http://localhost/"))).toBe(false);
  });

  it("detects HTTPS behind the proxy header", () => {
    expect(
      isSecureRequest(
        new Request("http://internal/", {
          headers: { "x-forwarded-proto": "https" },
        })
      )
    ).toBe(true);

    expect(isSecureRequest(new Request("http://localhost/"))).toBe(false);
  });
});

describe("password check", () => {
  it("accepts the configured password", () => {
    expect(checkPassword("correct horse")).toBe(true);
  });

  it("rejects a wrong or differently sized password", () => {
    expect(checkPassword("wrong")).toBe(false);
    expect(checkPassword("correct hors")).toBe(false);
  });

  it("rejects everything when no password is configured", () => {
    vi.stubEnv("TERMIN_PASSWORD", "");

    expect(checkPassword("")).toBe(false);
  });
});
