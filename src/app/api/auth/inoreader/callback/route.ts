import { NextRequest, NextResponse } from 'next/server';
import { validateOAuthState } from '@/lib/api/oauth-utils';
import { INOREADER_OAUTH_CONFIG, type TokenData } from '@/lib/api/oauth-config';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    // Handle OAuth errors
    if (error) {
      const errorDescription = searchParams.get('error_description');
      console.error('OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(error)}`, request.url)
      );
    }
    
    // Validate state parameter
    const storedState = request.cookies.get('oauth_state')?.value;
    if (!validateOAuthState(state, storedState)) {
      console.error('Invalid OAuth state');
      return NextResponse.redirect(
        new URL('/?error=invalid_state', request.url)
      );
    }
    
    if (!code) {
      return NextResponse.redirect(
        new URL('/?error=missing_code', request.url)
      );
    }
    
    // Exchange authorization code for tokens
    const tokenResponse = await fetch(INOREADER_OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: INOREADER_OAUTH_CONFIG.clientId,
        client_secret: INOREADER_OAUTH_CONFIG.clientSecret,
        redirect_uri: INOREADER_OAUTH_CONFIG.redirectUri,
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/?error=token_exchange_failed', request.url)
      );
    }
    
    const tokenData: TokenData = await tokenResponse.json();
    
    // Calculate token expiration time
    const expiresAt = Date.now() + tokenData.expires_in * 1000;
    
    // Create response with redirect to home
    const response = NextResponse.redirect(new URL('/', request.url));
    
    // Store tokens in httpOnly cookies
    response.cookies.set('access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: tokenData.expires_in,
    });
    
    response.cookies.set('refresh_token', tokenData.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    
    response.cookies.set('token_expires_at', expiresAt.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: tokenData.expires_in,
    });
    
    // Clear OAuth state cookie
    response.cookies.delete('oauth_state');
    
    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/?error=callback_failed', request.url)
    );
  }
}