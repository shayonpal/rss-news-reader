/**
 * TypeScript interfaces for Inoreader API responses
 * Based on Inoreader API documentation and actual response structure
 */

export interface InoreaderLink {
  href: string;
  type?: string;
}

export interface InoreaderSummary {
  content: string;
  direction?: string;
}

export interface InoreaderContent {
  content: string;
  direction?: string;
}

export interface InoreaderArticle {
  id: string;
  title?: string;
  canonical?: InoreaderLink[];
  alternate?: InoreaderLink[];
  summary?: InoreaderSummary;
  content?: InoreaderContent;
  author?: string;
  published?: number; // Unix timestamp
  updated?: number; // Unix timestamp
  crawlTimeMsec?: string;
  timestampUsec?: string;
  categories?: string[];
  origin?: {
    streamId?: string;
    title?: string;
    htmlUrl?: string;
  };
}

export interface InoreaderFetchResult {
  items: InoreaderArticle[];
  continuation?: string;
  id?: string;
  title?: string;
  description?: string;
  self?: InoreaderLink[];
  updated?: number;
}

export interface InoreaderSubscription {
  id: string;
  title: string;
  categories?: Array<{
    id: string;
    label: string;
  }>;
  sortid?: string;
  firstitemmsec?: string;
  url?: string;
  htmlUrl?: string;
  iconUrl?: string;
}

export interface InoreaderSubscriptionsResult {
  subscriptions: InoreaderSubscription[];
}

/**
 * Database article structure after transformation from Inoreader API
 */
export interface DatabaseArticle {
  id: string;
  title: string;
  url: string;
  content: string;
  author: string;
  published_at: string;
  feed_id: string;
  user_id: string;
  starred: boolean;
  read_status: boolean;
}
