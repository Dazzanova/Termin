import { describe, expect, it } from "vitest";
import { isCrossOrigin, rejectCrossOrigin } from "./api";

function post(headers: Record<string, string>): Request {
  return new Request("http://localhost:4321/api/preferences", {
    method: "POST",
    headers,
  });
}

describe("isCrossOrigin", () => {
  it("allows requests without an Origin", () => {
    expect(isCrossOrigin(post({ host: "termin.example" }))).toBe(false);
  });

  it("allows a matching Origin", () => {
    expect(
      isCrossOrigin(
        post({ host: "termin.example", origin: "https://termin.example" })
      )
    ).toBe(false);
  });

  it("ignores the scheme, because the proxy terminates TLS", () => {
    expect(
      isCrossOrigin(
        post({ host: "termin.example", origin: "https://termin.example" })
      )
    ).toBe(false);
    expect(
      isCrossOrigin(
        post({ host: "termin.example", origin: "http://termin.example" })
      )
    ).toBe(false);
  });

  it("rejects a different host", () => {
    expect(
      isCrossOrigin(
        post({ host: "termin.example", origin: "https://evil.example" })
      )
    ).toBe(true);
  });

  it("rejects a different port", () => {
    expect(
      isCrossOrigin(
        post({ host: "termin.example", origin: "https://termin.example:8443" })
      )
    ).toBe(true);
  });

  it("prefers the forwarded host when a proxy sets one", () => {
    expect(
      isCrossOrigin(
        post({
          host: "localhost:10000",
          "x-forwarded-host": "termin.example",
          origin: "https://termin.example",
        })
      )
    ).toBe(false);
  });

  it("takes the first entry of a forwarded host list", () => {
    expect(
      isCrossOrigin(
        post({
          host: "localhost:10000",
          "x-forwarded-host": "termin.example, proxy.internal",
          origin: "https://termin.example",
        })
      )
    ).toBe(false);
  });

  it("rejects an opaque Origin", () => {
    expect(isCrossOrigin(post({ host: "termin.example", origin: "null" }))).toBe(
      true
    );
  });
});

describe("rejectCrossOrigin", () => {
  it("returns null for a same-origin request", () => {
    expect(
      rejectCrossOrigin(
        post({ host: "termin.example", origin: "https://termin.example" })
      )
    ).toBeNull();
  });

  it("returns a 403 for a cross-origin request", () => {
    const response = rejectCrossOrigin(
      post({ host: "termin.example", origin: "https://evil.example" })
    );

    expect(response?.status).toBe(403);
  });
});
