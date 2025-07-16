import { NextRequest, NextResponse } from 'next/server';
import { INOREADER_OAUTH_CONFIG, type TokenData } from '@/lib/api/oauth-config';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value;
    
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token found' },
        { status: 401 }
      );
    }
    
    // Exchange refresh token for new access token
    const tokenResponse = await fetch(INOREADER_OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: INOREADER_OAUTH_CONFIG.clientId,
        client_secret: INOREADER_OAUTH_CONFIG.clientSecret,
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token refresh failed:', errorData);
      
      // Clear invalid tokens
      const response = NextResponse.json(
        { error: 'Token refresh failed' },
        { status: 401 }
      );
      response.cookies.delete('access_token');
      response.cookies.delete('refresh_token');
      response.cookies.delete('token_expires_at');
      
      return response;
    }
    
    const tokenData: TokenData = await tokenResponse.json();
    
    // Use 365-day expiration for our extended token lifetime
    const oneYearInSeconds = 365 * 24 * 60 * 60;
    const expiresAt = Date.now() + oneYearInSeconds * 1000;
    
    // Create response
    const response = NextResponse.json({ success: true });
    
    // Update tokens in cookies with 365-day expiration
    response.cookies.set('access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: oneYearInSeconds, // 365 days
    });
    
    // Update refresh token if a new one was provided
    if (tokenData.refresh_token) {
      response.cookies.set('refresh_token', tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }
    
    response.cookies.set('token_expires_at', expiresAt.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: oneYearInSeconds, // 365 days
    });
    
    return response;
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    );
  }
}