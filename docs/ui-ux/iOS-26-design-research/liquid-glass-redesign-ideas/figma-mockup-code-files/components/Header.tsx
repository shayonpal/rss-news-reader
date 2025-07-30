import React from "react";
import { RotateCcw, Sun, Moon, Monitor } from "lucide-react";
import { FilterDropdown, FilterState } from "./FilterDropdown";
import { useTheme } from "../App";

interface HeaderProps {
  onSync: () => Promise<void>;
  isSyncing: boolean;
  isVisible?: boolean;
  title?: string;
  showFilter?: boolean;
  currentFilter?: FilterState;
  onFilterChange?: (filter: FilterState) => void;
}

export function Header({
  onSync,
  isSyncing,
  isVisible = true,
  title = "Articles",
  showFilter = false,
  currentFilter,
  onFilterChange,
}: HeaderProps) {
  const { isDark, themeMode, toggleTheme } = useTheme();

  const getThemeIcon = () => {
    switch (themeMode) {
      case "light":
        return (
          <Sun className="h-5 w-5 text-yellow-600 transition-all duration-300 group-hover:rotate-180 group-hover:scale-110 dark:text-yellow-400" />
        );
      case "dark":
        return (
          <Moon className="h-5 w-5 text-slate-700 transition-all duration-300 group-hover:rotate-12 group-hover:scale-110 dark:text-slate-300" />
        );
      case "system":
        return (
          <Monitor className="h-5 w-5 text-blue-600 transition-all duration-300 group-hover:scale-110 dark:text-blue-400" />
        );
      default:
        return (
          <Monitor className="h-5 w-5 text-blue-600 transition-all duration-300 group-hover:scale-110 dark:text-blue-400" />
        );
    }
  };

  const getThemeTooltip = () => {
    switch (themeMode) {
      case "light":
        return "Switch to Dark theme";
      case "dark":
        return "Switch to System theme";
      case "system":
        return "Switch to Light theme";
      default:
        return "Toggle theme";
    }
  };

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-500 ease-out ${
        isVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-[-100%] opacity-0"
      }`}
    >
      {/* Enhanced glass background with better blur */}
      <div className="border-b border-white/30 bg-gradient-to-b from-white/80 via-white/70 to-white/60 shadow-2xl shadow-black/5 backdrop-blur-3xl dark:border-slate-600/30 dark:from-slate-900/80 dark:via-slate-900/70 dark:to-slate-900/60 dark:shadow-black/20">
        {/* Animated background patterns */}
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5 opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent dark:from-slate-800/15 dark:to-transparent" />

        <div className="relative mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Title */}
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
              {title}
            </h1>

            {/* Right side controls */}
            <div className="flex items-center gap-3">
              {/* Filter Dropdown - only show when specified */}
              {showFilter && currentFilter && onFilterChange && (
                <FilterDropdown
                  currentFilter={currentFilter}
                  onFilterChange={onFilterChange}
                />
              )}

              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="group relative min-h-[44px] min-w-[44px] transform rounded-2xl border border-white/40 bg-white/50 p-3 shadow-lg shadow-black/5 backdrop-blur-2xl transition-all duration-300 hover:scale-105 hover:bg-white/70 active:scale-95 dark:border-slate-600/40 dark:bg-slate-800/50 dark:shadow-black/20 dark:hover:bg-slate-700/70"
                aria-label={getThemeTooltip()}
                title={getThemeTooltip()}
              >
                {/* Glass shine effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                {/* Theme mode indicator for system mode */}
                {themeMode === "system" && (
                  <div className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400" />
                )}

                <div className="relative">{getThemeIcon()}</div>
              </button>

              {/* Enhanced Refresh Button */}
              <button
                onClick={onSync}
                disabled={isSyncing}
                className="group relative min-h-[44px] min-w-[44px] transform rounded-2xl border border-white/40 bg-white/50 p-3 shadow-lg shadow-black/5 backdrop-blur-2xl transition-all duration-300 hover:scale-105 hover:bg-white/70 active:scale-95 disabled:cursor-not-allowed dark:border-slate-600/40 dark:bg-slate-800/50 dark:shadow-black/20 dark:hover:bg-slate-700/70"
                aria-label="Refresh articles"
              >
                {/* Glass shine effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                {/* Loading backdrop */}
                {isSyncing && (
                  <div className="absolute inset-0 animate-pulse rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10" />
                )}

                <div className="relative">
                  {isSyncing ? (
                    // Modern refresh animation
                    <div className="relative h-5 w-5">
                      {/* Outer ring */}
                      <div className="absolute inset-0 animate-ping rounded-full border-2 border-blue-200 opacity-20 dark:border-blue-800" />

                      {/* Middle ring */}
                      <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-blue-500 dark:border-t-blue-400" />

                      {/* Inner dot */}
                      <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 transform animate-pulse rounded-full bg-blue-500 dark:bg-blue-400" />

                      {/* Rotating segments */}
                      <div
                        className="absolute inset-1 animate-spin rounded-full border border-transparent border-t-blue-400 opacity-60 dark:border-t-blue-300"
                        style={{
                          animationDuration: "2s",
                          animationDirection: "reverse",
                        }}
                      />
                    </div>
                  ) : (
                    <RotateCcw className="h-5 w-5 text-slate-700 transition-all duration-300 group-hover:rotate-180 group-hover:text-blue-600 dark:text-slate-300 dark:group-hover:text-blue-400" />
                  )}
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
