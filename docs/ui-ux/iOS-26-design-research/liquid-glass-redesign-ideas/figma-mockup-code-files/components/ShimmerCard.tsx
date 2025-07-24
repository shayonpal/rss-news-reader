import React from 'react';

export function ShimmerCard() {
  return (
    <div className="group">
      <div className="relative backdrop-blur-2xl bg-white/50 dark:bg-slate-800/50 rounded-2xl border border-white/35 dark:border-slate-600/35 shadow-lg shadow-black/10 dark:shadow-black/25 overflow-hidden">
        {/* Glass background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-white/8 dark:from-slate-700/15 dark:via-transparent dark:to-slate-800/8" />
        
        {/* Shimmer overlay */}
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 dark:via-slate-400/20 to-transparent" />
        
        <div className="relative p-3">
          {/* Header: Category and Action Icons */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="h-5 w-16 bg-slate-300/50 dark:bg-slate-600/50 rounded-lg animate-pulse" />
            
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-slate-300/50 dark:bg-slate-600/50 rounded-lg animate-pulse" />
              <div className="w-7 h-7 bg-slate-300/50 dark:bg-slate-600/50 rounded-lg animate-pulse" />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2 mb-2">
            <div className="h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded animate-pulse" />
            <div className="h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded w-3/4 animate-pulse" />
          </div>

          {/* Content */}
          <div className="space-y-2 mb-3">
            <div className="h-3 bg-slate-200/50 dark:bg-slate-700/50 rounded animate-pulse" />
            <div className="h-3 bg-slate-200/50 dark:bg-slate-700/50 rounded animate-pulse" />
            <div className="h-3 bg-slate-200/50 dark:bg-slate-700/50 rounded w-5/6 animate-pulse" />
            <div className="h-3 bg-slate-200/50 dark:bg-slate-700/50 rounded w-2/3 animate-pulse" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="h-3 w-20 bg-slate-200/50 dark:bg-slate-700/50 rounded animate-pulse" />
            <div className="h-3 w-12 bg-slate-200/50 dark:bg-slate-700/50 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ShimmerList() {
  return (
    <div className="max-w-4xl mx-auto px-4 space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <ShimmerCard key={index} />
      ))}
    </div>
  );
}