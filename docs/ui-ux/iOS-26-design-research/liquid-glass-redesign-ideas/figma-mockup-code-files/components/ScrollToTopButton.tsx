import React from "react";
import { ChevronUp } from "lucide-react";

interface ScrollToTopButtonProps {
  show: boolean;
}

export function ScrollToTopButton({ show }: ScrollToTopButtonProps) {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-28 right-6 z-40 transform rounded-full border border-white/40 bg-white/70 p-3 shadow-2xl shadow-black/10 backdrop-blur-2xl transition-all duration-300 hover:scale-110 hover:bg-white/80 active:scale-95 dark:border-slate-600/40 dark:bg-slate-800/70 dark:shadow-black/30 dark:hover:bg-slate-700/80 ${
        show
          ? "translate-x-0 opacity-100"
          : "pointer-events-none translate-x-16 opacity-0"
      }`}
      aria-label="Scroll to top"
    >
      <ChevronUp className="h-5 w-5 text-slate-700 dark:text-slate-300" />
    </button>
  );
}
