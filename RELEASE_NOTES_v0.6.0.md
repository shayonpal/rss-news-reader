# Release Notes - v0.6.0

**Release Date:** July 24, 2025  
**Version:** 0.6.0

## 🎉 Major Feature: Full Content Extraction

This release introduces a comprehensive **Full Content Extraction** system that allows you to read complete articles beyond the limited RSS snippets. This feature has been one of the most requested enhancements and is now fully implemented with both manual and automatic options.

### Key Highlights

#### 📖 Extract Full Articles
- **Manual Fetch Button**: Click "Fetch Full Content" in any article to extract the complete text
- **Automatic Fetching**: Mark feeds as "partial content" to automatically fetch full articles during sync
- **Smart Fallback**: If extraction fails, the app gracefully falls back to RSS content
- **Offline Access**: Extracted content is stored locally for reading without internet

#### 📊 Fetch Statistics Dashboard
- **Comprehensive Analytics**: New dashboard at `/reader/fetch-stats` shows detailed extraction metrics
- **Success Rates**: Monitor which feeds extract successfully vs those with issues
- **Performance Tracking**: See average fetch times and identify slow feeds
- **Usage Insights**: Track manual vs automatic fetch patterns

#### 🎯 Smart Content Display
- **Priority System**: Articles now display the best available content:
  1. AI summaries (shown in full)
  2. Full extracted content (4-line preview)
  3. RSS content (4-line preview)
- **Visual Indicators**: Easy to see which articles have full content available
- **Smooth Rendering**: No layout shifts when content loads

### Technical Improvements

- **Rate Limiting**: Automatic fetching limited to 50 articles per 30 minutes to respect websites
- **Database Schema**: New `fetch_logs` table tracks all extraction attempts for analytics
- **Error Handling**: Comprehensive logging helps identify and fix extraction issues
- **Performance**: Extraction happens server-side to maintain client performance

### Other Enhancements

- **Codebase Cleanup**: Removed duplicate files and obsolete code
- **Bug Fix**: Fixed automatic sync URL missing /reader prefix
- **Documentation**: Updated README with new features and corrected schema

### How to Use

1. **Manual Extraction**: Click "Fetch Full Content" button in any article
2. **Automatic Extraction**: 
   - Click More (⋮) menu in article view
   - Toggle "This feed has partial content"
   - Future syncs will automatically fetch full content
3. **View Statistics**: Click "Fetch Stats" button in the header or article menu

### Tested Feeds

The following feeds have been verified to work with automatic extraction:
- BBC News
- Forbes Technology
- Wawa News
- And many more!

### Coming Next

We're already planning the next features based on your feedback. Stay tuned for article search functionality and more UI enhancements.

---

**Note**: This is a self-hosted application. Make sure to update your deployment using PM2: `pm2 reload ecosystem`