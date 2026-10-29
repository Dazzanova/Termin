import type { APIRoute } from "astro";
import {
  checkPassword,
  createSessionToken,
  isAuthEnabled,
  isSecureRequest,
  serializeSessionCookie,
} from "../../lib/auth/session";
import { json, rejectCrossOrigin } from "../../lib/http/api";

function safeNext(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }

  return value;
}

async function readCredentials(
  request: Request
): Promise<{ password: string; next: string }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as {
      password?: unknown;
      next?: unknown;
    };

    return {
      password: typeof body.password === "string" ? body.password : "",
      next: safeNext(body.next),
    };
  }

  const form = await request.formData();
  const password = form.get("password");

  return {
    password: typeof password === "string" ? password : "",
    next: safeNext(form.get("next")),
  };
}

export const POST: APIRoute = async ({ request }) => {
  const rejection = rejectCrossOrigin(request);
  if (rejection) return rejection;

  if (!isAuthEnabled()) {
    return json({ error: "Authentication is not configured" }, 500);
  }

  let password: string;
  let next: string;

  try {
    ({ password, next } = await readCredentials(request));
  } catch {
    return json({ error: "Malformed request" }, 400);
  }

  const acceptsJson = (request.headers.get("accept") ?? "").includes(
    "application/json"
  );

  if (!checkPassword(password)) {
    if (acceptsJson) {
      return json({ error: "Wrong password" }, 401);
    }

    return new Response(null, {
      status: 303,
      headers: {
        Location: `/login?error=1&next=${encodeURIComponent(next)}`,
      },
    });
  }

  const token = createSessionToken();
  const secure = isSecureRequest(request);

  if (acceptsJson) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": serializeSessionCookie(token, secure),
      },
    });
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: next,
      "Set-Cookie": serializeSessionCookie(token, secure),
    },
  });
};
