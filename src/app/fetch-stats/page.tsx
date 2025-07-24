'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, MousePointer, ChevronDown, ChevronRight } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

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

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/reader/api/analytics/fetch-stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const toggleFeedExpanded = (feedId: string) => {
    setExpandedFeeds(prev => {
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
    if (ms === null) return 'N/A';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const renderStatsSection = (stats: FetchStats, showPercentage = true) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-gray-600 dark:text-gray-400">Attempts</span>
        <div className="text-right">
          <div className="font-semibold">{stats.total}</div>
          <div className="text-xs text-gray-500 dark:text-gray-500">
            <RefreshCw className="inline w-3 h-3 mr-1" />
            {stats.auto.total}
            <span className="mx-1">•</span>
            <MousePointer className="inline w-3 h-3 mr-1" />
            {stats.manual.total}
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-gray-600 dark:text-gray-400">Success</span>
        <div className="text-right">
          <div className="font-semibold text-green-600 dark:text-green-400">
            {stats.successful}
            {showPercentage && stats.total > 0 && (
              <span className="ml-1 text-sm">({stats.successRate}%)</span>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500">
            <RefreshCw className="inline w-3 h-3 mr-1" />
            {stats.auto.successful}
            <span className="mx-1">•</span>
            <MousePointer className="inline w-3 h-3 mr-1" />
            {stats.manual.successful}
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-gray-600 dark:text-gray-400">Failed</span>
        <div className="text-right">
          <div className={cn(
            "font-semibold",
            stats.failed > 0 ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400"
          )}>
            {stats.failed}
            {showPercentage && stats.total > 0 && stats.failed > 0 && (
              <span className="ml-1 text-sm">({((stats.failed / stats.total) * 100).toFixed(1)}%)</span>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500">
            <RefreshCw className="inline w-3 h-3 mr-1" />
            {stats.auto.failed}
            <span className="mx-1">•</span>
            <MousePointer className="inline w-3 h-3 mr-1" />
            {stats.manual.failed}
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-600 dark:border-gray-600 dark:border-t-gray-300"></div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400">{error || 'Failed to load stats'}</p>
            <button
              onClick={fetchStats}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
      <header className="fixed top-0 left-0 right-0 z-10 bg-background border-b">
        <div className="flex items-center h-[60px] px-4">
          <IOSButton onClick={() => router.back()} className="mr-3">
            <ArrowLeft className="w-5 h-5" />
          </IOSButton>
          <h1 className="text-lg font-semibold">Fetch Statistics</h1>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-[60px]" />

      {/* Content */}
      <div className="p-4 space-y-6 pb-20">
        {/* Overall Statistics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-4">OVERALL STATISTICS</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Today</h3>
              {renderStatsSection(stats.overall.today)}
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">This Month</h3>
              {renderStatsSection(stats.overall.thisMonth)}
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Lifetime</h3>
              {renderStatsSection(stats.overall.lifetime)}
            </div>
          </div>
        </div>

        {/* Feeds with Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-4">FEEDS WITH ACTIVITY</h2>
          <div className="space-y-2">
            {stats.feeds
              .filter(feed => feed.lifetime.total > 0)
              .map(feed => (
                <div key={feed.feedId} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                  <button
                    onClick={() => toggleFeedExpanded(feed.feedId)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center">
                      {expandedFeeds.has(feed.feedId) ? (
                        <ChevronDown className="w-4 h-4 mr-2" />
                      ) : (
                        <ChevronRight className="w-4 h-4 mr-2" />
                      )}
                      <span className="font-medium">{feed.feedTitle}</span>
                    </div>
                    <span className={cn(
                      "text-sm font-medium",
                      feed.lifetime.successRate >= 95 ? "text-green-600 dark:text-green-400" :
                      feed.lifetime.successRate >= 80 ? "text-yellow-600 dark:text-yellow-400" :
                      "text-red-600 dark:text-red-400"
                    )}>
                      {feed.lifetime.successRate}% success
                    </span>
                  </button>
                  {expandedFeeds.has(feed.feedId) && (
                    <div className="px-4 pb-4 grid grid-cols-3 gap-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Today</h4>
                        {renderStatsSection(feed.today, false)}
                        {feed.today.avgDurationMs !== null && (
                          <div className="mt-2 text-xs text-gray-500">
                            Avg: {formatDuration(feed.today.avgDurationMs)}
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">This Month</h4>
                        {renderStatsSection(feed.thisMonth, false)}
                        {feed.thisMonth.avgDurationMs !== null && (
                          <div className="mt-2 text-xs text-gray-500">
                            Avg: {formatDuration(feed.thisMonth.avgDurationMs)}
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Lifetime</h4>
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
        {(stats.topIssues.problematicFeeds.length > 0 || stats.topIssues.recentFailures.length > 0) && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-semibold mb-4">TOP ISSUES THIS MONTH</h2>
            
            {stats.topIssues.problematicFeeds.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Most Problematic Feeds:</h3>
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
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Recent Failed Articles:</h3>
                <div className="space-y-3">
                  {stats.topIssues.recentFailures.map((failure, index) => (
                    <div key={index} className="border-l-2 border-red-400 pl-3">
                      <p className="text-sm font-medium line-clamp-1">{failure.articleTitle}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {failure.feedTitle} • {formatDistanceToNow(new Date(failure.timestamp), { addSuffix: true })}
                      </p>
                      {failure.errorReason && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{failure.errorReason}</p>
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