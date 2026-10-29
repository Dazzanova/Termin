import type { APIRoute } from "astro";
import {
  savePreferences,
  saveSubmittedPlatforms,
} from "../../lib/preferences/repository";
import type { UserPreferences } from "../../lib/preferences/types";
import { json, readJson, rejectCrossOrigin } from "../../lib/http/api";

export const POST: APIRoute = async ({ request }) => {
  const rejection = rejectCrossOrigin(request);
  if (rejection) return rejection;

  const accepts = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    await saveSubmittedPlatforms(form.getAll("platforms"));

    if (accepts.includes("application/json")) {
      return json({ ok: true, redirect: "/" });
    }

    return new Response(null, { status: 303, headers: { Location: "/" } });
  }

  let body: Record<string, unknown>;
  try {
    body = await readJson(request);
  } catch {
    return json({ error: "Malformed JSON" }, 400);
  }

  await savePreferences(body as Partial<UserPreferences>);

  return json({ ok: true });
};
