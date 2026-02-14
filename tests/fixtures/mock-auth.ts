/**
 * Mock MSAL authentication for E2E tests.
 *
 * Generates MSAL Browser v3 cache entries that make PublicClientApplication
 * recognize a cached, authenticated user — no real Microsoft login required.
 *
 * Usage:
 *   const entries = buildMsalCache();
 *   for (const [key, value] of Object.entries(entries)) {
 *     localStorage.setItem(key, value);
 *   }
 */

const CLIENT_ID = '973b689d-d96c-4445-883b-739fff12330b';
const TENANT_ID = 'aee0257d-3be3-45ae-806b-65c972c98dfb';
const ENVIRONMENT = 'login.microsoftonline.com';

// Fake user identity
const OID = '00000000-0000-0000-0000-000000e2etest';
const HOME_ACCOUNT_ID = `${OID}.${TENANT_ID}`;
const USERNAME = 'e2etest@mitigationconsulting.com';
const DISPLAY_NAME = 'E2E Test User';

/** base64url encode (no padding) */
function b64url(obj: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Build a minimal JWT that MSAL can parse for claims */
function fakeJwt(claims: Record<string, unknown>): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  return `${b64url(header)}.${b64url(claims)}.fake-sig`;
}

/**
 * Build a complete set of localStorage entries that MSAL Browser v3
 * will read as a valid cached session.
 */
export function buildMsalCache(): Record<string, string> {
  const now = Math.floor(Date.now() / 1000);
  const entries: Record<string, string> = {};

  // ── Account cache entry ──────────────────────────────
  const accountKey = `${HOME_ACCOUNT_ID}-${ENVIRONMENT}-${TENANT_ID}`;
  entries[accountKey] = JSON.stringify({
    homeAccountId: HOME_ACCOUNT_ID,
    environment: ENVIRONMENT,
    realm: TENANT_ID,
    localAccountId: OID,
    username: USERNAME,
    name: DISPLAY_NAME,
    authorityType: 'MSSTS',
    clientInfo: b64url({ uid: OID, utid: TENANT_ID }),
  });

  // ── ID Token cache entry ─────────────────────────────
  const idTokenKey = `${HOME_ACCOUNT_ID}-${ENVIRONMENT}-idtoken-${CLIENT_ID}-${TENANT_ID}-`;
  const idToken = fakeJwt({
    aud: CLIENT_ID,
    iss: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
    iat: now,
    nbf: now,
    exp: now + 3600,
    name: DISPLAY_NAME,
    oid: OID,
    preferred_username: USERNAME,
    sub: OID,
    tid: TENANT_ID,
    ver: '2.0',
  });
  entries[idTokenKey] = JSON.stringify({
    homeAccountId: HOME_ACCOUNT_ID,
    environment: ENVIRONMENT,
    credentialType: 'IdToken',
    clientId: CLIENT_ID,
    secret: idToken,
    realm: TENANT_ID,
  });

  // ── Access Token cache entry ─────────────────────────
  const scopes = 'openid profile user.read email mail.send mail.readwrite';
  const accessTokenKey = `${HOME_ACCOUNT_ID}-${ENVIRONMENT}-accesstoken-${CLIENT_ID}-${TENANT_ID}-${scopes}`;
  const accessToken = fakeJwt({
    aud: 'https://graph.microsoft.com',
    iss: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
    iat: now,
    exp: now + 3600,
    name: DISPLAY_NAME,
    oid: OID,
    preferred_username: USERNAME,
    scp: scopes,
    sub: OID,
    tid: TENANT_ID,
  });
  entries[accessTokenKey] = JSON.stringify({
    homeAccountId: HOME_ACCOUNT_ID,
    environment: ENVIRONMENT,
    credentialType: 'AccessToken',
    clientId: CLIENT_ID,
    secret: accessToken,
    realm: TENANT_ID,
    target: scopes,
    cachedAt: String(now),
    expiresOn: String(now + 3600),
    extendedExpiresOn: String(now + 7200),
  });

  // ── MSAL index keys ─────────────────────────────────
  entries['msal.account.keys'] = JSON.stringify([accountKey]);
  entries[`msal.token.keys.${CLIENT_ID}`] = JSON.stringify({
    idToken: [idTokenKey],
    accessToken: [accessTokenKey],
    refreshToken: [],
  });

  return entries;
}

/** The origin that the mock cache is scoped to */
export const MOCK_ORIGIN = 'http://localhost:3000';
