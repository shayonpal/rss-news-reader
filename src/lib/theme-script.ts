// This script runs before React hydration to prevent theme flash
export const themeScript = `
  (function() {
    try {
      const stored = localStorage.getItem('ui-store');
      let theme = 'system';
      
      if (stored) {
        const parsed = JSON.parse(stored);
        theme = parsed.state?.theme || 'system';
      }
      
      const root = document.documentElement;
      
      if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches 
          ? 'dark' 
          : 'light';
        root.classList.add(systemTheme);
      } else {
        root.classList.add(theme);
      }
    } catch (e) {
      // Fallback to system theme
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches 
        ? 'dark' 
        : 'light';
      document.documentElement.classList.add(systemTheme);
    }
  })();
`;
