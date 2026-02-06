'use client';

import { ReactNode, useEffect, useState } from 'react';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication, EventType } from '@azure/msal-browser';
import { msalConfig } from '@/lib/authConfig';

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
        // Build runtime config with correct redirect URI for this environment
        const redirectUri = window.location.origin +
          (window.location.pathname.includes('/mit-qb-frontend') ? '/mit-qb-frontend/' : '/');

        const runtimeConfig = {
          ...msalConfig,
          auth: {
            ...msalConfig.auth,
            redirectUri,
            navigateToLoginRequestUrl: true,
          },
        };

        console.log('🔍 MSAL: Initializing with redirectUri:', redirectUri);

        const instance = new PublicClientApplication(runtimeConfig);
        await instance.initialize();

        // Handle redirect promise (for redirect-based flows)
        const response = await instance.handleRedirectPromise();
        if (response) {
          console.log('✅ MSAL: Handled redirect response for', response.account?.username);
          instance.setActiveAccount(response.account);
        } else {
          // Set active account from cache if available
          const accounts = instance.getAllAccounts();
          if (accounts.length > 0) {
            instance.setActiveAccount(accounts[0]);
            console.log('✅ MSAL: Restored session for', accounts[0].username);
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

        console.log('✅ MSAL: Ready');
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
