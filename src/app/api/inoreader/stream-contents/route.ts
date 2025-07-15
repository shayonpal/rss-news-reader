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

    // Get stream ID and other parameters from query
    const { searchParams } = new URL(request.url);
    const streamId = searchParams.get('streamId');
    
    if (!streamId) {
      return NextResponse.json(
        { error: 'Stream ID is required' },
        { status: 400 }
      );
    }

    // Build query parameters for Inoreader API
    const inoreaderParams = new URLSearchParams();
    
    // Add supported parameters
    const count = searchParams.get('n');
    const sortOrder = searchParams.get('r');
    const continuation = searchParams.get('c');
    const excludeTarget = searchParams.get('xt');
    
    if (count) inoreaderParams.set('n', count);
    if (sortOrder) inoreaderParams.set('r', sortOrder);
    if (continuation) inoreaderParams.set('c', continuation);
    if (excludeTarget) inoreaderParams.set('xt', excludeTarget);

    const response = await fetch(
      `${INOREADER_API_BASE}/stream/contents/${encodeURIComponent(streamId)}?${inoreaderParams}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken.value}`,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch stream contents: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Stream contents API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}