/**
 * NocLense ChatGPT Prototype Backend
 *
 * Purpose:
 * - Provide OAuth + tool endpoints for GPT Actions testing
 * - Keep log analysis data-processing local to this service
 * - Avoid direct OpenAI API calls so ChatGPT can perform reasoning
 *
 * Notes:
 * - This is a temporary prototype with in-memory storage.
 * - Do not use as-is for production.
 */

import crypto from 'node:crypto';
import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT || 8788);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID || 'noclense-chatgpt-action';
const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET || 'replace-me';
const OAUTH_DEV_USER_ID = process.env.OAUTH_DEV_USER_ID || 'demo-user';
const OAUTH_ACCESS_TOKEN_TTL_SECONDS = Number(process.env.OAUTH_ACCESS_TOKEN_TTL_SECONDS || 3600);
const AUTH_MODE = process.env.AUTH_MODE || 'dev';
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || '';
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID || '';
const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET || '';
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || '';
const OIDC_AUTHORIZE_URL = process.env.OIDC_AUTHORIZE_URL || '';
const OIDC_TOKEN_URL = process.env.OIDC_TOKEN_URL || '';
const OIDC_USERINFO_URL = process.env.OIDC_USERINFO_URL || '';
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID || '';
const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || '';
const OIDC_SCOPE = process.env.OIDC_SCOPE || 'openid profile email';
const OIDC_AUDIENCE = process.env.OIDC_AUDIENCE || '';

/** @type {Map<string, { clientId: string; redirectUri: string; userId: string; scope: string; expiresAt: number }>} */
const authCodes = new Map();
/** @type {Map<string, { userId: string; clientId: string; scope: string; expiresAt: number }>} */
const accessTokens = new Map();
/** @type {Map<string, { clientId: string; redirectUri: string; scope: string; state: string; expiresAt: number }>} */
const pendingAuth = new Map();
/** @type {Map<string, { userId: string; sourceName: string; createdAt: number; rawText: string; lines: string[]; diagnostics: ReturnType<typeof buildDiagnostics> }>} */
const logsStore = new Map();

function nowMs() {
  return Date.now();
}

function generateId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
  });
  res.end(body);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    'content-type': 'text/plain; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
  });
  res.end(text);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseBearerToken(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null;
  return token;
}

function validateAccessToken(req) {
  const token = parseBearerToken(req);
  if (!token) return { ok: false, error: 'Missing bearer token.' };
  const session = accessTokens.get(token);
  if (!session) return { ok: false, error: 'Invalid bearer token.' };
  if (session.expiresAt < nowMs()) {
    accessTokens.delete(token);
    return { ok: false, error: 'Token expired.' };
  }
  return { ok: true, session };
}

function buildDiagnostics(lines) {
  let errorCount = 0;
  let warnCount = 0;
  const errorSamples = [];
  const warningSamples = [];
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.includes('ERROR')) {
      errorCount += 1;
      if (errorSamples.length < 20) errorSamples.push(line);
      continue;
    }
    if (upper.includes('WARN')) {
      warnCount += 1;
      if (warningSamples.length < 20) warningSamples.push(line);
    }
  }

  return {
    lineCount: lines.length,
    errorCount,
    warnCount,
    errorSamples,
    warningSamples,
  };
}

function sanitizeSourceName(name) {
  if (typeof name !== 'string' || !name.trim()) return 'uploaded-log';
  return name.trim().slice(0, 120);
}

function assertAuth0Config() {
  if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID || !AUTH0_CLIENT_SECRET) {
    return 'AUTH0_DOMAIN, AUTH0_CLIENT_ID, and AUTH0_CLIENT_SECRET are required for AUTH_MODE=auth0.';
  }
  return null;
}

function assertOidcConfig() {
  if (!OIDC_AUTHORIZE_URL || !OIDC_TOKEN_URL || !OIDC_USERINFO_URL || !OIDC_CLIENT_ID || !OIDC_CLIENT_SECRET) {
    return 'OIDC_AUTHORIZE_URL, OIDC_TOKEN_URL, OIDC_USERINFO_URL, OIDC_CLIENT_ID, and OIDC_CLIENT_SECRET are required for AUTH_MODE=oidc.';
  }
  return null;
}

