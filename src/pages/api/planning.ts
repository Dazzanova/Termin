import type { APIRoute } from 'astro';
import { toggleContestPriority } from '../../lib/contests/repository';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { contestId, isPrioritized } = body;

    if (!contestId || typeof contestId !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid contestId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    toggleContestPriority(contestId, !!isPrioritized);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
