import crypto from 'crypto';

export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function validateOAuthState(state: string | null, storedState: string | null): boolean {
  if (!state || !storedState) return false;
  return state === storedState;
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_INOREADER_CLIENT_ID!,
    redirect_uri: process.env.NEXT_PUBLIC_INOREADER_REDIRECT_URI!,
    response_type: 'code',
    scope: 'read write',
    state,
  });

  return `https://www.inoreader.com/oauth2/auth?${params.toString()}`;
}