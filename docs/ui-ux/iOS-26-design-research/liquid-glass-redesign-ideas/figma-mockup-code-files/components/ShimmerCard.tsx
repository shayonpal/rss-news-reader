import React from "react";

export function ShimmerCard() {
  return (
    <div className="group">
      <div className="relative overflow-hidden rounded-2xl border border-white/35 bg-white/50 shadow-lg shadow-black/10 backdrop-blur-2xl dark:border-slate-600/35 dark:bg-slate-800/50 dark:shadow-black/25">
        {/* Glass background layers */}
        <div className="to-white/8 dark:to-slate-800/8 absolute inset-0 bg-gradient-to-br from-white/15 via-transparent dark:from-slate-700/15 dark:via-transparent" />

        {/* Shimmer overlay */}
        <div className="animate-shimmer absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-slate-400/20" />

        <div className="relative p-3">
          {/* Header: Category and Action Icons */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="h-5 w-16 animate-pulse rounded-lg bg-slate-300/50 dark:bg-slate-600/50" />

            <div className="flex items-center gap-2">
              <div className="h-7 w-7 animate-pulse rounded-lg bg-slate-300/50 dark:bg-slate-600/50" />
              <div className="h-7 w-7 animate-pulse rounded-lg bg-slate-300/50 dark:bg-slate-600/50" />
            </div>
          </div>

          {/* Title */}
          <div className="mb-2 space-y-2">
            <div className="h-4 animate-pulse rounded bg-slate-300/50 dark:bg-slate-600/50" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-300/50 dark:bg-slate-600/50" />
          </div>

          {/* Content */}
          <div className="mb-3 space-y-2">
            <div className="h-3 animate-pulse rounded bg-slate-200/50 dark:bg-slate-700/50" />
            <div className="h-3 animate-pulse rounded bg-slate-200/50 dark:bg-slate-700/50" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-slate-200/50 dark:bg-slate-700/50" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200/50 dark:bg-slate-700/50" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="h-3 w-20 animate-pulse rounded bg-slate-200/50 dark:bg-slate-700/50" />
            <div className="h-3 w-12 animate-pulse rounded bg-slate-200/50 dark:bg-slate-700/50" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ShimmerList() {
  return (
    <div className="mx-auto max-w-4xl space-y-3 px-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <ShimmerCard key={index} />
      ))}
    </div>
  );
}
