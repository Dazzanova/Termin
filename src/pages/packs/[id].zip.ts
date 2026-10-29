import type { APIRoute } from "astro";
import { getUpcomingContests } from "../../lib/contests/getUpcomingContests";
import { listPacks } from "../../lib/packs/build";
import { createZip } from "../../lib/packs/zip";
import { listProblems } from "../../lib/training/repository";

async function allPacks() {
  return listPacks(
    await getUpcomingContests(),
    await listProblems("codeforces")
  );
}

export const GET: APIRoute = async ({ params }) => {
  const pack = (await allPacks()).find((entry) => entry.id === params.id);

  if (!pack) {
    return new Response("Pack not found", { status: 404 });
  }

  const bytes = createZip(pack.files, pack.folder);

  return new Response(bytes, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${pack.folder}.zip"`,
      "Content-Length": String(bytes.byteLength),
    },
  });
};
