import React from 'react';
import { ChevronUp } from 'lucide-react';

interface ScrollToTopButtonProps {
  show: boolean;
}

export function ScrollToTopButton({ show }: ScrollToTopButtonProps) {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <button
      onClick={scrollToTop}
      className={`fixed right-6 bottom-28 z-40 p-3 rounded-full backdrop-blur-2xl bg-white/70 dark:bg-slate-800/70 border border-white/40 dark:border-slate-600/40 shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all duration-300 transform hover:scale-110 hover:bg-white/80 dark:hover:bg-slate-700/80 active:scale-95 ${
        show ? 'translate-x-0 opacity-100' : 'translate-x-16 opacity-0 pointer-events-none'
      }`}
      aria-label="Scroll to top"
    >
      <ChevronUp className="w-5 h-5 text-slate-700 dark:text-slate-300" />
    </button>
  );
}