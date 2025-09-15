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
      className="glass-morphing glass-blur-md glass-border mb-6 rounded-lg p-4"
      data-testid="article-stats"
      style={{
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <h3 className="text-semantic-text-primary mb-4 font-medium">
        Article Statistics
      </h3>
      <div className="space-y-4">
        <div className="stat-item flex min-h-[44px] items-center justify-between">
          <span className="text-semantic-text-secondary">Total:</span>
          <span
            className="text-semantic-text-primary text-xl font-semibold"
            data-testid="total-count"
          >
            {formatNumber(stats.total)}
          </span>
        </div>
        <div className="stat-item flex min-h-[44px] items-center justify-between">
          <span className="text-semantic-text-secondary">Unread:</span>
          <span
            className="text-semantic-text-primary text-xl font-semibold"
            data-testid="unread-count"
          >
            {formatNumber(stats.unread)}
          </span>
        </div>
        <div className="stat-item flex min-h-[44px] items-center justify-between">
          <span className="text-semantic-text-secondary">Starred:</span>
          <span
            className="text-semantic-text-primary text-xl font-semibold"
            data-testid="starred-count"
          >
            {formatNumber(stats.starred)}
          </span>
        </div>
      </div>
    </div>
  );
}
