import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('access_token')?.value;
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Proxy request to Inoreader API
    const inoreaderResponse = await fetch('https://www.inoreader.com/reader/api/0/user-info', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!inoreaderResponse.ok) {
      if (inoreaderResponse.status === 401) {
        return NextResponse.json(
          { error: 'Token expired' },
          { status: 401 }
        );
      }
      throw new Error(`Inoreader API error: ${inoreaderResponse.statusText}`);
    }

    const userInfo = await inoreaderResponse.json();
    return NextResponse.json(userInfo);
  } catch (error) {
    console.error('User info API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user info' },
      { status: 500 }
    );
  }
}