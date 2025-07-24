import React from 'react';
import { RotateCcw, Sun, Moon, Monitor } from 'lucide-react';
import { FilterDropdown, FilterState } from './FilterDropdown';
import { useTheme } from '../App';

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
  title = 'Articles',
  showFilter = false,
  currentFilter,
  onFilterChange
}: HeaderProps) {
  const { isDark, themeMode, toggleTheme } = useTheme();

  const getThemeIcon = () => {
    switch (themeMode) {
      case 'light':
        return <Sun className="w-5 h-5 text-yellow-600 dark:text-yellow-400 transition-all duration-300 group-hover:rotate-180 group-hover:scale-110" />;
      case 'dark':
        return <Moon className="w-5 h-5 text-slate-700 dark:text-slate-300 transition-all duration-300 group-hover:rotate-12 group-hover:scale-110" />;
      case 'system':
        return <Monitor className="w-5 h-5 text-blue-600 dark:text-blue-400 transition-all duration-300 group-hover:scale-110" />;
      default:
        return <Monitor className="w-5 h-5 text-blue-600 dark:text-blue-400 transition-all duration-300 group-hover:scale-110" />;
    }
  };

  const getThemeTooltip = () => {
    switch (themeMode) {
      case 'light':
        return 'Switch to Dark theme';
      case 'dark':
        return 'Switch to System theme';
      case 'system':
        return 'Switch to Light theme';
      default:
        return 'Toggle theme';
    }
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out ${
      isVisible ? 'translate-y-0 opacity-100' : 'translate-y-[-100%] opacity-0'
    }`}>
      {/* Enhanced glass background with better blur */}
      <div className="backdrop-blur-3xl bg-gradient-to-b from-white/80 via-white/70 to-white/60 dark:from-slate-900/80 dark:via-slate-900/70 dark:to-slate-900/60 border-b border-white/30 dark:border-slate-600/30 shadow-2xl shadow-black/5 dark:shadow-black/20">
        {/* Animated background patterns */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5 animate-pulse opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent dark:from-slate-800/15 dark:to-transparent" />
        
        <div className="relative max-w-4xl mx-auto px-4 py-4">
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
                className="group relative p-3 rounded-2xl backdrop-blur-2xl bg-white/50 dark:bg-slate-800/50 hover:bg-white/70 dark:hover:bg-slate-700/70 transition-all duration-300 border border-white/40 dark:border-slate-600/40 shadow-lg shadow-black/5 dark:shadow-black/20 transform hover:scale-105 active:scale-95 min-w-[44px] min-h-[44px]"
                aria-label={getThemeTooltip()}
                title={getThemeTooltip()}
              >
                {/* Glass shine effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Theme mode indicator for system mode */}
                {themeMode === 'system' && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-pulse" />
                )}
                
                <div className="relative">
                  {getThemeIcon()}
                </div>
              </button>
              
              {/* Enhanced Refresh Button */}
              <button
                onClick={onSync}
                disabled={isSyncing}
                className="group relative p-3 rounded-2xl backdrop-blur-2xl bg-white/50 dark:bg-slate-800/50 hover:bg-white/70 dark:hover:bg-slate-700/70 transition-all duration-300 border border-white/40 dark:border-slate-600/40 shadow-lg shadow-black/5 dark:shadow-black/20 transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed min-w-[44px] min-h-[44px]"
                aria-label="Refresh articles"
              >
                {/* Glass shine effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Loading backdrop */}
                {isSyncing && (
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 animate-pulse" />
                )}
                
                <div className="relative">
                  {isSyncing ? (
                    // Modern refresh animation
                    <div className="relative w-5 h-5">
                      {/* Outer ring */}
                      <div className="absolute inset-0 border-2 border-blue-200 dark:border-blue-800 rounded-full animate-ping opacity-20" />
                      
                      {/* Middle ring */}
                      <div className="absolute inset-0 border-2 border-transparent border-t-blue-500 dark:border-t-blue-400 rounded-full animate-spin" />
                      
                      {/* Inner dot */}
                      <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-blue-500 dark:bg-blue-400 rounded-full transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                      
                      {/* Rotating segments */}
                      <div className="absolute inset-1 border border-transparent border-t-blue-400 dark:border-t-blue-300 rounded-full animate-spin opacity-60" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
                    </div>
                  ) : (
                    <RotateCcw className="w-5 h-5 text-slate-700 dark:text-slate-300 transition-all duration-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:rotate-180" />
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