import { createAuthClient, clearSessionCookies, getServerSession } from '../../src/session-auth.mjs';

function apiError(response, status, error) {
  return response.status(status).json({ error });
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return apiError(response, 405, 'METHOD_NOT_ALLOWED');
  }

  const session = await getServerSession(request, response);
  if (!session) return apiError(response, 401, 'UNAUTHORIZED');

  const supabase = createAuthClient();
  if (!supabase) return apiError(response, 503, 'AUTH_UNAVAILABLE');
  try {
    const { data, error } = await supabase.auth.getUser(session.accessToken);
    if (error || data?.user?.id !== session.identity.userId) {
      clearSessionCookies(request, response);
      return apiError(response, 401, 'UNAUTHORIZED');
    }
    return response.status(200).json({
      user: { id: data.user.id, email: data.user.email ?? '' },
    });
  } catch {
    return apiError(response, 502, 'AUTH_UNAVAILABLE');
  }
}
