import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
        
        if (actionQueue.length === 0) return;
        
        console.log(`Processing ${actionQueue.length} queued actions`);
        
        for (const action of actionQueue) {
          try {
            // Simulate API call - replace with actual implementation
            await simulateApiCall(action);
            removeFromQueue(action.id);
            console.log(`Successfully processed action: ${action.type} for article ${action.articleId}`);
          } catch (error) {
            console.error(`Failed to process action ${action.id}:`, error);
            
            if (action.retryCount < action.maxRetries) {
              incrementRetryCount(action.id);
            } else {
              console.warn(`Max retries reached for action ${action.id}, removing from queue`);
              removeFromQueue(action.id);
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

// Simulate API call for queued actions
async function simulateApiCall(action: QueuedAction): Promise<void> {
  // Random delay to simulate network
  const delay = Math.random() * 1000 + 500;
  await new Promise(resolve => setTimeout(resolve, delay));
  
  // Random failure for testing
  if (Math.random() < 0.1) {
    throw new Error('Simulated network error');
  }
  
  console.log(`API call successful: ${action.type} for article ${action.articleId}`);
}