import { NextResponse } from 'next/server';
import { db } from '@/lib/db/database';
import { isArticleDataCorrupted, cleanupArticleData } from '@/lib/utils/data-cleanup';

export async function GET() {
  try {
    // Get all articles
    const articles = await db.articles.toArray();
    
    // Check for corruption
    const corruptedArticles = articles.filter(isArticleDataCorrupted);
    
    return NextResponse.json({
      totalArticles: articles.length,
      corruptedArticles: corruptedArticles.length,
      corruptedIds: corruptedArticles.map(a => ({ 
        id: a.id, 
        title: a.title,
        contentType: typeof a.content,
        summaryType: typeof a.summary,
        contentPreview: typeof a.content === 'object' ? JSON.stringify(a.content).substring(0, 100) : null,
        summaryPreview: typeof a.summary === 'object' ? JSON.stringify(a.summary).substring(0, 100) : null
      }))
    });
  } catch (error) {
    console.error('Error checking data corruption:', error);
    return NextResponse.json({ error: 'Failed to check data corruption' }, { status: 500 });
  }
}

export async function POST() {
  try {
    // Get all articles
    const articles = await db.articles.toArray();
    
    // Find corrupted ones
    const corruptedArticles = articles.filter(isArticleDataCorrupted);
    
    if (corruptedArticles.length === 0) {
      return NextResponse.json({ 
        message: 'No corrupted articles found',
        cleaned: 0
      });
    }
    
    // Clean them up
    const cleanedArticles = corruptedArticles.map(cleanupArticleData);
    
    // Update in database
    await db.transaction('rw', db.articles, async () => {
      for (const article of cleanedArticles) {
        await db.articles.put(article);
      }
    });
    
    return NextResponse.json({
      message: `Cleaned up ${cleanedArticles.length} corrupted articles`,
      cleaned: cleanedArticles.length,
      cleanedIds: cleanedArticles.map(a => a.id)
    });
  } catch (error) {
    console.error('Error cleaning data corruption:', error);
    return NextResponse.json({ error: 'Failed to clean data corruption' }, { status: 500 });
  }
}