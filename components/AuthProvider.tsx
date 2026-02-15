'use client';

import { ReactNode, useEffect, useState } from 'react';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication, EventType } from '@azure/msal-browser';
import { msalConfig } from '@/lib/authConfig';

// Mock network client for E2E tests — prevents MSAL from making real HTTP calls
function buildTestNetworkClient() {
  const tenantId = process.env.NEXT_PUBLIC_AZURE_TENANT_ID || '';
  const oidcMetadata = {
    token_endpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    token_endpoint_auth_methods_supported: ['client_secret_post', 'private_key_jwt', 'client_secret_basic'],
    jwks_uri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    response_modes_supported: ['query', 'fragment', 'form_post'],
    subject_types_supported: ['pairwise'],
    id_token_signing_alg_values_supported: ['RS256'],
    response_types_supported: ['code', 'id_token', 'code id_token', 'id_token token'],
    scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
    issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    request_uri_parameter_supported: false,
    userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
    authorization_endpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    device_authorization_endpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/devicecode`,
    end_session_endpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/logout`,
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'nonce', 'preferred_username', 'name', 'tid', 'ver', 'email'],
    cloud_instance_name: 'microsoftonline.com',
    msgraph_host: 'graph.microsoft.com',
  };
  return {
    sendGetRequestAsync: async (url: string) => {
      if (url.includes('openid-configuration')) {
        return { headers: {}, body: oidcMetadata, status: 200 };
      }
      if (url.includes('/keys')) {
        return { headers: {}, body: { keys: [] }, status: 200 };
      }
      return { headers: {}, body: {}, status: 200 };
    },
    sendPostRequestAsync: async () => {
      return { headers: {}, body: { access_token: 'mock', token_type: 'Bearer', expires_in: 3600 }, status: 200 };
    },
  };
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initMsal = async () => {
      try {
        const isTestMode = localStorage.getItem('__E2E_TEST__') === 'true';

        // Build runtime config with correct redirect URI for this environment
        const redirectUri = window.location.origin +
          (window.location.pathname.includes('/mit-qb-frontend') ? '/mit-qb-frontend/' : '/');

        const runtimeConfig: any = {
          ...msalConfig,
          auth: {
            ...msalConfig.auth,
            redirectUri,
            navigateToLoginRequestUrl: true,
          },
          // In test mode, use a mock network client so MSAL never makes real HTTP calls
          ...(isTestMode ? { system: { networkClient: buildTestNetworkClient() } } : {}),
        };

        const instance = new PublicClientApplication(runtimeConfig);
        await instance.initialize();

        // Handle redirect promise (for redirect-based flows)
        const response = await instance.handleRedirectPromise();
        if (response) {
          instance.setActiveAccount(response.account);
        } else {
          // Set active account from cache if available
          const accounts = instance.getAllAccounts();
          if (accounts.length > 0) {
            instance.setActiveAccount(accounts[0]);
          }
        }

        // Listen for login events
        instance.addEventCallback((event) => {
          if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
            const payload = event.payload as any;
            if (payload.account) {
              instance.setActiveAccount(payload.account);
            }
          }
        });

        setMsalInstance(instance);
      } catch (error: any) {
        console.error('❌ MSAL: Init failed:', error);
        setInitError(error.message || 'Failed to initialize authentication');
      }
    };

    initMsal();
  }, []);

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <div className="text-red-500 text-4xl mb-4">!</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Error</h2>
          <p className="text-sm text-gray-600 mb-4">{initError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!msalInstance) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Initializing authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <MsalProvider instance={msalInstance}>
      {children}
    </MsalProvider>
  );
}
