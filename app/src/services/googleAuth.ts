import { DISCOVERY_DOCS, GOOGLE_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from './config';

const AUTH_DEBUG = true;

function authLog(message: string, details?: unknown): void {
  if (!AUTH_DEBUG) return;
  if (details === undefined) {
    console.log(`[auth] ${message}`);
  } else {
    console.log(`[auth] ${message}`, details);
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      authLog('script already present', { src, loaded: existing.dataset.loaded });
      if (existing.dataset.loaded === 'true') resolve();
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    authLog('loading script', { src });
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      authLog('script loaded', { src });
      resolve();
    };
    script.onerror = (error) => {
      authLog('script failed', { src, error });
      reject(error);
    };
    document.head.appendChild(script);
  });
}

function initGapiClient(): Promise<void> {
  return new Promise((resolve, reject) => {
    authLog('initializing gapi client/auth2');
    gapi.load('client:auth2', async () => {
      try {
        await gapi.client.init({
          apiKey: GOOGLE_API_KEY,
          discoveryDocs: DISCOVERY_DOCS,
          clientId: GOOGLE_CLIENT_ID,
          scope: GOOGLE_SCOPES,
        });
        authLog('gapi client/auth2 initialized', {
          isSignedIn: gapi.auth2.getAuthInstance().isSignedIn.get(),
        });
        resolve();
      } catch (error) {
        authLog('gapi client init failed', error);
        reject(error);
      }
    });
  });
}

export class GoogleAuthService {
  private accessToken = '';

  async init(): Promise<void> {
    authLog('init start');
    await Promise.all([
      loadScript('https://apis.google.com/js/api.js'),
      loadScript('https://accounts.google.com/gsi/client'),
    ]);
    await initGapiClient();

    authLog('init complete');
  }

  isSignedIn(): boolean {
    return Boolean(gapi.auth2?.getAuthInstance().isSignedIn.get());
  }

  async restoreSession(): Promise<string> {
    const authInstance = gapi.auth2.getAuthInstance();
    const isSignedIn = authInstance.isSignedIn.get();
    authLog('restore session', { isSignedIn });
    if (!isSignedIn) {
      throw new Error('not_signed_in');
    }
    return this.applyCurrentUserToken();
  }

  async requestAccessToken(prompt = '', loginHint = ''): Promise<string> {
    authLog('request auth2 sign-in', {
      prompt,
      hasLoginHint: Boolean(loginHint),
      scopes: GOOGLE_SCOPES,
    });

    const authInstance = gapi.auth2.getAuthInstance();
    if (!authInstance.isSignedIn.get()) {
      await authInstance.signIn({
        prompt: prompt || undefined,
        login_hint: loginHint || undefined,
      });
    }

    return this.applyCurrentUserToken();
  }

  private applyCurrentUserToken(): string {
    const user = gapi.auth2.getAuthInstance().currentUser.get();
    const authResponse = user.getAuthResponse(true);
    this.accessToken = authResponse.access_token || '';
    authLog('auth2 token applied', {
      hasAccessToken: Boolean(this.accessToken),
      expiresAt: authResponse.expires_at,
      scope: authResponse.scope,
    });

    if (!this.accessToken) {
      throw new Error('missing_access_token');
    }

    gapi.client.setToken({ access_token: this.accessToken });
    return this.accessToken;
  }

  signOut(): void {
    authLog('sign out');
    const token = this.accessToken;
    this.accessToken = '';
    gapi.client.setToken(null);

    if (gapi.auth2?.getAuthInstance()) {
      void gapi.auth2.getAuthInstance().signOut();
    }

    if (token && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token, () => undefined);
    }
  }
}
