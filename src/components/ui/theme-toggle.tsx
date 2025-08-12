"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useUIStore } from "@/lib/stores/ui-store";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useUIStore();

  const getThemeIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className="h-4 w-4" />;
      case "dark":
        return <Moon className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const cycleTheme = () => {
    const themes = ["light", "dark", "system"] as const;
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className="h-9 w-9"
      aria-label={`Current theme: ${theme}. Click to cycle themes.`}
    >
      {getThemeIcon()}
    </Button>
  );
}
