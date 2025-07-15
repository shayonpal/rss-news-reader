import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const INOREADER_API_BASE = 'https://www.inoreader.com/reader/api/0';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('inoreader_access_token');

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const response = await fetch(`${INOREADER_API_BASE}/unread-count`, {
      headers: {
        'Authorization': `Bearer ${accessToken.value}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch unread counts: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Unread counts API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}