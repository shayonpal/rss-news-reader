import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '@/lib/db/database';
import { inoreaderService } from '@/lib/api/inoreader';
import { ApiRateLimiter } from '@/lib/utils/api-rate-limiter';
import { supabase } from '@/lib/db/supabase';
import type { Feed, Article } from '@/types';
import type { Database } from '@/lib/db/types';

export interface QueuedAction {
  id: string;
  type: 'mark_read' | 'mark_unread' | 'star' | 'unstar';
  articleId: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface SyncState {
  // Sync status
  lastSyncTime: number | null;
  isSyncing: boolean;
  syncError: string | null;
  
  // Offline queue
  actionQueue: QueuedAction[];
  
  // Actions
  setLastSyncTime: (time: number) => void;
  setSyncing: (syncing: boolean) => void;
  setSyncError: (error: string | null) => void;
  
  // Queue management
  addToQueue: (action: Omit<QueuedAction, 'id' | 'timestamp' | 'retryCount'>) => void;
  removeFromQueue: (actionId: string) => void;
  incrementRetryCount: (actionId: string) => void;
  clearQueue: () => void;
  
  // Sync operations
  processQueue: () => Promise<void>;
  performFullSync: () => Promise<void>;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      // Initial state
      lastSyncTime: null,
      isSyncing: false,
      syncError: null,
      actionQueue: [],
      
      // Basic setters
      setLastSyncTime: (time) => set({ lastSyncTime: time }),
      setSyncing: (syncing) => set({ isSyncing: syncing }),
      setSyncError: (error) => set({ syncError: error }),
      
      // Queue management
      addToQueue: (actionData) => {
        const action: QueuedAction = {
          ...actionData,
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now(),
          retryCount: 0,
        };
        
        set((state) => ({
          actionQueue: [...state.actionQueue, action],
        }));
      },
      
      removeFromQueue: (actionId) => {
        set((state) => ({
          actionQueue: state.actionQueue.filter(action => action.id !== actionId),
        }));
      },
      
      incrementRetryCount: (actionId) => {
        set((state) => ({
          actionQueue: state.actionQueue.map(action =>
            action.id === actionId
              ? { ...action, retryCount: action.retryCount + 1 }
              : action
          ),
        }));
      },
      
      clearQueue: () => set({ actionQueue: [] }),
      
      // Sync operations
      processQueue: async () => {
        const { actionQueue, removeFromQueue, incrementRetryCount } = get();
        
        if (actionQueue.length === 0 || !navigator.onLine) return;
        
        console.log(`Processing ${actionQueue.length} queued actions`);
        
        // Store to database first
        await db.transaction('rw', db.pendingActions, async () => {
          for (const action of actionQueue) {
            const exists = await db.pendingActions.get(action.id);
            if (!exists) {
              await db.pendingActions.add({
                id: action.id,
                type: action.type,
                articleId: action.articleId,
                timestamp: new Date(action.timestamp),
                syncAttempts: action.retryCount,
                lastAttemptAt: new Date()
              });
            }
          }
        });
        
        for (const action of actionQueue) {
          try {
            // Process action based on type
            await processAction(action);
            
            // Remove from both queue and database
            removeFromQueue(action.id);
            await db.pendingActions.delete(action.id);
            
            console.log(`Successfully processed action: ${action.type} for article ${action.articleId}`);
          } catch (error) {
            console.error(`Failed to process action ${action.id}:`, error);
            
            if (action.retryCount < action.maxRetries) {
              incrementRetryCount(action.id);
              await db.pendingActions.update(action.id, {
                syncAttempts: action.retryCount + 1,
                lastAttemptAt: new Date()
              });
            } else {
              console.warn(`Max retries reached for action ${action.id}, removing from queue`);
              removeFromQueue(action.id);
              await db.pendingActions.delete(action.id);
            }
          }
        }
      },
      
      performFullSync: async () => {
        const { setSyncing, setSyncError, setLastSyncTime, processQueue } = get();
        
        // Check rate limit before syncing
        const estimatedCalls = 12; // 2 for metadata + ~10 for feeds
        if (!ApiRateLimiter.canMakeCall(estimatedCalls)) {
          const remaining = ApiRateLimiter.getRemainingCalls();
          setSyncError(`API rate limit: Only ${remaining} calls remaining today. Need ${estimatedCalls} for sync.`);
          console.error(`Sync aborted: Rate limit would be exceeded. ${remaining}/${100} calls remaining.`);
          return;
        }
        
        setSyncing(true);
        setSyncError(null);
        
        try {
          // Process any queued offline actions first
          await processQueue();
          
          console.log('Starting full sync...');
          const startTime = Date.now();
          let apiCalls = 0;
          
          // Step 1: Fetch subscription list and unread counts
          console.log('Fetching subscriptions and unread counts...');
          const [subscriptionsResponse, unreadCountsResponse] = await Promise.all([
            inoreaderService.getSubscriptions('manual-sync'),
            inoreaderService.getUnreadCounts('manual-sync')
          ]);
          apiCalls += 2;
          
          const { subscriptions } = subscriptionsResponse;
          const { unreadcounts } = unreadCountsResponse;
          
          // Create a map of unread counts for quick lookup
          const unreadCountMap = new Map<string, number>();
          unreadcounts.forEach(item => {
            unreadCountMap.set(item.id, item.count);
          });
          
          // Step 2: Process folders (categories) and feeds
          console.log(`Processing ${subscriptions.length} subscriptions...`);
          
          // First, create all folders
          const folderMap = new Map<string, string>(); // Inoreader ID -> local ID
          const processedFolders = new Set<string>();
          
          for (const subscription of subscriptions) {
            for (const category of subscription.categories || []) {
              if (!processedFolders.has(category.id)) {
                processedFolders.add(category.id);
                
                // Create or update folder
                const existingFolder = await db.folders.get(category.id);
                if (!existingFolder) {
                  await db.folders.add({
                    id: category.id,
                    title: category.label,
                    parentId: null, // Inoreader doesn't support nested folders
                    unreadCount: unreadCountMap.get(category.id) || 0,
                    isExpanded: true,
                    sortOrder: 0,
                    createdAt: new Date(),
                    updatedAt: new Date()
                  });
                } else {
                  await db.folders.update(category.id, {
                    unreadCount: unreadCountMap.get(category.id) || 0,
                    updatedAt: new Date()
                  });
                }
                folderMap.set(category.id, category.id);
              }
            }
          }
          
          // Then, create/update all feeds
          const feedsToUpdate: Feed[] = [];
          for (const subscription of subscriptions) {
            const folderId = subscription.categories.length > 0 
              ? subscription.categories[0].id 
              : null;
            
            const feed: Feed = {
              id: subscription.id,
              title: subscription.title,
              url: subscription.url,
              htmlUrl: subscription.htmlUrl,
              iconUrl: subscription.iconUrl,
              folderId,
              unreadCount: unreadCountMap.get(subscription.id) || 0,
              isActive: true,
              lastFetchedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            feedsToUpdate.push(feed);
          }
          
          // Bulk update feeds
          await db.transaction('rw', db.feeds, async () => {
            for (const feed of feedsToUpdate) {
              const existing = await db.feeds.get(feed.id);
              if (existing) {
                await db.feeds.update(feed.id, {
                  ...feed,
                  createdAt: existing.createdAt // Preserve creation date
                });
              } else {
                await db.feeds.add(feed);
              }
            }
          });
          
          // Step 3: Fetch recent articles for feeds with unread content
          console.log('Fetching recent articles...');
          const feedsWithUnread = subscriptions.filter(sub => 
            (unreadCountMap.get(sub.id) || 0) > 0
          );
          
          // Limit to top 10 feeds by unread count to optimize API calls
          // This reduces API calls from 20 to 10 per sync
          const topFeeds = feedsWithUnread
            .sort((a, b) => (unreadCountMap.get(b.id) || 0) - (unreadCountMap.get(a.id) || 0))
            .slice(0, 10);
          
          // Fetch articles for each feed (max 5 per feed for initial sync)
          const articlePromises = topFeeds.map(async (subscription) => {
            try {
              const response = await inoreaderService.getFeedArticles(subscription.id, { 
                count: 5,
                trigger: 'manual-sync'
              });
              apiCalls++;
              return { feedId: subscription.id, articles: response.items };
            } catch (error) {
              console.error(`Failed to fetch articles for feed ${subscription.id}:`, error);
              return { feedId: subscription.id, articles: [] };
            }
          });
          
          // Process in batches of 5 to avoid overwhelming the API
          const batchSize = 5;
          const allArticles: Article[] = [];
          
          for (let i = 0; i < articlePromises.length; i += batchSize) {
            const batch = articlePromises.slice(i, i + batchSize);
            const results = await Promise.all(batch);
            
            for (const { feedId, articles } of results) {
              const feed = feedsToUpdate.find(f => f.id === feedId);
              if (!feed) continue;
              
              for (const item of articles) {
                // Safely extract text content from potentially nested objects
                const extractContent = (contentObj: any): string => {
                  if (typeof contentObj === 'string') return contentObj;
                  if (typeof contentObj === 'object' && contentObj !== null && 'content' in contentObj) {
                    return typeof contentObj.content === 'string' ? contentObj.content : '';
                  }
                  return '';
                };

                const contentText = item.content ? extractContent(item.content) : extractContent(item.summary);
                const summaryText = item.summary ? extractContent(item.summary) : '';

                const article: Article = {
                  id: item.id,
                  title: item.title,
                  content: contentText,
                  summary: summaryText,
                  author: item.author,
                  publishedAt: new Date(item.published * 1000),
                  feedId: feed.id,
                  feedTitle: feed.title,
                  url: item.canonical?.[0]?.href || item.origin.htmlUrl || '',
                  isRead: item.categories?.includes('user/-/state/com.google/read') || false,
                  isPartial: !contentText || contentText.length < 200, // Mark as partial if content is short
                  inoreaderItemId: item.id,
                  createdAt: new Date(),
                  updatedAt: new Date()
                };
                
                allArticles.push(article);
              }
            }
          }
          
          // Bulk insert articles
          if (allArticles.length > 0) {
            console.log(`Inserting ${allArticles.length} articles...`);
            await db.transaction('rw', db.articles, async () => {
              for (const article of allArticles) {
                const existing = await db.articles.get(article.id);
                if (existing) {
                  await db.articles.update(article.id, {
                    ...article,
                    createdAt: existing.createdAt
                  });
                } else {
                  await db.articles.add(article);
                }
              }
            });
          }
          
          // Step 4: Sync to Supabase
          console.log('Syncing data to Supabase...');
          const supabaseUserId = await getOrCreateSupabaseUser();
          
          if (supabaseUserId) {
            try {
              // Sync folders to Supabase
              const foldersToSync = Array.from(processedFolders).map(folderId => ({
                user_id: supabaseUserId,
                inoreader_id: folderId,
                name: subscriptions.find(s => s.categories?.some(c => c.id === folderId))?.categories?.find(c => c.id === folderId)?.label || 'Unknown Folder',
                parent_id: null
              }));
              
              if (foldersToSync.length > 0) {
                const { error: folderError } = await supabase
                  .from('folders')
                  .upsert(foldersToSync, { onConflict: 'inoreader_id' });
                
                if (folderError) {
                  console.error('Failed to sync folders to Supabase:', folderError);
                } else {
                  console.log(`Synced ${foldersToSync.length} folders to Supabase`);
                }
              }
              
              // Sync feeds to Supabase and get their Supabase IDs
              const feedIdMap = new Map<string, string>(); // Inoreader ID -> Supabase ID
              
              if (feedsToUpdate.length > 0) {
                // Convert feeds to Supabase format
                const supabaseFeeds = feedsToUpdate.map(feed => toSupabaseFeed(feed, supabaseUserId));
                
                const { data: upsertedFeeds, error: feedError } = await supabase
                  .from('feeds')
                  .upsert(supabaseFeeds, { onConflict: 'inoreader_id' })
                  .select('id, inoreader_id');
                
                if (feedError) {
                  console.error('Failed to sync feeds to Supabase:', feedError);
                } else {
                  console.log(`Synced ${feedsToUpdate.length} feeds to Supabase`);
                  // Build map of Inoreader ID to Supabase ID
                  upsertedFeeds?.forEach(feed => {
                    feedIdMap.set(feed.inoreader_id, feed.id);
                  });
                }
              }
              
              // Sync articles to Supabase
              if (allArticles.length > 0 && feedIdMap.size > 0) {
                // Convert articles to Supabase format, only for feeds we have IDs for
                const supabaseArticles = allArticles
                  .filter(article => feedIdMap.has(article.feedId))
                  .map(article => toSupabaseArticle(article, feedIdMap.get(article.feedId)!));
                
                if (supabaseArticles.length > 0) {
                  // Batch insert articles in chunks to avoid overwhelming the database
                  const chunkSize = 50;
                  let syncedArticles = 0;
                  
                  for (let i = 0; i < supabaseArticles.length; i += chunkSize) {
                    const chunk = supabaseArticles.slice(i, i + chunkSize);
                    const { error: articleError } = await supabase
                      .from('articles')
                      .upsert(chunk, { onConflict: 'inoreader_id' });
                    
                    if (articleError) {
                      console.error('Failed to sync article batch to Supabase:', articleError);
                    } else {
                      syncedArticles += chunk.length;
                    }
                  }
                  
                  console.log(`Synced ${syncedArticles} articles to Supabase`);
                }
              }
            } catch (supabaseError) {
              // Log Supabase sync errors but don't fail the entire sync
              console.error('Supabase sync error:', supabaseError);
              setSyncError(`Data synced locally but Supabase sync failed: ${supabaseError instanceof Error ? supabaseError.message : 'Unknown error'}`);
            }
          } else {
            console.warn('Skipping Supabase sync - no user ID available');
          }
          
          // Step 5: Update stores to trigger UI refresh
          const feedStore = await import('./feed-store').then(m => m.useFeedStore.getState());
          const articleStore = await import('./article-store').then(m => m.useArticleStore.getState());
          
          await Promise.all([
            feedStore.loadFeedHierarchy(),
            articleStore.refreshArticles()
          ]);
          
          const endTime = Date.now();
          const duration = (endTime - startTime) / 1000;
          
          // Track API usage
          ApiRateLimiter.incrementUsage(apiCalls);
          
          setLastSyncTime(Date.now());
          console.log(`Full sync completed successfully in ${duration.toFixed(1)}s with ${apiCalls} API calls`);
          console.log(`Synced: ${subscriptions.length} feeds, ${allArticles.length} articles`);
          console.log(`API usage today: ${ApiRateLimiter.getUsagePercentage()}% (${100 - ApiRateLimiter.getRemainingCalls()}/100 calls)`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
          setSyncError(errorMessage);
          console.error('Sync failed:', error);
        } finally {
          setSyncing(false);
        }
      },
    }),
    {
      name: 'sync-store',
      partialize: (state) => ({
        lastSyncTime: state.lastSyncTime,
        actionQueue: state.actionQueue,
        // Don't persist temporary sync states
      }),
    }
  )
);

