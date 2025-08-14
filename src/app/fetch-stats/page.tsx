"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  MousePointer,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { IOSButton } from "@/components/ui/ios-button";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface FetchStats {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  auto: {
    total: number;
    successful: number;
    failed: number;
  };
  manual: {
    total: number;
    successful: number;
    failed: number;
  };
}

interface FeedStats {
  feedId: string;
  feedTitle: string;
  today: FetchStats & { avgDurationMs: number | null };
  thisMonth: FetchStats & { avgDurationMs: number | null };
  lifetime: FetchStats & { avgDurationMs: number | null };
}

interface FetchStatsData {
  overall: {
    today: FetchStats;
    thisMonth: FetchStats;
    lifetime: FetchStats;
  };
  feeds: FeedStats[];
  topIssues: {
    problematicFeeds: Array<{ feedTitle: string; failureCount: number }>;
    recentFailures: Array<{
      articleId: string;
      articleTitle: string;
      feedTitle: string;
      errorReason: string | null;
      originalUrl: string | null;
      timestamp: string;
    }>;
  };
}

export default function FetchStatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<FetchStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFeeds, setExpandedFeeds] = useState<Set<string>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchStats();

    // Set up auto-refresh every 30 seconds when enabled
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchStats();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch("/reader/api/analytics/fetch-stats");
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      setStats(data);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  };

  const toggleFeedExpanded = (feedId: string) => {
    setExpandedFeeds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(feedId)) {
        newSet.delete(feedId);
      } else {
        newSet.add(feedId);
      }
      return newSet;
    });
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null) return "N/A";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const renderStatsSection = (stats: FetchStats, showPercentage = true) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-gray-600 dark:text-gray-400">Attempts</span>
        <div className="text-right">
          <div className="font-semibold">{stats.total}</div>
          <div className="text-xs text-gray-500 dark:text-gray-500">
            <RefreshCw className="mr-1 inline h-3 w-3" />
            {stats.auto.total}
            <span className="mx-1">•</span>
            <MousePointer className="mr-1 inline h-3 w-3" />
            {stats.manual.total}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-600 dark:text-gray-400">Success</span>
        <div className="text-right">
          <div className="font-semibold text-green-600 dark:text-green-400">
            {stats.successful}
            {showPercentage && stats.total > 0 && (
              <span className="ml-1 text-sm">({stats.successRate}%)</span>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500">
            <RefreshCw className="mr-1 inline h-3 w-3" />
            {stats.auto.successful}
            <span className="mx-1">•</span>
            <MousePointer className="mr-1 inline h-3 w-3" />
            {stats.manual.successful}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-600 dark:text-gray-400">Failed</span>
        <div className="text-right">
          <div
            className={cn(
              "font-semibold",
              stats.failed > 0
                ? "text-red-600 dark:text-red-400"
                : "text-gray-600 dark:text-gray-400"
            )}
          >
            {stats.failed}
            {showPercentage && stats.total > 0 && stats.failed > 0 && (
              <span className="ml-1 text-sm">
                ({((stats.failed / stats.total) * 100).toFixed(1)}%)
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500">
            <RefreshCw className="mr-1 inline h-3 w-3" />
            {stats.auto.failed}
            <span className="mx-1">•</span>
            <MousePointer className="mr-1 inline h-3 w-3" />
            {stats.manual.failed}
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600 dark:border-gray-600 dark:border-t-gray-300"></div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400">
              {error || "Failed to load stats"}
            </p>
            <button
              onClick={fetchStats}
              className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="fixed left-0 right-0 top-0 z-10 border-b bg-background">
        <div className="flex h-[60px] items-center justify-between px-4">
          <div className="flex items-center">
            <IOSButton onClick={() => router.back()} className="mr-3">
              <ArrowLeft className="h-5 w-5" />
            </IOSButton>
            <h1 className="text-lg font-semibold">Fetch Statistics</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
            </span>
            <IOSButton
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                "px-3 py-1 text-xs",
                autoRefresh && "bg-blue-100 dark:bg-blue-900"
              )}
            >
              <RefreshCw
                className={cn("mr-1 h-3 w-3", autoRefresh && "animate-spin")}
              />
              {autoRefresh ? "Auto" : "Manual"}
            </IOSButton>
            <IOSButton onClick={fetchStats} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </IOSButton>
          </div>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-[60px]" />

      {/* Content */}
      <div className="space-y-6 p-4 pb-20">
        {/* Overall Statistics */}
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold">OVERALL STATISTICS</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                Today
              </h3>
              {renderStatsSection(stats.overall.today)}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                This Month
              </h3>
              {renderStatsSection(stats.overall.thisMonth)}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                Lifetime
              </h3>
              {renderStatsSection(stats.overall.lifetime)}
            </div>
          </div>
        </div>

        {/* Feeds with Activity */}
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold">FEEDS WITH ACTIVITY</h2>
          <div className="space-y-2">
            {stats.feeds
              .filter((feed) => feed.lifetime.total > 0)
              .map((feed) => (
                <div
                  key={feed.feedId}
                  className="rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <button
                    onClick={() => toggleFeedExpanded(feed.feedId)}
                    className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <div className="flex items-center">
                      {expandedFeeds.has(feed.feedId) ? (
                        <ChevronDown className="mr-2 h-4 w-4" />
                      ) : (
                        <ChevronRight className="mr-2 h-4 w-4" />
                      )}
                      <span className="font-medium">{feed.feedTitle}</span>
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        feed.lifetime.successRate >= 95
                          ? "text-green-600 dark:text-green-400"
                          : feed.lifetime.successRate >= 80
                            ? "text-yellow-600 dark:text-yellow-400"
                            : "text-red-600 dark:text-red-400"
                      )}
                    >
                      {feed.lifetime.successRate}% success
                    </span>
                  </button>
                  {expandedFeeds.has(feed.feedId) && (
                    <div className="grid grid-cols-3 gap-4 border-t border-gray-200 px-4 pb-4 pt-4 dark:border-gray-700">
                      <div>
                        <h4 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                          Today
                        </h4>
                        {renderStatsSection(feed.today, false)}
                        {feed.today.avgDurationMs !== null && (
                          <div className="mt-2 text-xs text-gray-500">
                            Avg: {formatDuration(feed.today.avgDurationMs)}
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                          This Month
                        </h4>
                        {renderStatsSection(feed.thisMonth, false)}
                        {feed.thisMonth.avgDurationMs !== null && (
                          <div className="mt-2 text-xs text-gray-500">
                            Avg: {formatDuration(feed.thisMonth.avgDurationMs)}
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                          Lifetime
                        </h4>
                        {renderStatsSection(feed.lifetime, false)}
                        {feed.lifetime.avgDurationMs !== null && (
                          <div className="mt-2 text-xs text-gray-500">
                            Avg: {formatDuration(feed.lifetime.avgDurationMs)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* Top Issues This Month */}
        {(stats.topIssues.problematicFeeds.length > 0 ||
          stats.topIssues.recentFailures.length > 0) && (
          <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-lg font-semibold">
              TOP ISSUES THIS MONTH
            </h2>

            {stats.topIssues.problematicFeeds.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                  Most Problematic Feeds:
                </h3>
                <ul className="space-y-1">
                  {stats.topIssues.problematicFeeds.map((feed, index) => (
                    <li key={index} className="text-sm">
                      • {feed.feedTitle} ({feed.failureCount} failures)
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {stats.topIssues.recentFailures.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                  Recent Failed Articles:
                </h3>
                <div className="space-y-3">
                  {stats.topIssues.recentFailures.map((failure, index) => (
                    <div key={index} className="border-l-2 border-red-400 pl-3">
                      <p className="line-clamp-1 text-sm font-medium">
                        {failure.articleTitle}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {failure.feedTitle} •{" "}
                        {formatDistanceToNow(new Date(failure.timestamp), {
                          addSuffix: true,
                        })}
                      </p>
                      {failure.errorReason && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {failure.errorReason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
