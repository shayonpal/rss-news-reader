import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Rss, RefreshCw, AlertCircle, Folder, FolderOpen } from 'lucide-react';
import { supabase, Feed, Folder as FolderType } from '../lib/supabase';

interface FeedsListProps {
  onFeedSelect?: (feedId: number, feedTitle: string) => void;
  onFolderSelect?: (folderId: number, folderTitle: string) => void;
}

export function FeedsList({ onFeedSelect, onFolderSelect }: FeedsListProps) {
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set([1, 2])); // Expand first two folders by default

  const fetchFoldersAndFeeds = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch folders
      const foldersResult = await supabase
        .from('folders')
        .select('*')
        .order('name', { ascending: true });

      if (foldersResult.error) {
        throw foldersResult.error;
      }

      // Fetch feeds
      const feedsResult = await supabase
        .from('feeds')
        .select('*')
        .order('title', { ascending: true });

      if (feedsResult.error) {
        throw feedsResult.error;
      }

      setFolders(foldersResult.data || []);
      setFeeds(feedsResult.data || []);
    } catch (err) {
      console.error('Error fetching folders and feeds:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch feeds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFoldersAndFeeds();
  }, []);

  const toggleFolderExpansion = (folderId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent folder selection when clicking expand/collapse
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleFolderClick = (folderId: number, folderName: string) => {
    if (onFolderSelect) {
      onFolderSelect(folderId, folderName);
    }
  };

  const handleFeedClick = (feedId: number, feedTitle: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent folder selection when clicking on feed
    if (onFeedSelect) {
      onFeedSelect(feedId, feedTitle);
    }
  };

  const getFeedsForFolder = (folderId: number) => {
    return feeds.filter(feed => feed.folder_id === folderId);
  };

  const getTotalUnreadForFolder = (folderId: number) => {
    return getFeedsForFolder(folderId).reduce((total, feed) => total + (feed.unread_count || 0), 0);
  };

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-3 py-6">
        <div className="flex items-center justify-center py-12">
          <div className="backdrop-blur-xl bg-white/60 dark:bg-slate-800/60 rounded-2xl border border-white/30 dark:border-slate-600/30 shadow-lg p-8">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
              <span className="text-slate-700 dark:text-slate-300">Loading feeds...</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-4xl mx-auto px-3 py-6">
        <div className="flex items-center justify-center py-12">
          <div className="backdrop-blur-xl bg-red-50/60 dark:bg-red-900/20 rounded-2xl border border-red-200/30 dark:border-red-700/30 shadow-lg p-8">
            <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
              <AlertCircle className="w-6 h-6" />
              <div>
                <p className="font-medium">Error loading feeds</p>
                <p className="text-sm opacity-75">{error}</p>
                <button 
                  onClick={fetchFoldersAndFeeds}
                  className="mt-3 px-4 py-2 bg-red-100 dark:bg-red-800/30 hover:bg-red-200 dark:hover:bg-red-700/30 rounded-lg transition-colors duration-200"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (folders.length === 0) {
    return (
      <main className="max-w-4xl mx-auto px-3 py-6">
        <div className="flex items-center justify-center py-12">
          <div className="backdrop-blur-xl bg-white/60 dark:bg-slate-800/60 rounded-2xl border border-white/30 dark:border-slate-600/30 shadow-lg p-8 text-center">
            <Rss className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-700 dark:text-slate-300 mb-2">No RSS feeds found</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Connect your Supabase database to see your RSS feeds
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-3 py-6">
      <div className="space-y-2">
        {folders.map((folder) => {
          const folderFeeds = getFeedsForFolder(folder.inoreader_id);
          const isExpanded = expandedFolders.has(folder.inoreader_id);
          const totalUnread = getTotalUnreadForFolder(folder.inoreader_id);

          return (
            <div key={folder.inoreader_id} className="space-y-1">
              {/* Folder Header */}
              <div
                onClick={() => handleFolderClick(folder.inoreader_id, folder.name)}
                className="w-full group cursor-pointer"
              >
                <div className="relative backdrop-blur-2xl transition-all duration-300 rounded-2xl border overflow-hidden hover:scale-[1.002] active:scale-[0.998] bg-white/40 dark:bg-slate-800/40 hover:bg-white/55 dark:hover:bg-slate-800/55 border-white/30 dark:border-slate-600/30 shadow-md shadow-black/5 dark:shadow-black/15">
                  
                  {/* Glass background layers */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/12 via-transparent to-white/6 dark:from-slate-700/12 dark:via-transparent dark:to-slate-800/6" />
                  
                  <div className="relative p-3">
                    <div className="flex items-center gap-3">
                      {/* Expand/Collapse Icon */}
                      <button
                        onClick={(e) => toggleFolderExpansion(folder.inoreader_id, e)}
                        className="flex-shrink-0 p-1 rounded-lg hover:bg-white/30 dark:hover:bg-slate-700/30 transition-colors duration-200"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-400 transition-transform duration-200" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400 transition-transform duration-200" />
                        )}
                      </button>
                      
                      {/* Folder Icon */}
                      <div className="flex-shrink-0">
                        {isExpanded ? (
                          <FolderOpen className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        ) : (
                          <Folder className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        )}
                      </div>
                      
                      {/* Folder Name */}
                      <span className="flex-1 text-left text-base font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                        {folder.name}
                      </span>
                      
                      {/* Total Unread Count */}
                      {totalUnread > 0 && (
                        <div className="flex-shrink-0">
                          <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-500/20 rounded-full border border-blue-500/30">
                            {totalUnread}
                          </span>
                        </div>
                      )}
                      
                      {/* Feed Count */}
                      <div className="flex-shrink-0">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {folderFeeds.length} feed{folderFeeds.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feeds List */}
              {isExpanded && folderFeeds.length > 0 && (
                <div className="ml-6 space-y-1">
                  {folderFeeds.map((feed) => (
                    <button
                      key={feed.id}
                      onClick={(e) => handleFeedClick(feed.id, feed.title, e)}
                      className="w-full group"
                    >
                      <div className="relative backdrop-blur-2xl transition-all duration-300 rounded-xl border overflow-hidden hover:scale-[1.002] active:scale-[0.998] bg-white/30 dark:bg-slate-800/30 hover:bg-white/45 dark:hover:bg-slate-800/45 border-white/25 dark:border-slate-600/25 shadow-sm shadow-black/5 dark:shadow-black/10">
                        
                        {/* Glass background layers */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-white/4 dark:from-slate-700/8 dark:via-transparent dark:to-slate-800/4" />
                        
                        <div className="relative p-3">
                          <div className="flex items-center gap-3">
                            {/* RSS Icon */}
                            <div className="flex-shrink-0">
                              <Rss className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            </div>
                            
                            {/* Feed Title */}
                            <span className="flex-1 text-left text-sm font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200 truncate">
                              {feed.title}
                            </span>
                            
                            {/* Unread Count */}
                            {feed.unread_count && feed.unread_count > 0 && (
                              <div className="flex-shrink-0">
                                <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-500/20 rounded-full border border-blue-500/30">
                                  {feed.unread_count}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Empty Folder Message */}
              {isExpanded && folderFeeds.length === 0 && (
                <div className="ml-6">
                  <div className="relative backdrop-blur-xl bg-white/20 dark:bg-slate-800/20 rounded-xl border border-white/20 dark:border-slate-600/20 p-4 text-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No feeds in this folder
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}