// Helper function to get or create Supabase user
async function getOrCreateSupabaseUser(): Promise<string | null> {
  try {
    // Get current user from auth store
    const authStore = await import('./auth-store').then(m => m.useAuthStore.getState());
    const currentUser = authStore.user;
    
    if (!currentUser) {
      console.warn('No authenticated user found for Supabase sync');
      return null;
    }
    
    // Check if user exists in Supabase
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('inoreader_id', currentUser.userId)
      .single();
    
    if (existingUser) {
      return existingUser.id;
    }
    
    // Create new user in Supabase
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        email: currentUser.userEmail || `${currentUser.userId}@inoreader.local`,
        inoreader_id: currentUser.userId,
        preferences: {}
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Failed to create Supabase user:', error);
      return null;
    }
    
    return newUser?.id || null;
  } catch (error) {
    console.error('Error in getOrCreateSupabaseUser:', error);
    return null;
  }
}

// Helper to convert IndexedDB feed to Supabase format
function toSupabaseFeed(feed: Feed, userId: string): Database['public']['Tables']['feeds']['Insert'] {
  return {
    user_id: userId,
    inoreader_id: feed.id,
    title: feed.title,
    url: feed.url,
    folder_id: feed.folderId,
    unread_count: feed.unreadCount || 0
  };
}

