import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '@/lib/db/database';
import { inoreaderService } from '@/lib/api/inoreader';

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
        
        setSyncing(true);
        setSyncError(null);
        
        try {
          // Process any queued offline actions first
          await processQueue();
          
          // Simulate full sync - replace with actual implementation
          console.log('Starting full sync...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          setLastSyncTime(Date.now());
          console.log('Full sync completed successfully');
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