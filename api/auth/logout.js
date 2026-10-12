import { createAuthClient, clearSessionCookies, getServerSession } from '../../src/session-auth.mjs';

function apiError(response, status, error) {
  return response.status(status).json({ error });
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return apiError(response, 405, 'METHOD_NOT_ALLOWED');
  }

  const session = await getServerSession(request, response);
  const supabase = createAuthClient();
  if (session && supabase && session.refreshToken) {
    try {
      const { error } = await supabase.auth.setSession({
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
      });
      if (!error) await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Clear this browser's cookies even if Supabase sign-out is unavailable.
    }
  }

  clearSessionCookies(request, response);
  return response.status(200).json({ ok: true });
}
