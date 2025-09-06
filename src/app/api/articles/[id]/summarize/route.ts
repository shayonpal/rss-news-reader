import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { SummaryPromptBuilder } from "@/lib/ai/summary-prompt";
import { withArticleIdValidation } from "@/lib/utils/uuid-validation-middleware";
import { ArticleContentService } from "@/lib/services/article-content-service";
import { ApiUsageTracker } from "@/lib/api/api-usage-tracker";
import {
  decrypt,
  sanitizeErrorMessage,
  type EncryptedData,
} from "@/lib/utils/encryption";
import { ApiKeyCache } from "@/lib/utils/api-key-cache";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Initialize cache singleton
const apiKeyCache = ApiKeyCache.getInstance();

/**
 * Get API key for a user with caching and priority logic
 * @param userId The user ID (can be null)
 * @returns The API key and its source
 */
async function getApiKeyForUser(
  userId: string | null,
  preferences?: any
): Promise<{
  apiKey: string | null;
  keySource: "user" | "environment" | "none";
  preferences?: any;
}> {
  let apiKey: string | null = null;
  let keySource: "user" | "environment" | "none" = "none";

  // Check cache first if user is authenticated
  if (userId) {
    const cached = apiKeyCache.get(userId);
    if (cached) {
      return { apiKey: cached.key, keySource: cached.source, preferences };
    }

    // Not in cache, fetch from database if not already provided
    if (!preferences) {
      const { data } = await supabase
        .from("user_preferences")
        .select("preferences")
        .eq("user_id", userId)
        .single();
      preferences = data;
    }

    if (preferences?.preferences?.encryptedData?.apiKeys?.anthropic) {
      try {
        const encryptedKey = preferences.preferences.encryptedData.apiKeys
          .anthropic as EncryptedData;

        // Decrypt the user's API key
        if (encryptedKey.encrypted && encryptedKey.iv && encryptedKey.authTag) {
          apiKey = decrypt(encryptedKey);
          keySource = "user";

          // Cache the decrypted key
          apiKeyCache.set(userId, apiKey, keySource);
        }
      } catch (decryptError) {
        console.error("Failed to decrypt user API key:", decryptError);
      }
    }
  }

  // Fall back to environment variable if no user key
  if (!apiKey && process.env.ANTHROPIC_API_KEY) {
    apiKey = process.env.ANTHROPIC_API_KEY;
    keySource = "environment";

    // Cache environment key for authenticated users
    if (userId) {
      apiKeyCache.set(userId, apiKey, keySource);
    }
  }

  return { apiKey, keySource, preferences };
}

const postHandler = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const { id } = params;

    // Get user ID from auth
    const authHeader = request.headers.get("authorization");
    let userId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { data: userData } = await supabase.auth.getUser(token);
      userId = userData?.user?.id || null;
    }

    // Get API key with caching support and preferences
    const { apiKey, keySource, preferences } = await getApiKeyForUser(userId);

    // Return 403 if no API key is available
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Anthropic API key not configured. Please add your API key in Settings.",
        },
        { status: 403 }
      );
    }

    // Initialize Anthropic client with the selected API key
    const anthropic = new Anthropic({ apiKey });

    // Get article from database with feed information
    const { data: article, error: fetchError } = await supabase
      .from("articles")
      .select("*, feeds!inner(*)")
      .eq("id", id)
      .single();

    if (fetchError || !article) {
      return NextResponse.json(
        {
          error: "article_not_found",
          message: "Article not found",
          details: fetchError?.message,
        },
        { status: 404 }
      );
    }

    // Check if we already have a summary and if regeneration is requested
    const body = await request.json().catch(() => ({}));
    const forceRegenerate = body.regenerate === true;

    if (article.ai_summary && !forceRegenerate) {
      // Determine content source based on whether article has full content
      const contentSource =
        article.has_full_content && article.full_content ? "full" : "partial";

      return NextResponse.json({
        success: true,
        summary: article.ai_summary,
        cached: true,
        content_source: contentSource,
        full_content_fetched: false, // Not fetched in this request since it's cached
        key_source: keySource, // Include key source in response
      });
    }

    // RR-256: Auto-fetch full content for partial feeds before summarization
    const contentService = ArticleContentService.getInstance();
    const { content: contentToSummarize, wasFetched } =
      await contentService.ensureFullContent(article.id, article.feed_id);

    if (!contentToSummarize) {
      return NextResponse.json(
        {
          error: "no_content",
          message: "Article has no content to summarize",
        },
        { status: 400 }
      );
    }

    // Strip HTML tags for cleaner summarization
    const textContent = contentToSummarize
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Generate summary using Claude with configurable prompt
    const prompt = SummaryPromptBuilder.buildPrompt({
      title: article.title,
      author: article.author,
      publishedDate: article.published_at
        ? new Date(article.published_at).toLocaleDateString()
        : undefined,
      content:
        textContent.substring(0, 10000) +
        (textContent.length > 10000 ? "...[truncated]" : ""),
    });

    // Get model from user preferences or environment with fallback
    let claudeModel =
      process.env.CLAUDE_SUMMARIZATION_MODEL || "claude-sonnet-4-20250514";

    // Use preferences already fetched from getApiKeyForUser
    if (userId && preferences?.preferences?.ai?.model) {
      claudeModel = preferences.preferences.ai.model;
    }

    const completion = await anthropic.messages.create({
      model: claudeModel,
      max_tokens: 300,
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const summary =
      completion.content[0].type === "text"
        ? completion.content[0].text
        : "Failed to generate summary";

    // Update the article with AI summary
    const { error: updateError } = await supabase
      .from("articles")
      .update({
        ai_summary: summary,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Failed to update article with summary:", updateError);
      // Don't fail the request, just log the error
    }

    // Track API usage
    await trackApiUsage("claude", 1);

    return NextResponse.json({
      success: true,
      summary,
      cached: false,
      content_source: wasFetched ? "full" : "partial",
      full_content_fetched: wasFetched,
      key_source: keySource, // Include key source in response
    });
  } catch (error: unknown) {
    console.error("Summarization error:", error);

    // Sanitize error message to prevent API key exposure
    const errorMessage =
      error instanceof Error
        ? sanitizeErrorMessage(error.message)
        : "Unknown error";

    return NextResponse.json(
      {
        error: "summarization_failed",
        message: "Failed to generate summary",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
};

// Export the wrapped handler with UUID validation
export const POST = withArticleIdValidation(postHandler);

// Track API usage for rate limiting - RR-237: Updated to use ApiUsageTracker
async function trackApiUsage(service: string, count: number = 1) {
  const tracker = new ApiUsageTracker(supabase);
  const result = await tracker.trackUsageWithFallback({
    service,
    increment: count,
  });

  if (!result.success) {
    console.error("Failed to track API usage:", result.error);
  }
}
