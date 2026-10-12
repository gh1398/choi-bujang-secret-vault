import { createAuthClient, setSessionCookies } from '../../src/session-auth.mjs';

function apiError(response, status, error, message) {
  return response.status(status).json({ error, ...(message ? { message } : {}) });
}

function parseBody(request) {
  let body = request.body;
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return null; }
  }
  return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return apiError(response, 405, 'METHOD_NOT_ALLOWED');
  }

  const body = parseBody(request);
  if (typeof body?.email !== 'string' || !body.email.trim()
      || body.email.length > 320 || typeof body.password !== 'string'
      || !body.password || body.password.length > 1024) {
    return apiError(response, 400, 'INVALID_CREDENTIALS');
  }

  const supabase = createAuthClient();
  if (!supabase) return apiError(response, 503, 'AUTH_UNAVAILABLE');

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email.trim(), password: body.password,
    });
    if (error || !data?.session || !data.user) {
      return apiError(response, 401, 'AUTH_FAILED', error?.message ?? '로그인에 실패했습니다.');
    }
    setSessionCookies(request, response, data.session);
    return response.status(200).json({
      user: { id: data.user.id, email: data.user.email ?? '' },
    });
  } catch {
    return apiError(response, 502, 'AUTH_UNAVAILABLE');
  }
}
