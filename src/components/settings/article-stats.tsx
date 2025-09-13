/**
 * @fileoverview Article Statistics Component - RR-288
 * Displays article counts with loading skeleton states
 */

"use client";

import { useEffect, useState } from "react";

interface StatsData {
  total: number;
  unread: number;
  starred: number;
}

export function ArticleStats() {
  const [stats, setStats] = useState<StatsData>({
    total: 0,
    unread: 0,
    starred: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/reader/api/articles/stats", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          // Handle malformed responses by setting defaults
          setStats({
            total: data.total ?? 0,
            unread: data.unread ?? 0,
            starred: data.starred ?? 0,
          });
        } else {
          // Non-200 responses default to zeros
          setStats({ total: 0, unread: 0, starred: 0 });
        }
      } catch (error) {
        // API errors default to zeros (silent handling as per spec)
        setStats({ total: 0, unread: 0, starred: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Format number with thousand separators
  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  if (loading) {
    return (
      <div
        className="glass-morphing glass-blur-md glass-border mb-6 animate-pulse rounded-lg p-4"
        aria-busy="true"
        aria-label="Loading article statistics"
        role="status"
        data-testid="article-stats"
        style={{
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div className="space-y-4">
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className="skeleton-stat stat-item flex min-h-[44px] items-center justify-between"
            >
              <div className="skeleton-label h-4 w-16 rounded bg-gray-200 dark:bg-gray-700"></div>
              <div className="skeleton-value h-8 w-12 rounded bg-gray-300 dark:bg-gray-600"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="glass-morphing stats-container mb-6 space-y-4 rounded-lg p-4"
      data-testid="article-stats"
      aria-label="Article statistics summary"
    >
      <dl className="stats-grid space-y-4">
        <div className="stat-item flex min-h-[44px] items-center justify-between">
          <dt className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Total Articles
          </dt>
          <dd
            className="text-2xl font-semibold text-gray-900 dark:text-gray-100"
            aria-label={`Total articles: ${formatNumber(stats.total)}`}
          >
            {formatNumber(stats.total)}
          </dd>
        </div>

        <div className="stat-item flex min-h-[44px] items-center justify-between">
          <dt className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Unread
          </dt>
          <dd
            className="text-2xl font-semibold text-gray-900 dark:text-gray-100"
            aria-label={`Unread articles: ${formatNumber(stats.unread)}`}
          >
            {formatNumber(stats.unread)}
          </dd>
        </div>

        <div className="stat-item flex min-h-[44px] items-center justify-between">
          <dt className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Starred
          </dt>
          <dd
            className="text-2xl font-semibold text-gray-900 dark:text-gray-100"
            aria-label={`Starred articles: ${formatNumber(stats.starred)}`}
          >
            {formatNumber(stats.starred)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
