import { createClient } from "@/lib/supabase/server";

interface RetentionOptions {
  maxCount: number;
  preserveStarred?: boolean;
}

interface RetentionResult {
  deletedCount: number;
  retainedCount: number;
  preservedStarredCount: number;
  error: string | null;
}

export async function retainArticles(
  userId: string,
  options: RetentionOptions
): Promise<RetentionResult> {
  const result: RetentionResult = {
    deletedCount: 0,
    retainedCount: 0,
    preservedStarredCount: 0,
    error: null,
  };

  try {
    const supabase = await createClient();

    // Get current article count (through feeds relationship)
    const { count: totalCount, error: countError } = await supabase
      .from("articles")
      .select("*, feeds!inner(user_id)", { count: "exact", head: true })
      .eq("feeds.user_id", userId);

    if (countError) {
      result.error = `Failed to count articles: ${countError.message}`;
      return result;
    }

    if (!totalCount || totalCount <= options.maxCount) {
      // No retention needed
      result.retainedCount = totalCount || 0;
      return result;
    }

    // Get starred articles count if preserving
    let starredCount = 0;
    if (options.preserveStarred) {
      const { count, error: starredError } = await supabase
        .from("articles")
        .select("*, feeds!inner(user_id)", { count: "exact", head: true })
        .eq("feeds.user_id", userId)
        .eq("is_starred", true);

      if (starredError) {
        result.error = `Failed to count starred articles: ${starredError.message}`;
        return result;
      }

      starredCount = count || 0;
      result.preservedStarredCount = starredCount;
    }

    // Calculate how many articles to delete
    const articlesToDelete = totalCount - options.maxCount;

    if (articlesToDelete <= 0) {
      result.retainedCount = totalCount;
      return result;
    }

    // We'll get the article IDs first, then delete by ID since we need to join through feeds

    // Get articles to delete (oldest first, through feeds relationship)
    const selectQuery = supabase
      .from("articles")
      .select("id, feeds!inner(user_id)")
      .eq("feeds.user_id", userId)
      .order("published_at", { ascending: true })
      .limit(articlesToDelete);
      
    // Exclude starred articles if preserving
    if (options.preserveStarred) {
      selectQuery.eq("is_starred", false);
    }
      
    const { data: articlesToDeleteData, error: selectError } = await selectQuery;

    if (selectError) {
      result.error = `Failed to select articles for deletion: ${selectError.message}`;
      return result;
    }

    if (!articlesToDeleteData || articlesToDeleteData.length === 0) {
      result.retainedCount = totalCount;
      return result;
    }

    // Delete the selected articles
    const articleIds = articlesToDeleteData.map((a) => a.id);
    const { error: deleteError } = await supabase
      .from("articles")
      .delete()
      .in("id", articleIds);

    if (deleteError) {
      result.error = `Failed to delete articles: ${deleteError.message}`;
      return result;
    }

    result.deletedCount = articleIds.length;
    result.retainedCount = totalCount - result.deletedCount;
  } catch (error) {
    console.error("Retention error:", error);
    result.error =
      error instanceof Error ? error.message : "Unknown retention error";
  }

  return result;
}
