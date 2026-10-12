import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '../src/session-auth.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

async function authenticatedUser(request, response) {
  const session = await getServerSession(request, response);
  return session?.identity?.kind === 'student' ? session.identity : null;
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) return null;
  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function parseBody(request) {
  let body = request.body;
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return null; }
  }
  return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
}

function validFields(body) {
  return typeof body?.title === 'string' && body.title.trim().length > 0
    && body.title.trim().length <= 120
    && typeof body?.body === 'string' && body.body.trim().length > 0
    && body.body.length <= 10000;
}

function apiError(response, status, error) {
  return response.status(status).json({ error });
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return apiError(response, 405, 'METHOD_NOT_ALLOWED');
  }

  const identity = await authenticatedUser(request, response);
  if (!identity) return apiError(response, 401, 'UNAUTHORIZED');

  const supabase = getSupabase();
  if (!supabase) return apiError(response, 503, 'NOTES_UNAVAILABLE');

  try {
    if (request.method === 'GET') {
      const { data, error } = await supabase
        .from('learning_notes')
        .select('id, title, content')
        .eq('owner_id', identity.userId)
        .order('created_at', { ascending: true });
      if (error) return apiError(response, 502, 'NOTES_UNAVAILABLE');
      return response.status(200).json((data || []).map(note => ({
        id: note.id, title: note.title, body: note.content,
      })));
    }

    const body = parseBody(request);
    if (!validFields(body)) return apiError(response, 400, 'INVALID_NOTE');
    if (body.id !== undefined && (typeof body.id !== 'string' || !UUID.test(body.id))) {
      return apiError(response, 400, 'INVALID_NOTE_ID');
    }

    const id = body.id ?? randomUUID();
    const { data, error } = await supabase
      .from('learning_notes')
      .insert({ id, owner_id: identity.userId, title: body.title.trim(), content: body.body.trim() })
      .select('id')
      .single();
    if (error) return apiError(response, error.code === '23505' ? 409 : 502,
      error.code === '23505' ? 'ID_CONFLICT' : 'NOTES_UNAVAILABLE');
    return response.status(201).json({ id: data.id });
  } catch {
    return apiError(response, 500, 'NOTES_UNAVAILABLE');
  }
}
