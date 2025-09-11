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
  const [stats, setStats] = useState<StatsData | null>(null);
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
          setStats(data);
        }
      } catch (error) {
        // Silently handle errors as per spec
        console.error("Failed to fetch article stats:", error);
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
        className="glass-morphing glass-blur-md glass-border animate-pulse rounded-lg p-6"
        aria-busy="true"
        aria-label="Loading article statistics"
        role="status"
      >
        <div className="space-y-4">
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className="skeleton-stat flex items-center justify-between"
            >
              <div className="skeleton-label h-4 w-16 rounded bg-gray-200 dark:bg-gray-700"></div>
              <div className="skeleton-value h-8 w-12 rounded bg-gray-300 dark:bg-gray-600"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="glass-morphing glass-blur-md glass-border rounded-lg p-6">
      <dl className="stats-grid space-y-4">
        <div className="flex items-center justify-between">
          <dt className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Total Articles
          </dt>
          <dd className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {formatNumber(stats.total)}
          </dd>
        </div>

        <div className="flex items-center justify-between">
          <dt className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Unread
          </dt>
          <dd className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {formatNumber(stats.unread)}
          </dd>
        </div>

        <div className="flex items-center justify-between">
          <dt className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Starred
          </dt>
          <dd className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {formatNumber(stats.starred)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
