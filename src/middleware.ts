import { defineMiddleware } from "astro:middleware";
import {
  isAuthEnabled,
  isAuthenticated,
  readSessionCookie,
  verifySessionToken,
} from "./lib/auth/session";
import { isDemoMode } from "./lib/demo";
import { ready } from "./lib/db/database";
import { isCrossOrigin, json } from "./lib/http/api";

const PUBLIC_PATHS = new Set(["/login", "/api/login", "/robots.txt"]);

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/_astro/") ||
    pathname.startsWith("/favicon") ||
    // Public contest schedules, so calendar clients can subscribe without a
    // session. They contain no imported or personal data.
    pathname === "/calendar.ics" ||
    pathname.startsWith("/calendar/")
  );
}

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const onRequest = defineMiddleware(async (context, next) => {
  await ready();

  if (
    UNSAFE_METHODS.has(context.request.method) &&
    isCrossOrigin(context.request)
  ) {
    return json({ error: "Cross-origin request rejected" }, 403);
  }

  const { pathname, search } = context.url;

  if (isPublic(pathname)) {
    return next();
  }

  if (!isAuthEnabled()) {
    // Local development runs without a password. A built server must not.
    if (import.meta.env.PROD && !isDemoMode()) {
      return new Response(
        "TERMIN_PASSWORD is not set. Configure it before serving Termin.",
        { status: 500, headers: { "Content-Type": "text/plain" } }
      );
    }

    return next();
  }

  const token = readSessionCookie(context.request.headers.get("cookie"));

  if (verifySessionToken(token)) {
    return next();
  }

  if (pathname.startsWith("/api/")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const nextPath = safeNext(`${pathname}${search}`);

  return context.redirect(`/login?next=${encodeURIComponent(nextPath)}`);
});
