/// <reference types="vite/client" />

declare const gapi: any;

interface Window {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          login_hint?: string;
          callback: (response: GoogleTokenResponse) => void;
          error_callback?: (error: unknown) => void;
        }) => GoogleTokenClient;
        revoke: (token: string, done: () => void) => void;
      };
    };
  };
}

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}
