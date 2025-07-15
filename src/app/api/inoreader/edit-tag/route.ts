import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const INOREADER_API_BASE = 'https://www.inoreader.com/reader/api/0';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('inoreader_access_token');

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get the body from the request
    const body = await request.text();

    const response = await fetch(`${INOREADER_API_BASE}/edit-tag`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.value}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to edit tags: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Inoreader returns "OK" as plain text for successful operations
    const result = await response.text();
    return NextResponse.json({ success: result === 'OK' });
  } catch (error) {
    console.error('Edit tag API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}