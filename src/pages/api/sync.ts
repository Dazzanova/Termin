import type { APIRoute } from 'astro';
import { syncContests } from '../../lib/contests/sync';

// One sync per server process. `syncContests` never rejects on a provider
// failure, so this guard only trips on genuinely concurrent requests.
let isSyncing = false;

export const POST: APIRoute = async () => {
  if (isSyncing) {
    return new Response(
      JSON.stringify({ error: 'A sync is already running' }),
      {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  isSyncing = true;

  try {
    const result = await syncContests();

    return new Response(
      JSON.stringify({
        ok: result.failedProviders.length === 0,
        synced: result.contests.length,
        changes: result.changes.length,
        failedProviders: result.failedProviders,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Sync failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    isSyncing = false;
  }
};
