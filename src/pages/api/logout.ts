import type { APIRoute } from "astro";
import {
  clearSessionCookie,
  isSecureRequest,
} from "../../lib/auth/session";
import { rejectCrossOrigin } from "../../lib/http/api";

export const POST: APIRoute = async ({ request }) => {
  const rejection = rejectCrossOrigin(request);
  if (rejection) return rejection;

  return new Response(null, {
    status: 303,
    headers: {
      Location: "/login",
      "Set-Cookie": clearSessionCookie(isSecureRequest(request)),
    },
  });
};
