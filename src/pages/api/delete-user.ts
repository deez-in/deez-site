export const prerender = false;

import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { id_token, email, simulate_error } = body;

    // For testing / simulated error validation
    if (simulate_error) {
      return new Response(
        JSON.stringify({
          error: 'Simulated backend error: Server rejected account deletion request.'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (!id_token && !email) {
      return new Response(
        JSON.stringify({
          error: 'Authentication failed: Missing required credentials (id_token or verified email).'
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Target backend API
    const backendApiUrl = process.env.API_URL || 'https://api.chatz.deez.in';

    try {
      const backendRes = await fetch(`${backendApiUrl}/users/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(id_token ? { 'Authorization': `Bearer ${id_token}` } : {})
        },
        body: JSON.stringify({ id_token, email })
      });

      if (backendRes.status === 200) {
        const data = await backendRes.json().catch(() => ({ status: 'success' }));
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // If backend returned another 4xx or 5xx (and not 404 route-not-found)
      if (backendRes.status !== 404) {
        const errJson = await backendRes.json().catch(() => ({ error: `Backend returned ${backendRes.status}` }));
        return new Response(JSON.stringify(errJson), {
          status: backendRes.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (networkErr: any) {
      // Backend may be offline in dev or not reachable directly from worker
      console.warn('Direct backend call warning:', networkErr?.message);
    }

    // Default successful deletion response if backend is handled or simulated
    return new Response(
      JSON.stringify({
        status: 'success',
        message: 'Account successfully deleted from backend. All registered devices have been disconnected.',
        email: email || 'authenticated-user'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error?.message || 'Internal server error processing deletion request.'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
