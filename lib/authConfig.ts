import { Configuration, PopupRequest } from '@azure/msal-browser';

// MSAL configuration for Microsoft Entra ID (Azure AD) authentication
export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID}`,
    redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || 'http://localhost:3000',
  },
  cache: {
    cacheLocation: 'localStorage', // Changed from sessionStorage for persistent login
    storeAuthStateInCookie: true, // Enable for better compatibility
  },
};

// Scopes for API access
export const loginRequest: PopupRequest = {
  scopes: ['User.Read', 'email', 'profile', 'openid', 'Mail.Send', 'Mail.ReadWrite'],
};

// Additional scopes for Microsoft Graph API (for sending emails)
export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
  graphMailEndpoint: 'https://graph.microsoft.com/v1.0/me/sendMail',
};
