import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

interface FeedStats extends FetchStats {
  feedId: string;
  feedTitle: string;
  avgDurationMs: number | null;
}

interface RecentFailure {
  articleId: string;
  articleTitle: string;
  feedTitle: string;
  errorReason: string | null;
  originalUrl: string | null;
  timestamp: string;
}

export async function GET() {
  try {
    // Get all fetch logs with related data
    const { data: allLogs, error: logsError } = await supabase
      .from('fetch_logs')
      .select(`
        id,
        fetch_type,
        status,
        created_at,
        duration_ms,
        feed_id,
        feeds!inner(title)
      `);

    if (logsError) throw logsError;

    // Get timezone info for date calculations
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Process overall statistics
    const overallStats = {
      today: { auto: { total: 0, successful: 0, failed: 0 }, manual: { total: 0, successful: 0, failed: 0 } },
      thisMonth: { auto: { total: 0, successful: 0, failed: 0 }, manual: { total: 0, successful: 0, failed: 0 } },
      lifetime: { auto: { total: 0, successful: 0, failed: 0 }, manual: { total: 0, successful: 0, failed: 0 } }
    };

    // Process feed statistics
    const feedStatsMap = new Map<string, any>();

    allLogs?.forEach((log: any) => {
      const logDate = new Date(log.created_at);
      let period: 'today' | 'thisMonth' | 'lifetime' = 'lifetime';
      
      if (logDate >= today) {
        period = 'today';
      } else if (logDate >= thisMonth) {
        period = 'thisMonth';
      }

      // Update overall stats
      if (log.status !== 'attempt') {
        overallStats[period][log.fetch_type].total++;
        overallStats.lifetime[log.fetch_type].total++;
        
        if (log.status === 'success') {
          overallStats[period][log.fetch_type].successful++;
          overallStats.lifetime[log.fetch_type].successful++;
        } else if (log.status === 'failure') {
          overallStats[period][log.fetch_type].failed++;
          overallStats.lifetime[log.fetch_type].failed++;
        }

        // Also update thisMonth if it's today
        if (period === 'today') {
          overallStats.thisMonth[log.fetch_type].total++;
          if (log.status === 'success') {
            overallStats.thisMonth[log.fetch_type].successful++;
          } else if (log.status === 'failure') {
            overallStats.thisMonth[log.fetch_type].failed++;
          }
        }
      }

      // Update feed stats
      const feedKey = log.feed_id;
      if (!feedStatsMap.has(feedKey)) {
        feedStatsMap.set(feedKey, {
          feedId: log.feed_id,
          feedTitle: log.feeds.title,
          today: { 
            auto: { total: 0, successful: 0, failed: 0, durations: [] }, 
            manual: { total: 0, successful: 0, failed: 0, durations: [] } 
          },
          thisMonth: { 
            auto: { total: 0, successful: 0, failed: 0, durations: [] }, 
            manual: { total: 0, successful: 0, failed: 0, durations: [] } 
          },
          lifetime: { 
            auto: { total: 0, successful: 0, failed: 0, durations: [] }, 
            manual: { total: 0, successful: 0, failed: 0, durations: [] } 
          }
        });
      }

      const feedStats = feedStatsMap.get(feedKey);
      if (log.status !== 'attempt') {
        feedStats[period][log.fetch_type].total++;
        feedStats.lifetime[log.fetch_type].total++;
        
        if (log.status === 'success') {
          feedStats[period][log.fetch_type].successful++;
          feedStats.lifetime[log.fetch_type].successful++;
          
          if (log.duration_ms) {
            feedStats[period][log.fetch_type].durations.push(log.duration_ms);
            feedStats.lifetime[log.fetch_type].durations.push(log.duration_ms);
          }
        } else if (log.status === 'failure') {
          feedStats[period][log.fetch_type].failed++;
          feedStats.lifetime[log.fetch_type].failed++;
        }

        // Also update thisMonth if it's today
        if (period === 'today') {
          feedStats.thisMonth[log.fetch_type].total++;
          if (log.status === 'success') {
            feedStats.thisMonth[log.fetch_type].successful++;
            if (log.duration_ms) {
              feedStats.thisMonth[log.fetch_type].durations.push(log.duration_ms);
            }
          } else if (log.status === 'failure') {
            feedStats.thisMonth[log.fetch_type].failed++;
          }
        }
      }
    });

    // Get most problematic feeds this month
    const { data: problematicData, error: problematicError } = await supabase
      .from('fetch_logs')
      .select(`
        feeds!inner(title)
      `)
      .eq('status', 'failure')
      .gte('created_at', thisMonth.toISOString());

    if (problematicError) throw problematicError;

    // Count failures by feed
    const failureCountMap = new Map<string, number>();
    problematicData?.forEach((log: any) => {
      const feedTitle = log.feeds.title;
      failureCountMap.set(feedTitle, (failureCountMap.get(feedTitle) || 0) + 1);
    });

    const problematicFeeds = Array.from(failureCountMap.entries())
      .map(([feedTitle, failureCount]) => ({ feedTitle, failureCount }))
      .sort((a, b) => b.failureCount - a.failureCount)
      .slice(0, 5);

    // Get recent failed articles
    const { data: recentFailuresData, error: recentFailuresError } = await supabase
      .from('fetch_logs')
      .select(`
        article_id,
        articles!inner(title, url),
        feeds!inner(title),
        error_reason,
        created_at
      `)
      .eq('status', 'failure')
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentFailuresError) throw recentFailuresError;

    // Process the data into the expected format
    const formatStats = (stats: any): FetchStats => {
      const total = stats.auto.total + stats.manual.total;
      const successful = stats.auto.successful + stats.manual.successful;
      const failed = stats.auto.failed + stats.manual.failed;

      return {
        total,
        successful,
        failed,
        successRate: total > 0 ? Math.round((successful / total) * 1000) / 10 : 0,
        auto: {
          total: stats.auto.total,
          successful: stats.auto.successful,
          failed: stats.auto.failed
        },
        manual: {
          total: stats.manual.total,
          successful: stats.manual.successful,
          failed: stats.manual.failed
        }
      };
    };

    // Format feed statistics (sort by total lifetime fetches descending)
    const feeds = Array.from(feedStatsMap.values())
      .filter(feed => (feed.lifetime.auto.total + feed.lifetime.manual.total) > 0)
      .sort((a, b) => {
        const aTotal = a.lifetime.auto.total + a.lifetime.manual.total;
        const bTotal = b.lifetime.auto.total + b.lifetime.manual.total;
        return bTotal - aTotal;
      })
      .map(feed => {
      const calculateAvgDuration = (durations: number[]) => {
        if (durations.length === 0) return null;
        const sum = durations.reduce((a, b) => a + b, 0);
        return Math.round(sum / durations.length);
      };

      const formatPeriod = (period: any) => {
        const auto = period.auto;
        const manual = period.manual;
        const total = auto.total + manual.total;
        const successful = auto.successful + manual.successful;
        const failed = auto.failed + manual.failed;
        const allDurations = [...auto.durations, ...manual.durations];

        return {
          total,
          successful,
          failed,
          successRate: total > 0 ? Math.round((successful / total) * 1000) / 10 : 0,
          auto: {
            total: auto.total,
            successful: auto.successful,
            failed: auto.failed
          },
          manual: {
            total: manual.total,
            successful: manual.successful,
            failed: manual.failed
          },
          avgDurationMs: calculateAvgDuration(allDurations)
        };
      };

      return {
        feedId: feed.feedId,
        feedTitle: feed.feedTitle,
        today: formatPeriod(feed.today),
        thisMonth: formatPeriod(feed.thisMonth),
        lifetime: formatPeriod(feed.lifetime)
      };
    });

    // Format recent failures
    const recentFailures: RecentFailure[] = recentFailuresData?.map((row: any) => ({
      articleId: row.article_id,
      articleTitle: row.articles.title,
      feedTitle: row.feeds.title,
      errorReason: row.error_reason,
      originalUrl: row.articles.url,
      timestamp: row.created_at
    })) || [];

    // Return the complete response
    return NextResponse.json({
      overall: {
        today: formatStats(overallStats.today),
        thisMonth: formatStats(overallStats.thisMonth),
        lifetime: formatStats(overallStats.lifetime)
      },
      feeds,
      topIssues: {
        problematicFeeds,
        recentFailures
      }
    });

  } catch (error) {
    console.error('Fetch stats error:', error);
    return NextResponse.json({
      error: 'Failed to get fetch statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}