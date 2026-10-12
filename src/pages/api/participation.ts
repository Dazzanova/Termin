import type { APIRoute } from 'astro';
import { saveParticipationStatus } from '../../lib/contests/repository';
import type { ParticipationStatus } from '../../lib/contests/types';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => {
      throw new Error('Malformed JSON');
    });
    const { contestId, status } = body;

    if (!contestId || typeof contestId !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid contestId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const validStatuses: (ParticipationStatus | '')[] = ['planned', 'participated', 'skipped', ''];
    if (status === undefined || !validStatuses.includes(status)) {
      return new Response(JSON.stringify({ error: 'Invalid status' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    saveParticipationStatus(contestId, status || null);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    if (err.message === 'Malformed JSON') {
      return new Response(JSON.stringify({ error: 'Malformed JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
