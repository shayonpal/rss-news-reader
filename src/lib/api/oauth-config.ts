export const INOREADER_OAUTH_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_INOREADER_CLIENT_ID!,
  clientSecret: process.env.INOREADER_CLIENT_SECRET!,
  redirectUri: process.env.NEXT_PUBLIC_INOREADER_REDIRECT_URI!,
  scope: "read write",
  authUrl: "https://www.inoreader.com/oauth2/auth",
  tokenUrl: "https://www.inoreader.com/oauth2/token",
} as const;

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface OAuthError {
  error: string;
  error_description?: string;
}