// Helper to convert IndexedDB article to Supabase format
function toSupabaseArticle(article: Article, feedSupabaseId: string): Database['public']['Tables']['articles']['Insert'] {
  return {
    feed_id: feedSupabaseId,
    inoreader_id: article.inoreaderItemId || article.id,
    title: article.title,
    content: article.content,
    url: article.url,
    published_at: article.publishedAt ? new Date(article.publishedAt).toISOString() : null,
    is_read: article.isRead || false,
    is_starred: false // We don't track starred in IndexedDB yet
  };
}

// Process individual action with Inoreader API
async function processAction(action: QueuedAction): Promise<void> {
  // Get article from database to get its Inoreader ID
  const article = await db.articles.get(action.articleId);
  if (!article || !article.inoreaderItemId) {
    throw new Error('Article not found or missing Inoreader ID');
  }
  
  switch (action.type) {
    case 'mark_read':
      await inoreaderService.markAsRead([article.inoreaderItemId]);
      break;
    case 'mark_unread':
      await inoreaderService.markAsUnread([article.inoreaderItemId]);
      break;
    case 'star':
      await inoreaderService.addStar([article.inoreaderItemId]);
      break;
    case 'unstar':
      await inoreaderService.removeStar([article.inoreaderItemId]);
      break;
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

// Monitor online status and process queue when back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Back online, processing queued actions...');
    useSyncStore.getState().processQueue();
  });
}