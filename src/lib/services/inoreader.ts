import {
  inoreaderApi,
  Subscription,
  StreamContentsResponse,
} from "@/lib/api/inoreader";

export interface FetchArticlesOptions {
  count: number;
  userId: string;
  feedId?: string;
  continuation?: string;
}

export interface SubscriptionsResult {
  subscriptions: Array<{
    id: string;
    title: string;
  }>;
}

export async function getSubscriptions(): Promise<SubscriptionsResult> {
  try {
    const result = await inoreaderApi.getSubscriptions();

    return {
      subscriptions: result.subscriptions.map((sub: Subscription) => ({
        id: sub.id,
        title: sub.title,
      })),
    };
  } catch (error) {
    console.error("Failed to get subscriptions:", error);
    throw error;
  }
}

export async function fetchArticles(
  options: FetchArticlesOptions
): Promise<StreamContentsResponse> {
  try {
    // Determine stream ID based on feedId or use all items
    const streamId = options.feedId || "user/-/state/com.google/reading-list";

    // Fetch articles from Inoreader
    const response = await inoreaderApi.getStreamContents(streamId, {
      count: options.count,
      continuation: options.continuation,
    });

    return response;
  } catch (error) {
    console.error("Failed to fetch articles:", error);
    throw error;
  }
}
