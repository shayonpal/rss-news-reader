import { useState, useEffect } from 'react';

export function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
  const [isAtTop, setIsAtTop] = useState(true);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateScrollDirection = () => {
      const scrollY = window.scrollY;
      const direction = scrollY > lastScrollY ? 'down' : 'up';
      
      // Only update if we've scrolled more than 10px to avoid jitter
      if (Math.abs(scrollY - lastScrollY) > 10) {
        setScrollDirection(direction);
        lastScrollY = scrollY > 0 ? scrollY : 0;
      }
      
      setIsAtTop(scrollY < 10);
      setScrollY(scrollY);
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollDirection);
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return { scrollDirection, isAtTop, scrollY };
}