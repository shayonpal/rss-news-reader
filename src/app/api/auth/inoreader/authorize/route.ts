import { NextRequest, NextResponse } from 'next/server';
import { generateOAuthState, buildAuthUrl } from '@/lib/api/oauth-utils';

export async function GET(request: NextRequest) {
  try {
    // Generate secure state parameter
    const state = generateOAuthState();
    
    // Build authorization URL
    const authUrl = buildAuthUrl(state);
    
    // Create response with redirect
    const response = NextResponse.redirect(authUrl);
    
    // Store state in httpOnly cookie for validation
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10, // 10 minutes
    });
    
    return response;
  } catch (error) {
    console.error('OAuth authorization error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}