async function exchangeAuth0CodeForUser(code) {
  const tokenUrl = `https://${AUTH0_DOMAIN}/oauth/token`;
  const callbackUrl = `${BASE_URL}/oauth/callback`;
  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: AUTH0_CLIENT_ID,
    client_secret: AUTH0_CLIENT_SECRET,
    code,
    redirect_uri: callbackUrl,
  });

  const tokenResp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: tokenBody.toString(),
  });
  if (!tokenResp.ok) {
    const details = await tokenResp.text();
    throw new Error(`Auth0 token exchange failed: ${details.slice(0, 300)}`);
  }

  const tokenJson = await tokenResp.json();
  const accessToken = tokenJson.access_token;
  if (!accessToken) {
    throw new Error('Auth0 token response missing access_token.');
  }

  const userInfoResp = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
    method: 'GET',
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!userInfoResp.ok) {
    const details = await userInfoResp.text();
    throw new Error(`Auth0 userinfo lookup failed: ${details.slice(0, 300)}`);
  }

  const profile = await userInfoResp.json();
  return String(profile.sub || profile.email || profile.name || 'auth0-user');
}

async function exchangeOidcCodeForUser(code) {
  const callbackUrl = `${BASE_URL}/oauth/callback`;
  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: OIDC_CLIENT_ID,
    client_secret: OIDC_CLIENT_SECRET,
    code,
    redirect_uri: callbackUrl,
  });

  const tokenResp = await fetch(OIDC_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: tokenBody.toString(),
  });
  if (!tokenResp.ok) {
    const details = await tokenResp.text();
    throw new Error(`OIDC token exchange failed: ${details.slice(0, 300)}`);
  }

  const tokenJson = await tokenResp.json();
  const accessToken = tokenJson.access_token;
  if (!accessToken) {
    throw new Error('OIDC token response missing access_token.');
  }

  const userInfoResp = await fetch(OIDC_USERINFO_URL, {
    method: 'GET',
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!userInfoResp.ok) {
    const details = await userInfoResp.text();
    throw new Error(`OIDC userinfo lookup failed: ${details.slice(0, 300)}`);
  }

  const profile = await userInfoResp.json();
  return String(profile.sub || profile.email || profile.name || 'oidc-user');
}

function routeOAuthAuthorize(req, res, requestUrl) {
  const responseType = requestUrl.searchParams.get('response_type');
  const clientId = requestUrl.searchParams.get('client_id');
  const redirectUri = requestUrl.searchParams.get('redirect_uri');
  const state = requestUrl.searchParams.get('state') || '';
  const scope = requestUrl.searchParams.get('scope') || 'logs.read logs.write';

  if (responseType !== 'code') {
    return sendJson(res, 400, { error: 'unsupported_response_type' });
  }
  if (!clientId || !redirectUri) {
    return sendJson(res, 400, { error: 'invalid_request', error_description: 'Missing client_id or redirect_uri.' });
  }
  if (clientId !== OAUTH_CLIENT_ID) {
    return sendJson(res, 401, { error: 'unauthorized_client' });
  }

  if (AUTH_MODE === 'auth0') {
    const configError = assertAuth0Config();
    if (configError) {
      return sendJson(res, 500, { error: 'server_error', error_description: configError });
    }

    const pendingId = generateId('pending');
    pendingAuth.set(pendingId, {
      clientId,
      redirectUri,
      scope,
      state,
      expiresAt: nowMs() + 10 * 60 * 1000,
    });

    const auth0Authorize = new URL(`https://${AUTH0_DOMAIN}/authorize`);
    auth0Authorize.searchParams.set('response_type', 'code');
    auth0Authorize.searchParams.set('client_id', AUTH0_CLIENT_ID);
    auth0Authorize.searchParams.set('redirect_uri', `${BASE_URL}/oauth/callback`);
    auth0Authorize.searchParams.set('scope', 'openid profile email');
    auth0Authorize.searchParams.set('state', pendingId);
    if (AUTH0_AUDIENCE) {
      auth0Authorize.searchParams.set('audience', AUTH0_AUDIENCE);
    }

    res.writeHead(302, { location: auth0Authorize.toString() });
    res.end();
    return;
  }

  if (AUTH_MODE === 'oidc') {
    const configError = assertOidcConfig();
    if (configError) {
      return sendJson(res, 500, { error: 'server_error', error_description: configError });
    }

    const pendingId = generateId('pending');
    pendingAuth.set(pendingId, {
      clientId,
      redirectUri,
      scope,
      state,
      expiresAt: nowMs() + 10 * 60 * 1000,
    });

    const oidcAuthorize = new URL(OIDC_AUTHORIZE_URL);
    oidcAuthorize.searchParams.set('response_type', 'code');
    oidcAuthorize.searchParams.set('client_id', OIDC_CLIENT_ID);
    oidcAuthorize.searchParams.set('redirect_uri', `${BASE_URL}/oauth/callback`);
    oidcAuthorize.searchParams.set('scope', OIDC_SCOPE);
    oidcAuthorize.searchParams.set('state', pendingId);
    if (OIDC_AUDIENCE) {
      oidcAuthorize.searchParams.set('audience', OIDC_AUDIENCE);
    }

    res.writeHead(302, { location: oidcAuthorize.toString() });
    res.end();
    return;
  }

  const code = generateId('code');
  authCodes.set(code, {
    clientId,
    redirectUri,
    userId: OAUTH_DEV_USER_ID,
    scope,
    expiresAt: nowMs() + 5 * 60 * 1000,
  });

  const redirect = new URL(redirectUri);
  redirect.searchParams.set('code', code);
  if (state) redirect.searchParams.set('state', state);
  res.writeHead(302, { location: redirect.toString() });
  res.end();
}

