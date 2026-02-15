/**
 * Custom Playwright test fixture that bypasses MSAL authentication.
 *
 * Sets a __E2E_TEST__ localStorage flag that AuthProvider checks.
 * When present, AuthProvider uses a mock network client (MSAL's official API)
 * so MSAL never makes real HTTP calls to Azure AD. MSAL cache entries are
 * pre-populated so accounts are found immediately.
 *
 * Usage: import { test, expect } from '../fixtures/test';
 */
import { test as base, expect } from '@playwright/test';

const TENANT_ID = 'aee0257d-3be3-45ae-806b-65c972c98dfb';
const CLIENT_ID = '973b689d-d96c-4445-883b-739fff12330b';
const ENVIRONMENT = 'login.microsoftonline.com';
const OID = '00000000-0000-0000-0000-000000e2etest';
const USERNAME = 'e2etest@mitigationconsulting.com';
const DISPLAY_NAME = 'E2E Test User';

export const test = base.extend({
  page: async ({ page }, use) => {
    // Inject MSAL cache + test flag BEFORE any page JS runs
    await page.addInitScript(`(function() {
      var CLIENT_ID = '${CLIENT_ID}';
      var TENANT_ID = '${TENANT_ID}';
      var ENVIRONMENT = '${ENVIRONMENT}';
      var OID = '${OID}';
      var HOME_ACCOUNT_ID = OID + '.' + TENANT_ID;
      var USERNAME = '${USERNAME}';
      var DISPLAY_NAME = '${DISPLAY_NAME}';

      var now = Math.floor(Date.now() / 1000);

      function b64url(obj) {
        var json = JSON.stringify(obj);
        var b64 = btoa(unescape(encodeURIComponent(json)));
        return b64.replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/g, '');
      }

      function fakeJwt(claims) {
        return b64url({ alg: 'RS256', typ: 'JWT' }) + '.' + b64url(claims) + '.fake-sig';
      }

      // --- E2E test mode flag (AuthProvider checks this) ---
      localStorage.setItem('__E2E_TEST__', 'true');

      // --- MSAL cache entries ---
      var accountKey = HOME_ACCOUNT_ID + '-' + ENVIRONMENT + '-' + TENANT_ID;
      localStorage.setItem(accountKey, JSON.stringify({
        homeAccountId: HOME_ACCOUNT_ID,
        environment: ENVIRONMENT,
        realm: TENANT_ID,
        localAccountId: OID,
        username: USERNAME,
        name: DISPLAY_NAME,
        authorityType: 'MSSTS',
        clientInfo: b64url({ uid: OID, utid: TENANT_ID })
      }));

      var idTokenKey = HOME_ACCOUNT_ID + '-' + ENVIRONMENT + '-idtoken-' + CLIENT_ID + '-' + TENANT_ID + '-';
      var idToken = fakeJwt({
        aud: CLIENT_ID,
        iss: 'https://login.microsoftonline.com/' + TENANT_ID + '/v2.0',
        iat: now, nbf: now, exp: now + 3600,
        name: DISPLAY_NAME, oid: OID,
        preferred_username: USERNAME, sub: OID,
        tid: TENANT_ID, ver: '2.0'
      });
      localStorage.setItem(idTokenKey, JSON.stringify({
        homeAccountId: HOME_ACCOUNT_ID,
        environment: ENVIRONMENT,
        credentialType: 'IdToken',
        clientId: CLIENT_ID,
        secret: idToken,
        realm: TENANT_ID
      }));

      var scopes = 'openid profile user.read email mail.send mail.readwrite';
      var accessTokenKey = HOME_ACCOUNT_ID + '-' + ENVIRONMENT + '-accesstoken-' + CLIENT_ID + '-' + TENANT_ID + '-' + scopes;
      var accessToken = fakeJwt({
        aud: 'https://graph.microsoft.com',
        iss: 'https://login.microsoftonline.com/' + TENANT_ID + '/v2.0',
        iat: now, exp: now + 3600,
        name: DISPLAY_NAME, oid: OID,
        preferred_username: USERNAME,
        scp: scopes, sub: OID, tid: TENANT_ID
      });
      localStorage.setItem(accessTokenKey, JSON.stringify({
        homeAccountId: HOME_ACCOUNT_ID,
        environment: ENVIRONMENT,
        credentialType: 'AccessToken',
        clientId: CLIENT_ID,
        secret: accessToken,
        realm: TENANT_ID,
        target: scopes,
        cachedAt: String(now),
        expiresOn: String(now + 3600),
        extendedExpiresOn: String(now + 7200)
      }));

      localStorage.setItem('msal.account.keys', JSON.stringify([accountKey]));
      localStorage.setItem('msal.token.keys.' + CLIENT_ID, JSON.stringify({
        idToken: [idTokenKey],
        accessToken: [accessTokenKey],
        refreshToken: []
      }));
    })();`);

    await use(page);
  },
});

export { expect };
