import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('access_token')?.value;
    
    console.log('User-info request - has access token:', !!accessToken);
    
    if (!accessToken) {
      console.log('No access token found in cookies');
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    console.log('Making request to Inoreader user-info API...');
    
    // Proxy request to Inoreader API
    const inoreaderResponse = await fetch('https://www.inoreader.com/reader/api/0/user-info', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'AppId': process.env.NEXT_PUBLIC_INOREADER_CLIENT_ID!,
        'AppKey': process.env.INOREADER_CLIENT_SECRET!,
        'User-Agent': 'Shayons-News/1.0',
      },
    });

    console.log('Inoreader response status:', inoreaderResponse.status);

    if (!inoreaderResponse.ok) {
      const errorText = await inoreaderResponse.text();
      console.error('Inoreader API error response:', errorText);
      
      if (inoreaderResponse.status === 401) {
        return NextResponse.json(
          { error: 'Token expired' },
          { status: 401 }
        );
      }
      throw new Error(`Inoreader API error: ${inoreaderResponse.status} ${errorText}`);
    }

    const userInfo = await inoreaderResponse.json();
    console.log('Successfully fetched user info:', userInfo.userName);
    return NextResponse.json(userInfo);
  } catch (error) {
    console.error('User info API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user info' },
      { status: 500 }
    );
  }
}