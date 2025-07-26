import React from 'react';
import { BookOpen, Rss, BarChart3, Settings, Book, Radio, BarChart, Cog } from 'lucide-react';

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isVisible?: boolean;
}

export function BottomNavigation({ activeTab, onTabChange, isVisible = true }: BottomNavigationProps) {
  const tabs = [
    {
      id: 'articles',
      label: 'Articles',
      icon: BookOpen,
      filledIcon: Book,
    },
    {
      id: 'feeds',
      label: 'Feeds',
      icon: Rss,
      filledIcon: Radio,
    },
    {
      id: 'stats',
      label: 'Stats',
      icon: BarChart3,
      filledIcon: BarChart,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      filledIcon: Cog,
    }
  ];

  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-500 ease-out ${
      isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
    }`}>
      {/* Enhanced glass background with animated gradient */}
      <div className="backdrop-blur-3xl bg-gradient-to-t from-white/80 via-white/70 to-white/60 dark:from-slate-900/80 dark:via-slate-900/70 dark:to-slate-900/60 border-t border-white/30 dark:border-slate-600/30 shadow-2xl shadow-black/10 dark:shadow-black/30">
        {/* Animated background patterns */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5 animate-pulse opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-white/15 to-transparent dark:from-slate-800/15 dark:to-transparent" />
        
        <div className="relative max-w-4xl mx-auto px-3 py-4">
          <div className="flex items-center justify-around">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = isActive ? tab.filledIcon : tab.icon;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`group relative flex flex-col items-center gap-1 p-3 rounded-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 min-w-[80px] ${
                    isActive
                      ? 'bg-white/70 dark:bg-slate-800/70 shadow-lg shadow-black/10 dark:shadow-black/25 border border-white/50 dark:border-slate-600/50'
                      : 'hover:bg-white/40 dark:hover:bg-slate-800/40'
                  }`}
                  aria-label={tab.label}
                >
                  {/* Glass shine effect for active state */}
                  {isActive && (
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 to-transparent opacity-60" />
                  )}
                  
                  {/* Enhanced glass shine effect on hover */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  <Icon 
                    className={`relative w-6 h-6 transition-colors duration-300 ${
                      isActive 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200'
                    }`} 
                  />
                  
                  <span className={`relative text-xs font-medium transition-colors duration-300 ${
                    isActive 
                      ? 'text-blue-700 dark:text-blue-300' 
                      : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200'
                  }`}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}