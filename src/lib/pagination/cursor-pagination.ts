/**
 * Cursor-Based Pagination Implementation for RR-175
 *
 * Replaces OFFSET-based pagination with cursor-based pagination for improved
 * performance, especially with large datasets.
 */

// Secure client-side pagination using API endpoints
// No direct database access - all operations go through secure server routes
import { Article } from "@/lib/db/types";

// Default page size
const DEFAULT_PAGE_SIZE = 50;

// Pagination parameters interface
export interface CursorPaginationParams {
  cursor?: string;
  direction?: "next" | "prev";
  pageSize?: number;
  feedId?: string;
  userId?: string;
  isRead?: boolean;
}

// Pagination result interface
export interface PaginationResult {
  articles: Article[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasNext: boolean;
  hasPrev: boolean;
  total?: number;
}

/**
 * CursorPagination class for efficient article pagination
 */
export class CursorPagination {
  /**
   * Fetch articles with cursor-based pagination via secure API
   * @param params - Pagination parameters
   * @returns Paginated articles result
   */
  static async fetchArticles(
    params: CursorPaginationParams
  ): Promise<PaginationResult> {
    try {
      // Build query parameters
      const searchParams = new URLSearchParams();

      if (params.cursor) searchParams.set("cursor", params.cursor);
      if (params.direction) searchParams.set("direction", params.direction);
      if (params.pageSize)
        searchParams.set("pageSize", params.pageSize.toString());
      else searchParams.set("pageSize", DEFAULT_PAGE_SIZE.toString());
      if (params.feedId) searchParams.set("feedId", params.feedId);
      if (params.userId) searchParams.set("userId", params.userId);
      if (params.isRead !== undefined)
        searchParams.set("isRead", params.isRead.toString());

      const response = await fetch(
        `/reader/api/articles/paginated?${searchParams.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        console.error(
          "Failed to fetch paginated articles:",
          response.statusText
        );
        return {
          articles: [],
          nextCursor: null,
          prevCursor: null,
          hasNext: false,
          hasPrev: false,
        };
      }

      const data = await response.json();
      return {
        articles: data.articles || [],
        nextCursor: data.nextCursor,
        prevCursor: data.prevCursor,
        hasNext: data.hasNext,
        hasPrev: data.hasPrev,
        total: data.total,
      };
    } catch (error) {
      console.error("Error in fetchArticles:", error);
      return {
        articles: [],
        nextCursor: null,
        prevCursor: null,
        hasNext: false,
        hasPrev: false,
      };
    }
  }

  /**
   * Fetch first page of articles
   * @param params - Base pagination parameters
   * @returns First page result
   */
  static async fetchFirstPage(
    params: Omit<CursorPaginationParams, "cursor" | "direction">
  ): Promise<PaginationResult> {
    return this.fetchArticles({
      ...params,
      direction: "next",
    });
  }

  /**
   * Fetch next page of articles
   * @param cursor - Current cursor position
   * @param params - Base pagination parameters
   * @returns Next page result
   */
  static async fetchNextPage(
    cursor: string,
    params: Omit<CursorPaginationParams, "cursor" | "direction">
  ): Promise<PaginationResult> {
    return this.fetchArticles({
      ...params,
      cursor,
      direction: "next",
    });
  }

  /**
   * Fetch previous page of articles
   * @param cursor - Current cursor position
   * @param params - Base pagination parameters
   * @returns Previous page result
   */
  static async fetchPreviousPage(
    cursor: string,
    params: Omit<CursorPaginationParams, "cursor" | "direction">
  ): Promise<PaginationResult> {
    return this.fetchArticles({
      ...params,
      cursor,
      direction: "prev",
    });
  }
}

// Export default instance
export default CursorPagination;
