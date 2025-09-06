/**
 * Debounce utility for rate-limiting function calls
 */

/**
 * Creates a debounced version of a function
 * 
 * The debounced function delays invoking the original function until after
 * the specified delay has elapsed since the last time it was invoked.
 * 
 * @param fn - The function to debounce
 * @param delay - The delay in milliseconds
 * @returns Debounced function with cancel method
 * 
 * @example
 * const debouncedSave = debounce(saveFunction, 500);
 * // Call multiple times rapidly
 * debouncedSave(); // Won't execute immediately
 * debouncedSave(); // Resets the timer
 * debouncedSave(); // Only this call will execute after 500ms
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null;

  const debounced = ((...args: Parameters<T>) => {
    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Set new timeout
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  }) as T;

  // Add cancel method
  (debounced as any).cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced as T & { cancel: () => void };
}

/**
 * Creates a debounced version of a function with leading edge execution
 * 
 * This version executes immediately on the first call, then debounces
 * subsequent calls.
 * 
 * @param fn - The function to debounce
 * @param delay - The delay in milliseconds
 * @returns Debounced function with cancel method
 */
export function debounceLeading<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastCallTime = 0;

  const debounced = ((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    // Execute immediately if enough time has passed
    if (timeSinceLastCall >= delay) {
      fn(...args);
      lastCallTime = now;
    } else {
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Set new timeout for the remaining time
      timeoutId = setTimeout(() => {
        fn(...args);
        lastCallTime = Date.now();
        timeoutId = null;
      }, delay - timeSinceLastCall);
    }
  }) as T;

  // Add cancel method
  (debounced as any).cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced as T & { cancel: () => void };
}