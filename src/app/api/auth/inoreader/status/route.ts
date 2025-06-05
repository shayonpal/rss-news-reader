import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('access_token')?.value;
    const refreshToken = request.cookies.get('refresh_token')?.value;
    const expiresAt = request.cookies.get('token_expires_at')?.value;
    
    if (!accessToken || !refreshToken) {
      return NextResponse.json({
        authenticated: false,
        needsRefresh: false,
      });
    }
    
    const expiresAtTime = expiresAt ? parseInt(expiresAt, 10) : 0;
    const now = Date.now();
    const needsRefresh = expiresAtTime - now < 5 * 60 * 1000; // Refresh if less than 5 minutes left
    
    return NextResponse.json({
      authenticated: true,
      needsRefresh,
      expiresIn: Math.max(0, expiresAtTime - now),
    });
  } catch (error) {
    console.error('Auth status error:', error);
    return NextResponse.json(
      { error: 'Failed to check auth status' },
      { status: 500 }
    );
  }
}