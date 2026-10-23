import type { APIRoute } from 'astro';
import { savePreferences } from '../../lib/preferences/repository';
import type { UserPreferences } from '../../lib/preferences/types';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const preferences: UserPreferences = body;

    savePreferences(preferences);

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