async function routeOAuthCallback(res, requestUrl) {
  if (AUTH_MODE !== 'auth0' && AUTH_MODE !== 'oidc') {
    return sendJson(res, 400, { error: 'invalid_request', error_description: 'Callback only used in AUTH_MODE=auth0 or AUTH_MODE=oidc.' });
  }

  const auth0Code = requestUrl.searchParams.get('code');
  const pendingId = requestUrl.searchParams.get('state');
  if (!auth0Code || !pendingId) {
    return sendJson(res, 400, { error: 'invalid_request', error_description: 'Missing code or state.' });
  }

  const pending = pendingAuth.get(pendingId);
  if (!pending) {
    return sendJson(res, 400, { error: 'invalid_request', error_description: 'Unknown state.' });
  }
  pendingAuth.delete(pendingId);
  if (pending.expiresAt < nowMs()) {
    return sendJson(res, 400, { error: 'invalid_request', error_description: 'Authorization state expired.' });
  }

  try {
    const userId = AUTH_MODE === 'auth0'
      ? await exchangeAuth0CodeForUser(auth0Code)
      : await exchangeOidcCodeForUser(auth0Code);
    const internalCode = generateId('code');
    authCodes.set(internalCode, {
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      userId,
      scope: pending.scope,
      expiresAt: nowMs() + 5 * 60 * 1000,
    });

    const redirect = new URL(pending.redirectUri);
    redirect.searchParams.set('code', internalCode);
    if (pending.state) {
      redirect.searchParams.set('state', pending.state);
    }
    res.writeHead(302, { location: redirect.toString() });
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth callback failed.';
    sendJson(res, 500, { error: 'server_error', error_description: message });
  }
}

async function routeOAuthToken(req, res) {
  const body = await readJsonBody(req);
  if (!body) return sendJson(res, 400, { error: 'invalid_request', error_description: 'Malformed JSON body.' });

  const grantType = body.grant_type;
  const clientId = body.client_id;
  const clientSecret = body.client_secret;

  if (clientId !== OAUTH_CLIENT_ID || clientSecret !== OAUTH_CLIENT_SECRET) {
    return sendJson(res, 401, { error: 'invalid_client' });
  }

  if (grantType !== 'authorization_code') {
    return sendJson(res, 400, { error: 'unsupported_grant_type' });
  }

  const code = body.code;
  const redirectUri = body.redirect_uri;
  const record = authCodes.get(code);
  if (!record) {
    return sendJson(res, 400, { error: 'invalid_grant' });
  }
  if (record.expiresAt < nowMs()) {
    authCodes.delete(code);
    return sendJson(res, 400, { error: 'invalid_grant', error_description: 'Authorization code expired.' });
  }
  if (record.redirectUri !== redirectUri) {
    return sendJson(res, 400, { error: 'invalid_grant', error_description: 'redirect_uri mismatch.' });
  }

  authCodes.delete(code);
  const accessToken = generateId('at');
  accessTokens.set(accessToken, {
    userId: record.userId,
    clientId,
    scope: record.scope,
    expiresAt: nowMs() + OAUTH_ACCESS_TOKEN_TTL_SECONDS * 1000,
  });

  return sendJson(res, 200, {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: OAUTH_ACCESS_TOKEN_TTL_SECONDS,
    scope: record.scope,
  });
}

