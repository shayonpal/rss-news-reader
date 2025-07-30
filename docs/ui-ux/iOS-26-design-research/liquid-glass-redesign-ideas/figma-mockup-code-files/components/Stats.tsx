import React from "react";
import {
  BarChart3,
  BookOpen,
  Eye,
  Star,
  Clock,
  TrendingUp,
} from "lucide-react";

export function Stats() {
  // Mock stats data
  const statsData = {
    totalArticles: 1247,
    unreadArticles: 89,
    readToday: 12,
    bookmarked: 34,
    averageReadTime: "4.2 min",
    thisWeekRead: 47,
  };

  const StatCard = ({
    icon: Icon,
    title,
    value,
    subtitle,
    trend,
  }: {
    icon: any;
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: { value: number; direction: "up" | "down" };
  }) => (
    <div className="relative overflow-hidden rounded-2xl border border-white/35 bg-white/50 shadow-lg shadow-black/10 backdrop-blur-2xl transition-all duration-300 hover:scale-[1.02] hover:bg-white/65 active:scale-[0.98] dark:border-slate-600/35 dark:bg-slate-800/50 dark:shadow-black/25 dark:hover:bg-slate-800/65">
      {/* Glass background layers */}
      <div className="to-white/8 dark:to-slate-800/8 absolute inset-0 bg-gradient-to-br from-white/15 via-transparent dark:from-slate-700/15 dark:via-transparent" />

      <div className="relative p-4">
        <div className="mb-3 flex items-start justify-between">
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/20 p-2">
            <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          {trend && (
            <div
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs ${
                trend.direction === "up"
                  ? "border border-green-500/30 bg-green-500/20 text-green-700 dark:text-green-400"
                  : "border border-red-500/30 bg-red-500/20 text-red-700 dark:text-red-400"
              }`}
            >
              <TrendingUp
                className={`h-3 w-3 ${trend.direction === "down" ? "rotate-180" : ""}`}
              />
              <span>{trend.value}%</span>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
            {title}
          </p>
          <p className="text-2xl font-semibold text-slate-900 dark:text-white">
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <main className="mx-auto max-w-4xl px-3 py-6">
      <div className="space-y-6">
        {/* Overview Section */}
        <div className="space-y-4">
          <div className="relative rounded-2xl border border-white/30 bg-white/40 p-4 backdrop-blur-xl dark:border-slate-600/30 dark:bg-slate-800/40">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 via-transparent to-white/5 dark:from-slate-700/10 dark:via-transparent dark:to-slate-800/5" />
            <div className="relative">
              <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                Reading Overview
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Your reading activity and progress
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={BookOpen}
              title="Total Articles"
              value={statsData.totalArticles.toLocaleString()}
              subtitle="All time"
              trend={{ value: 12, direction: "up" }}
            />
            <StatCard
              icon={Eye}
              title="Unread"
              value={statsData.unreadArticles}
              subtitle="Pending"
            />
            <StatCard
              icon={Clock}
              title="Read Today"
              value={statsData.readToday}
              subtitle="Articles"
              trend={{ value: 8, direction: "up" }}
            />
            <StatCard
              icon={Star}
              title="Bookmarked"
              value={statsData.bookmarked}
              subtitle="Saved for later"
            />
          </div>
        </div>

        {/* Additional Stats Section */}
        <div className="space-y-4">
          <div className="relative rounded-2xl border border-white/30 bg-white/40 p-4 backdrop-blur-xl dark:border-slate-600/30 dark:bg-slate-800/40">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 via-transparent to-white/5 dark:from-slate-700/10 dark:via-transparent dark:to-slate-800/5" />
            <div className="relative">
              <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                Reading Habits
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Insights into your reading patterns
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <StatCard
              icon={BarChart3}
              title="This Week"
              value={statsData.thisWeekRead}
              subtitle="Articles read"
              trend={{ value: 15, direction: "up" }}
            />
            <StatCard
              icon={Clock}
              title="Average Read Time"
              value={statsData.averageReadTime}
              subtitle="Per article"
            />
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="relative rounded-2xl border border-white/25 bg-white/30 p-6 text-center backdrop-blur-xl dark:border-slate-600/25 dark:bg-slate-800/30">
          <div className="from-white/8 to-white/4 dark:from-slate-700/8 dark:to-slate-800/4 absolute inset-0 rounded-2xl bg-gradient-to-br via-transparent dark:via-transparent" />
          <div className="relative">
            <BarChart3 className="mx-auto mb-4 h-12 w-12 text-slate-400" />
            <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
              More Stats Coming Soon
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              We're working on detailed analytics, reading streaks, and
              personalized insights to help you track your reading journey.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
