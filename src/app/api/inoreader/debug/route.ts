import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token');
    const refreshToken = cookieStore.get('refresh_token');
    const expiresAt = cookieStore.get('token_expires_at');

    return NextResponse.json({
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      expiresAt: expiresAt?.value,
      expiresIn: expiresAt ? parseInt(expiresAt.value) - Date.now() : null,
      isExpired: expiresAt ? parseInt(expiresAt.value) < Date.now() : null,
      cookies: {
        accessToken: accessToken ? 'present' : 'missing',
        refreshToken: refreshToken ? 'present' : 'missing',
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to check debug info' },
      { status: 500 }
    );
  }
}