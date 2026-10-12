import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from './verify-login.mjs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));
const ACCESS_COOKIE = 'vault_access';
const REFRESH_COOKIE = 'vault_refresh';
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
let verifyLogin;

export function createAuthClient() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) return null;
  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function getLoginVerifier() {
  verifyLogin ??= createLoginVerifier({
    config,
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
  });
  return verifyLogin;
}

function readCookies(request) {
  const header = request.headers?.cookie ?? request.headers?.Cookie ?? '';
  const cookies = new Map();
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try { cookies.set(name, decodeURIComponent(value)); } catch { cookies.set(name, value); }
  }
  return {
    accessToken: cookies.get(ACCESS_COOKIE) ?? null,
    refreshToken: cookies.get(REFRESH_COOKIE) ?? null,
  };
}

function secureCookie(request) {
  const forwarded = request.headers?.['x-forwarded-proto'];
  return String(forwarded ?? '').split(',')[0].trim().toLowerCase() === 'https'
    || request.socket?.encrypted === true;
}

function appendSetCookie(response, values) {
  const existing = response.getHeader('Set-Cookie');
  const headers = Array.isArray(existing) ? existing : existing ? [existing] : [];
  response.setHeader('Set-Cookie', [...headers, ...values]);
}

export function setSessionCookies(request, response, session) {
  if (typeof session?.access_token !== 'string' || typeof session?.refresh_token !== 'string') return;
  const secure = secureCookie(request) ? '; Secure' : '';
  const accessAge = Math.max(60, Math.min(86400, Number(session.expires_in) || 3600));
  const base = `Path=/; HttpOnly; SameSite=Lax${secure}`;
  appendSetCookie(response, [
    `${ACCESS_COOKIE}=${encodeURIComponent(session.access_token)}; ${base}; Max-Age=${accessAge}`,
    `${REFRESH_COOKIE}=${encodeURIComponent(session.refresh_token)}; ${base}; Max-Age=${REFRESH_COOKIE_MAX_AGE}`,
  ]);
}

export function clearSessionCookies(request, response) {
  const secure = secureCookie(request) ? '; Secure' : '';
  const base = `Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  appendSetCookie(response, [`${ACCESS_COOKIE}=; ${base}`, `${REFRESH_COOKIE}=; ${base}`]);
}

async function verifiedIdentity(accessToken) {
  try {
    const identity = await getLoginVerifier()(`Bearer ${accessToken}`);
    return identity?.kind === 'student' ? identity : null;
  } catch {
    return null;
  }
}

export async function getServerSession(request, response) {
  const authorization = request.headers?.authorization ?? request.headers?.Authorization;
  if (typeof authorization === 'string' && authorization) {
    const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/u.exec(authorization);
    if (!match) return null;
    const identity = await verifiedIdentity(match[1]);
    return identity ? { identity, accessToken: match[1], refreshToken: null } : null;
  }

  const cookies = readCookies(request);
  if (cookies.accessToken) {
    const identity = await verifiedIdentity(cookies.accessToken);
    if (identity) return { identity, ...cookies };
  }
  if (!cookies.refreshToken) {
    if (cookies.accessToken) clearSessionCookies(request, response);
    return null;
  }

  const supabase = createAuthClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: cookies.refreshToken });
    const session = data?.session;
    if (error || !session) {
      clearSessionCookies(request, response);
      return null;
    }
    const identity = await verifiedIdentity(session.access_token);
    if (!identity) {
      clearSessionCookies(request, response);
      return null;
    }
    setSessionCookies(request, response, session);
    return { identity, accessToken: session.access_token, refreshToken: session.refresh_token };
  } catch {
    return null;
  }
}
