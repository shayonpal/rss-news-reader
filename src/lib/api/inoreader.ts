import { api } from './client';

// Base URL for Inoreader API
const INOREADER_API_BASE = 'https://www.inoreader.com/reader/api/0';

// Interface definitions
export interface UserInfo {
  userId: string;
  userName: string;
  userProfileId: string;
  userEmail: string;
}

export interface Subscription {
  id: string;
  title: string;
  categories: Category[];
  url: string;
  htmlUrl: string;
  iconUrl?: string;
}

export interface Category {
  id: string;
  label: string;
}

export interface UnreadCount {
  id: string;
  count: number;
  newestItemTimestampUsec: string;
}

export interface Article {
  id: string;
  title: string;
  author?: string;
  content: string;
  summary?: string;
  published: number;
  updated: number;
  canonical: string;
  categories: string[];
  origin: {
    streamId: string;
    title: string;
    htmlUrl: string;
  };
  enclosure?: {
    href: string;
    type: string;
    length?: string;
  }[];
}

export interface StreamContentsResponse {
  id: string;
  title: string;
  description: string;
  self: string;
  updated: number;
  items: Article[];
  continuation?: string;
}

// API methods
export const inoreaderApi = {
  // Get user information
  async getUserInfo(): Promise<UserInfo> {
    const response = await fetch(`${INOREADER_API_BASE}/user-info`, {
      credentials: 'include', // Include cookies
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Get subscription list
  async getSubscriptions(): Promise<{ subscriptions: Subscription[] }> {
    const response = await fetch('/api/inoreader/subscriptions', {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch subscriptions: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Get unread counts
  async getUnreadCounts(): Promise<{ unreadcounts: UnreadCount[] }> {
    const response = await fetch('/api/inoreader/unread-counts', {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch unread counts: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Get stream contents (articles)
  async getStreamContents(
    streamId: string,
    options: {
      count?: number;
      sortOrder?: 'newest' | 'oldest';
      continuation?: string;
      excludeTarget?: string;
    } = {}
  ): Promise<StreamContentsResponse> {
    const params = new URLSearchParams();
    params.set('streamId', streamId);
    params.set('n', (options.count || 100).toString());
    params.set('r', options.sortOrder === 'oldest' ? 'o' : 'n');
    
    if (options.continuation) {
      params.set('c', options.continuation);
    }
    
    if (options.excludeTarget) {
      params.set('xt', options.excludeTarget);
    }

    const response = await fetch(
      `/api/inoreader/stream-contents?${params}`,
      {
        credentials: 'include',
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch stream contents: ${response.statusText}`);
    }
    
    return response.json();
  },

  // Mark articles as read/unread
  async markAsRead(itemIds: string[]): Promise<void> {
    const response = await fetch('/api/inoreader/edit-tag', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        ac: 'edit-tags',
        a: 'user/-/state/com.google/read',
        ...Object.fromEntries(itemIds.map((id, index) => [`i${index}`, id])),
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to mark as read: ${response.statusText}`);
    }
  },

  async markAsUnread(itemIds: string[]): Promise<void> {
    const response = await fetch('/api/inoreader/edit-tag', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        ac: 'edit-tags',
        r: 'user/-/state/com.google/read',
        ...Object.fromEntries(itemIds.map((id, index) => [`i${index}`, id])),
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to mark as unread: ${response.statusText}`);
    }
  },

  // Star/unstar articles
  async addStar(itemIds: string[]): Promise<void> {
    const response = await fetch('/api/inoreader/edit-tag', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        ac: 'edit-tags',
        a: 'user/-/state/com.google/starred',
        ...Object.fromEntries(itemIds.map((id, index) => [`i${index}`, id])),
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to add star: ${response.statusText}`);
    }
  },

  async removeStar(itemIds: string[]): Promise<void> {
    const response = await fetch('/api/inoreader/edit-tag', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        ac: 'edit-tags',
        r: 'user/-/state/com.google/starred',
        ...Object.fromEntries(itemIds.map((id, index) => [`i${index}`, id])),
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to remove star: ${response.statusText}`);
    }
  },

  // Helper methods for common streams
  getAllArticles(options?: { count?: number; continuation?: string }) {
    return this.getStreamContents('user/-/state/com.google/reading-list', options);
  },

  getUnreadArticles(options?: { count?: number; continuation?: string }) {
    return this.getStreamContents('user/-/state/com.google/reading-list', {
      ...options,
      excludeTarget: 'user/-/state/com.google/read',
    });
  },

  getFeedArticles(feedId: string, options?: { count?: number; continuation?: string }) {
    return this.getStreamContents(feedId, options);
  },
};

// Export the service instance
export { inoreaderApi as inoreaderService };