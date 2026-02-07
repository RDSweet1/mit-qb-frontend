'use client';

import { useMsal } from '@azure/msal-react';
import { loginRequest } from '@/lib/authConfig';
import { LogIn, Clock } from 'lucide-react';
import { ReactNode } from 'react';

interface ProtectedPageProps {
  children: ReactNode;
}

export function ProtectedPage({ children }: ProtectedPageProps) {
  const { instance, accounts } = useMsal();
  const isAuthenticated = accounts.length > 0;

  const handleLogin = async () => {
    try {
      // Pick up login_hint from URL for pre-filled sign-in
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const loginHint = params?.get('login_hint') || undefined;
      const request = loginHint ? { ...loginRequest, loginHint } : loginRequest;
      await instance.loginPopup(request);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
              <Clock className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              MIT Consulting
            </h1>
            <p className="text-gray-600">QuickBooks Timesheet System</p>
          </div>

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Authentication Required:</strong> Please sign in with your Microsoft account to access this page.
            </p>
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Microsoft
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
