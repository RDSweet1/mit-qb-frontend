'use client';

import { ReactNode, useEffect, useState } from 'react';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from '@/lib/authConfig';

interface AuthProviderProps {
  children: ReactNode;
}

// Simple loading component
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Initializing authentication...</p>
      </div>
    </div>
  );
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(null);

  useEffect(() => {
    // Only initialize MSAL in the browser
    if (typeof window !== 'undefined') {
      // DEBUG: Log environment variables
      console.log('🔍 DEBUG: Environment Variables:', {
        clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID,
        tenantId: process.env.NEXT_PUBLIC_AZURE_TENANT_ID,
        redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI,
      });

      // DEBUG: Log MSAL configuration
      console.log('🔍 DEBUG: MSAL Config:', JSON.stringify(msalConfig, null, 2));

      try {
        const instance = new PublicClientApplication(msalConfig);
        console.log('✅ DEBUG: MSAL instance created successfully');

        // Initialize MSAL before using it
        instance.initialize().then(() => {
          console.log('✅ DEBUG: MSAL instance initialized');
          setMsalInstance(instance);
        }).catch((error) => {
          console.error('❌ DEBUG: Failed to initialize MSAL instance:', error);
        });
      } catch (error) {
        console.error('❌ DEBUG: Failed to create MSAL instance:', error);
      }
    }
  }, []);

  // Show loading screen while MSAL initializes
  if (!msalInstance) {
    return <LoadingScreen />;
  }

  return (
    <MsalProvider instance={msalInstance}>
      {children}
    </MsalProvider>
  );
}
