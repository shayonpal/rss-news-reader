/**
 * Helper function to log Inoreader API calls
 * Fire-and-forget to avoid blocking the main request
 */
export function logInoreaderApiCall(
  endpoint: string,
  trigger: string,
  method: string = 'GET'
): void {
  // Fire and forget - don't await
  fetch('/api/logs/inoreader', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      endpoint,
      trigger,
      method
    }),
  }).catch(error => {
    // Silently fail - logging should not break the app
    console.error('Failed to log API call:', error);
  });
}