import React, { useState } from "react";
import {
  Bell,
  Palette,
  Download,
  Shield,
  Database,
  Zap,
  Mail,
  Globe,
  ChevronRight,
  Monitor,
  Sun,
  Moon,
  Check,
  RefreshCw,
  BookOpen,
  Star,
  Eye,
  Clock,
} from "lucide-react";

export function Settings() {
  const [notifications, setNotifications] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [themePreference, setThemePreference] = useState<
    "light" | "dark" | "system"
  >("system");
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [markAsReadOnScroll, setMarkAsReadOnScroll] = useState(false);

  const SettingCard = ({
    icon: Icon,
    title,
    subtitle,
    children,
    action,
  }: {
    icon: any;
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
    action?: React.ReactNode;
  }) => (
    <div className="relative overflow-hidden rounded-2xl border border-white/35 bg-white/50 shadow-lg shadow-black/10 backdrop-blur-2xl transition-all duration-300 dark:border-slate-600/35 dark:bg-slate-800/50 dark:shadow-black/25">
      {/* Glass background layers */}
      <div className="to-white/8 dark:to-slate-800/8 absolute inset-0 bg-gradient-to-br from-white/15 via-transparent dark:from-slate-700/15 dark:via-transparent" />

      <div className="relative p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/20 p-2">
              <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white">
                {title}
              </h3>
              {subtitle && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action}
        </div>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );

  const ToggleSwitch = ({
    enabled,
    onChange,
  }: {
    enabled: boolean;
    onChange: (value: boolean) => void;
  }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        enabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );

  const SelectOption = ({
    options,
    value,
    onChange,
  }: {
    options: { value: string; label: string; icon?: any }[];
    value: string;
    onChange: (value: string) => void;
  }) => (
    <div className="space-y-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className="group flex w-full items-center justify-between rounded-xl p-3 transition-colors duration-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
        >
          <div className="flex items-center gap-3">
            {option.icon && (
              <option.icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            )}
            <span className="text-sm font-medium text-slate-800 group-hover:text-blue-600 dark:text-slate-200 dark:group-hover:text-blue-400">
              {option.label}
            </span>
          </div>
          {value === option.value && (
            <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          )}
        </button>
      ))}
    </div>
  );

  return (
    <main className="mx-auto max-w-4xl px-3 py-6">
      <div className="space-y-6">
        {/* General Settings */}
        <div className="space-y-4">
          <div className="relative rounded-2xl border border-white/30 bg-white/40 p-4 backdrop-blur-xl dark:border-slate-600/30 dark:bg-slate-800/40">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 via-transparent to-white/5 dark:from-slate-700/10 dark:via-transparent dark:to-slate-800/5" />
            <div className="relative">
              <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                General
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Basic app preferences and behavior
              </p>
            </div>
          </div>

          <SettingCard
            icon={Bell}
            title="Notifications"
            subtitle="Get notified about new articles"
            action={
              <ToggleSwitch
                enabled={notifications}
                onChange={setNotifications}
              />
            }
          />

          <SettingCard
            icon={RefreshCw}
            title="Auto Refresh"
            subtitle="Automatically check for new articles"
            action={
              <ToggleSwitch enabled={autoRefresh} onChange={setAutoRefresh} />
            }
          >
            {autoRefresh && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Refresh interval (minutes)
                </p>
                <div className="flex items-center gap-4">
                  {[15, 30, 60, 120].map((minutes) => (
                    <button
                      key={minutes}
                      onClick={() => setRefreshInterval(minutes)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                        refreshInterval === minutes
                          ? "bg-blue-500 text-white"
                          : "bg-white/50 text-slate-700 hover:bg-white/70 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-600/50"
                      }`}
                    >
                      {minutes}m
                    </button>
                  ))}
                </div>
              </div>
            )}
          </SettingCard>

          <SettingCard
            icon={Eye}
            title="Mark as Read on Scroll"
            subtitle="Automatically mark articles as read when scrolled past"
            action={
              <ToggleSwitch
                enabled={markAsReadOnScroll}
                onChange={setMarkAsReadOnScroll}
              />
            }
          />
        </div>

        {/* Appearance Settings */}
        <div className="space-y-4">
          <div className="relative rounded-2xl border border-white/30 bg-white/40 p-4 backdrop-blur-xl dark:border-slate-600/30 dark:bg-slate-800/40">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 via-transparent to-white/5 dark:from-slate-700/10 dark:via-transparent dark:to-slate-800/5" />
            <div className="relative">
              <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                Appearance
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Customize the look and feel of the app
              </p>
            </div>
          </div>

          <SettingCard
            icon={Palette}
            title="Theme"
            subtitle="Choose your preferred color scheme"
          >
            <SelectOption
              options={[
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "system", label: "System", icon: Monitor },
              ]}
              value={themePreference}
              onChange={(value) =>
                setThemePreference(value as "light" | "dark" | "system")
              }
            />
          </SettingCard>
        </div>

        {/* Data & Privacy */}
        <div className="space-y-4">
          <div className="relative rounded-2xl border border-white/30 bg-white/40 p-4 backdrop-blur-xl dark:border-slate-600/30 dark:bg-slate-800/40">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 via-transparent to-white/5 dark:from-slate-700/10 dark:via-transparent dark:to-slate-800/5" />
            <div className="relative">
              <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                Data & Privacy
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Manage your data and privacy settings
              </p>
            </div>
          </div>

          <SettingCard
            icon={Database}
            title="Database Connection"
            subtitle="Connect to your Supabase database"
            action={<ChevronRight className="h-5 w-5 text-slate-400" />}
          />

          <SettingCard
            icon={Download}
            title="Export Data"
            subtitle="Download your articles and reading history"
            action={<ChevronRight className="h-5 w-5 text-slate-400" />}
          />

          <SettingCard
            icon={Shield}
            title="Privacy Settings"
            subtitle="Control how your data is used"
            action={<ChevronRight className="h-5 w-5 text-slate-400" />}
          />
        </div>

        {/* Advanced Settings */}
        <div className="space-y-4">
          <div className="relative rounded-2xl border border-white/30 bg-white/40 p-4 backdrop-blur-xl dark:border-slate-600/30 dark:bg-slate-800/40">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 via-transparent to-white/5 dark:from-slate-700/10 dark:via-transparent dark:to-slate-800/5" />
            <div className="relative">
              <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                Advanced
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Advanced features and integrations
              </p>
            </div>
          </div>

          <SettingCard
            icon={Zap}
            title="AI Features"
            subtitle="Configure AI summarization and recommendations"
            action={<ChevronRight className="h-5 w-5 text-slate-400" />}
          />

          <SettingCard
            icon={Mail}
            title="Email Digest"
            subtitle="Receive daily/weekly article summaries"
            action={<ChevronRight className="h-5 w-5 text-slate-400" />}
          />

          <SettingCard
            icon={Globe}
            title="RSS Import/Export"
            subtitle="Manage your RSS feed subscriptions"
            action={<ChevronRight className="h-5 w-5 text-slate-400" />}
          />
        </div>

        {/* App Info */}
        <div className="space-y-4">
          <div className="relative rounded-2xl border border-white/25 bg-white/30 p-6 text-center backdrop-blur-xl dark:border-slate-600/25 dark:bg-slate-800/30">
            <div className="from-white/8 to-white/4 dark:from-slate-700/8 dark:to-slate-800/4 absolute inset-0 rounded-2xl bg-gradient-to-br via-transparent dark:via-transparent" />
            <div className="relative">
              <BookOpen className="mx-auto mb-4 h-12 w-12 text-slate-400" />
              <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                RSS Reader v1.0
              </h3>
              <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
                Built with React, Tailwind CSS, and Supabase
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span>Made with ❤️ using Figma Make</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
