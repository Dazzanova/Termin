export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function readJson(
  request: Request
): Promise<Record<string, unknown>> {
  const value = await request.json();

  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Browsers send `Origin` on cross-site and same-site POSTs. A mismatch means
 * the request did not come from a page we served, so a write endpoint refuses
 * it. Requests without an Origin (curl, scripts) are allowed.
 *
 * Only the host is compared, never the scheme: the app runs behind a proxy
 * that terminates TLS, so the request reaches us over plain HTTP while the
 * browser still sends an `https` Origin.
 */
export function isCrossOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  const forwarded = request.headers.get("x-forwarded-host");
  const host = (forwarded ?? request.headers.get("host") ?? "")
    .split(",")[0]
    .trim();

  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export function rejectCrossOrigin(request: Request): Response | null {
  return isCrossOrigin(request)
    ? json({ error: "Cross-origin request rejected" }, 403)
    : null;
}
