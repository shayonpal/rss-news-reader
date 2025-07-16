import { cookies } from 'next/headers';

/**
 * Check if the access token needs refreshing (older than 360 days)
 * This gives us a 5-day buffer before the 365-day expiration
 */
export async function checkAndRefreshToken(): Promise<boolean> {
  try {
    const cookieStore = cookies();
    const tokenExpiresAt = cookieStore.get('token_expires_at')?.value;
    const refreshToken = cookieStore.get('refresh_token')?.value;
    
    if (!tokenExpiresAt || !refreshToken) {
      return false; // No tokens to refresh
    }
    
    const expiresAtTime = parseInt(tokenExpiresAt);
    const now = Date.now();
    const daysUntilExpiry = (expiresAtTime - now) / (1000 * 60 * 60 * 24);
    
    // Refresh if token expires in less than 5 days
    if (daysUntilExpiry < 5) {
      console.log(`Token expires in ${daysUntilExpiry.toFixed(1)} days, refreshing...`);
      
      // Call the refresh endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/auth/inoreader/refresh`, {
        method: 'POST',
        headers: {
          'Cookie': cookieStore.toString(),
        },
      });
      
      if (response.ok) {
        console.log('Token refreshed successfully');
        return true;
      } else {
        console.error('Token refresh failed:', await response.text());
        return false;
      }
    }
    
    return false; // No refresh needed
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return false;
  }
}

/**
 * Middleware helper to check token age on protected routes
 */
export async function ensureTokenFresh() {
  const refreshed = await checkAndRefreshToken();
  if (refreshed) {
    // Token was refreshed, cookies have been updated
    console.log('Access token refreshed proactively');
  }
}