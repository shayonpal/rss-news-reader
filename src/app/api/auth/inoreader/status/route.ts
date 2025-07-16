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
    const daysUntilExpiry = (expiresAtTime - now) / (1000 * 60 * 60 * 24);
    
    // Check if token expires in less than 5 days (360 days into 365-day lifetime)
    const needsRefresh = daysUntilExpiry < 5;
    
    // Proactively refresh if needed
    if (needsRefresh && refreshToken) {
      try {
        // Call the refresh endpoint internally
        const refreshResponse = await fetch(new URL('/api/auth/inoreader/refresh', request.url).toString(), {
          method: 'POST',
          headers: {
            'Cookie': request.headers.get('cookie') || '',
          },
        });
        
        if (refreshResponse.ok) {
          // Token refreshed successfully, update the response with new cookies
          const response = NextResponse.json({
            authenticated: true,
            needsRefresh: false,
            tokenRefreshed: true,
            expiresIn: 365 * 24 * 60 * 60 * 1000, // Reset to 365 days
          });
          
          // Copy the Set-Cookie headers from refresh response
          const setCookieHeaders = refreshResponse.headers.getSetCookie();
          setCookieHeaders.forEach(cookie => {
            response.headers.append('Set-Cookie', cookie);
          });
          
          return response;
        }
      } catch (error) {
        console.error('Proactive token refresh failed:', error);
      }
    }
    
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