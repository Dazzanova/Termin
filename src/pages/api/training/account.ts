import type { APIRoute } from "astro";
import { isDemoMode } from "../../../lib/demo";
import { importCodeforcesData } from "../../../lib/training/import";
import { saveAccount } from "../../../lib/training/repository";
import { json, readJson, rejectCrossOrigin } from "../../../lib/http/api";

export const POST: APIRoute = async ({ request }) => {
  const rejection = rejectCrossOrigin(request);
  if (rejection) return rejection;

  if (isDemoMode()) {
    return json({ error: "Imports are disabled in demo mode" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await readJson(request);
  } catch {
    return json({ error: "Malformed JSON" }, 400);
  }

  const { handle } = body;

  if (typeof handle !== "string" || !handle.trim()) {
    return json({ error: "Invalid handle" }, 400);
  }

  const trimmed = handle.trim();

  try {
    await saveAccount(trimmed);
    const summary = await importCodeforcesData(trimmed);

    return json({
      ok: true,
      problems: summary.problems,
      submissions: summary.submissions,
      solved: summary.solved,
      queuedReviews: summary.queuedReviews,
      closedReviews: summary.closedReviews,
      importedAt: summary.importedAt.toISOString(),
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Import failed" },
      502
    );
  }
};