async function routeSubmitLogs(req, res, session) {
  const body = await readJsonBody(req);
  if (!body) return sendJson(res, 400, { error: 'invalid_request', message: 'Malformed JSON body.' });

  const logText = typeof body.log_text === 'string' ? body.log_text : '';
  if (!logText.trim()) {
    return sendJson(res, 400, { error: 'invalid_request', message: 'log_text is required.' });
  }

  const lines = logText
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  const diagnostics = buildDiagnostics(lines);
  const logId = generateId('log');
  logsStore.set(logId, {
    userId: session.userId,
    sourceName: sanitizeSourceName(body.source_name),
    createdAt: nowMs(),
    rawText: logText,
    lines,
    diagnostics,
  });

  return sendJson(res, 200, {
    log_id: logId,
    source_name: sanitizeSourceName(body.source_name),
    line_count: diagnostics.lineCount,
    error_count: diagnostics.errorCount,
    warn_count: diagnostics.warnCount,
    guidance: 'Use /v1/logs/{log_id}/context next, then ask ChatGPT to analyze likely root causes.',
  });
}

function routeGetLogContext(res, session, logId) {
  const record = logsStore.get(logId);
  if (!record || record.userId !== session.userId) {
    return sendJson(res, 404, { error: 'not_found', message: 'Log not found.' });
  }

  return sendJson(res, 200, {
    log_id: logId,
    source_name: record.sourceName,
    created_at: new Date(record.createdAt).toISOString(),
    summary: {
      line_count: record.diagnostics.lineCount,
      error_count: record.diagnostics.errorCount,
      warn_count: record.diagnostics.warnCount,
    },
    top_error_lines: record.diagnostics.errorSamples,
    top_warning_lines: record.diagnostics.warningSamples,
    analysis_prompt: [
      'Analyze the summary and sample lines.',
      'Identify probable root causes and impacted components.',
      'Propose next troubleshooting steps with priority order.',
      'Call out assumptions and confidence level.',
    ].join(' '),
  });
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    return sendJson(res, 400, { error: 'invalid_request' });
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'authorization,content-type',
    });
    res.end();
    return;
  }

  const requestUrl = new URL(req.url, BASE_URL);
  const path = requestUrl.pathname;

  if (req.method === 'GET' && path === '/health') {
    return sendJson(res, 200, {
      ok: true,
      service: 'noclense-chatgpt-prototype',
      mode: 'gpt-actions-data-only',
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method === 'GET' && path === '/oauth/authorize') {
    return routeOAuthAuthorize(req, res, requestUrl);
  }

  if (req.method === 'GET' && path === '/oauth/callback') {
    return routeOAuthCallback(res, requestUrl);
  }

  if (req.method === 'POST' && path === '/oauth/token') {
    return routeOAuthToken(req, res);
  }

  const auth = validateAccessToken(req);
  if (!auth.ok) {
    return sendJson(res, 401, { error: 'unauthorized', message: auth.error });
  }
  const session = auth.session;

  if (req.method === 'POST' && path === '/v1/logs/submit') {
    return routeSubmitLogs(req, res, session);
  }

  if (req.method === 'GET' && /^\/v1\/logs\/[^/]+\/context$/.test(path)) {
    const parts = path.split('/');
    const logId = parts[3];
    return routeGetLogContext(res, session, logId);
  }

  return sendText(res, 404, 'Not found');
});

server.listen(PORT, () => {
  // Keep startup output clear for local setup and tunnel tools.
  console.log(`[chatgpt-prototype] listening on ${BASE_URL}`);
  console.log('[chatgpt-prototype] health endpoint: /health');
  console.log('[chatgpt-prototype] oauth endpoints: /oauth/authorize, /oauth/token');
  if (AUTH_MODE === 'auth0') {
    console.log('[chatgpt-prototype] auth mode: auth0');
    console.log('[chatgpt-prototype] oauth callback endpoint: /oauth/callback');
  } else if (AUTH_MODE === 'oidc') {
    console.log('[chatgpt-prototype] auth mode: oidc');
    console.log('[chatgpt-prototype] oauth callback endpoint: /oauth/callback');
  } else {
    console.log('[chatgpt-prototype] auth mode: dev');
  }
});
