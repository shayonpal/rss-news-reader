'use client';

import { useState } from 'react';
import { X, Settings } from 'lucide-react';
import { useUIStore } from '@/lib/stores/ui-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SettingsDialog } from '@/components/settings/settings-dialog';

const mockFeeds = [
  { id: '1', name: 'All Articles', count: 152, active: true },
  { id: '2', name: 'Technology', count: 45, active: false },
  { id: '3', name: 'The Verge', count: 23, active: false },
  { id: '4', name: 'TechCrunch', count: 18, active: false },
  { id: '5', name: '9to5Mac', count: 12, active: false },
  { id: '6', name: 'Ars Technica', count: 8, active: false },
];

export function Navigation() {
  const { isSidebarOpen, setSidebarOpen } = useUIStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      {/* Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-80 transform bg-background shadow-lg transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-lg font-semibold">Feeds</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="h-9 w-9 md:hidden"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Feed List */}
          <div className="flex-1 overflow-y-auto p-4">
            <nav className="space-y-2">
              {mockFeeds.map((feed) => (
                <button
                  key={feed.id}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                    feed.active && "bg-accent text-accent-foreground"
                  )}
                >
                  <span className="font-medium">{feed.name}</span>
                  {feed.count > 0 && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                      {feed.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Footer */}
          <div className="border-t p-4">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                setSettingsOpen(true);
                setSidebarOpen(false);
              }}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </div>
        </div>
      </aside>

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}