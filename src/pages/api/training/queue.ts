import type { APIRoute } from "astro";
import { ensureReview, getProblem } from "../../../lib/training/repository";
import { json, readJson, rejectCrossOrigin } from "../../../lib/http/api";

export const POST: APIRoute = async ({ request }) => {
  const rejection = rejectCrossOrigin(request);
  if (rejection) return rejection;

  let body: Record<string, unknown>;
  try {
    body = await readJson(request);
  } catch {
    return json({ error: "Malformed JSON" }, 400);
  }

  const { problemId } = body;

  if (typeof problemId !== "string" || !problemId) {
    return json({ error: "Invalid problemId" }, 400);
  }

  if (!(await getProblem(problemId))) {
    return json({ error: "Problem not found" }, 404);
  }

  const created = await ensureReview(problemId);

  return json({ ok: true, alreadyTracked: !created });
};
