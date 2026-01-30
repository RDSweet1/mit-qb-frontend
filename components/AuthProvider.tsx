'use client';

import { ReactNode } from 'react';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from '@/lib/authConfig';

// DEBUG: Log environment variables
console.log('🔍 DEBUG: Environment Variables:', {
  clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID,
  tenantId: process.env.NEXT_PUBLIC_AZURE_TENANT_ID,
  redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI,
});

// DEBUG: Log MSAL configuration
console.log('🔍 DEBUG: MSAL Config:', JSON.stringify(msalConfig, null, 2));

// Initialize MSAL instance
let msalInstance: PublicClientApplication;
try {
  msalInstance = new PublicClientApplication(msalConfig);
  console.log('✅ DEBUG: MSAL instance created successfully');
} catch (error) {
  console.error('❌ DEBUG: Failed to create MSAL instance:', error);
  throw error;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <MsalProvider instance={msalInstance}>
      {children}
    </MsalProvider>
  );
}
