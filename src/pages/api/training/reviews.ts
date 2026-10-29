import type { APIRoute } from "astro";
import { applyReviewAction } from "../../../lib/training/repository";
import type { ReviewAction } from "../../../lib/training/types";
import { json, readJson, rejectCrossOrigin } from "../../../lib/http/api";

const ACTIONS: ReviewAction[] = ["solved", "again", "drop"];

export const POST: APIRoute = async ({ request }) => {
  const rejection = rejectCrossOrigin(request);
  if (rejection) return rejection;

  let body: Record<string, unknown>;
  try {
    body = await readJson(request);
  } catch {
    return json({ error: "Malformed JSON" }, 400);
  }

  const { problemId, action } = body;

  if (
    typeof problemId !== "string" ||
    !ACTIONS.includes(action as ReviewAction)
  ) {
    return json({ error: "Invalid review action" }, 400);
  }

  const review = await applyReviewAction(problemId, action as ReviewAction);

  if (!review) {
    return json({ error: "Review not found" }, 404);
  }

  return json({ ok: true, status: review.status });
};
