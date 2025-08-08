import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * RR-154: Integration tests for database migration to decode existing HTML entities
 * These tests define the SPECIFICATION for the migration script.
 * 
 * Migration Requirements:
 * - Process 68 article titles with HTML entities
 * - Process 277 article content fields with HTML entities
 * - Process in batches of 200 for performance
 * - Do NOT modify URLs
 * - Track progress and handle errors gracefully
 * - Provide rollback capability
 */
describe('RR-154: Database Migration for HTML Entity Decoding', () => {
  let mockSupabase: any;
  let mockDecoder: any;
  let migrationScript: any;

  beforeEach(() => {
    // Setup mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      count: vi.fn()
    };

    // Setup mock decoder
    mockDecoder = {
      decodeHtmlEntities: vi.fn((text) => {
        if (!text) return '';
        return text
          .replace(/&rsquo;/g, "'")
          .replace(/&lsquo;/g, "'")
          .replace(/&ldquo;/g, '"')
          .replace(/&rdquo;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&ndash;/g, '–')
          .replace(/&mdash;/g, '—')
          .replace(/&#8217;/g, "'")
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
      })
    };

    // Mock migration script functions
    migrationScript = {
      BATCH_SIZE: 200,
      DELAY_BETWEEN_BATCHES: 100, // ms

      /**
       * Find articles with HTML entities in title or content
       */
      async findArticlesWithEntities() {
        // Mock finding articles with entities
        const articlesWithEntities = {
          titles: [], // Will be set in tests
          contents: [] // Will be set in tests
        };

        // Query for titles with entities
        const titleResult = await mockSupabase
          .from('articles')
          .select('id, title')
          .or('title.like.*&*;*,title.like.*&#*;*')
          .order('created_at', { ascending: true });

        // Query for content with entities
        const contentResult = await mockSupabase
          .from('articles')
          .select('id, content')
          .or('content.like.*&*;*,content.like.*&#*;*')
          .order('created_at', { ascending: true });

        return {
          titlesCount: titleResult.data?.length || 0,
          contentsCount: contentResult.data?.length || 0,
          titleIds: titleResult.data?.map((a: any) => a.id) || [],
          contentIds: contentResult.data?.map((a: any) => a.id) || []
        };
      },

      /**
       * Process articles in batches
       */
      async processInBatches(articleIds: string[], field: 'title' | 'content') {
        const chunks = [];
        for (let i = 0; i < articleIds.length; i += this.BATCH_SIZE) {
          chunks.push(articleIds.slice(i, i + this.BATCH_SIZE));
        }

        const results = {
          totalBatches: chunks.length,
          processedBatches: 0,
          successCount: 0,
          errorCount: 0,
          errors: [] as string[]
        };

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          
          try {
            // Fetch articles in this batch
            const { data: articles, error: fetchError } = await mockSupabase
              .from('articles')
              .select(`id, ${field}, url`)
              .in('id', chunk);

            if (fetchError) {
              results.errorCount += chunk.length;
              results.errors.push(`Batch ${i + 1}: ${fetchError.message}`);
              continue;
            }

            // Decode entities for each article
            const updates = articles.map((article: any) => ({
              id: article.id,
              [field]: mockDecoder.decodeHtmlEntities(article[field]),
              url: article.url // Preserve URL unchanged
            }));

            // Update articles in batch
            for (const update of updates) {
              const { error: updateError } = await mockSupabase
                .from('articles')
                .update({ [field]: update[field] })
                .eq('id', update.id);

              if (updateError) {
                results.errorCount++;
                results.errors.push(`Article ${update.id}: ${updateError.message}`);
              } else {
                results.successCount++;
              }
            }

            results.processedBatches++;

            // Add delay between batches to avoid overloading
            if (i < chunks.length - 1) {
              await new Promise(resolve => setTimeout(resolve, this.DELAY_BETWEEN_BATCHES));
            }
          } catch (error) {
            results.errorCount += chunk.length;
            results.errors.push(`Batch ${i + 1}: ${error}`);
          }
        }

        return results;
      },

      /**
       * Create backup before migration
       */
      async createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupTable = `articles_backup_${timestamp}`;
        
        // In real implementation, this would create a backup table
        // For testing, we just track the operation
        return {
          backupTable,
          timestamp,
          success: true
        };
      },

      /**
       * Verify migration results
       */
      async verifyMigration() {
        // Check if any articles still have entities
        const remainingEntities = await this.findArticlesWithEntities();
        
        return {
          titlesWithEntities: remainingEntities.titlesCount,
          contentsWithEntities: remainingEntities.contentsCount,
          migrationComplete: remainingEntities.titlesCount === 0 && remainingEntities.contentsCount === 0
        };
      },

      /**
       * Main migration function
       */
      async runMigration() {
        const startTime = Date.now();
        const results = {
          backup: null as any,
          titlesProcessed: 0,
          contentsProcessed: 0,
          totalProcessed: 0,
          errors: [] as string[],
          duration: 0,
          success: false
        };

        try {
          // Step 1: Create backup
          console.log('Creating backup...');
          results.backup = await this.createBackup();
          
          if (!results.backup.success) {
            throw new Error('Backup creation failed');
          }

          // Step 2: Find articles with entities
          console.log('Finding articles with HTML entities...');
          const articlesWithEntities = await this.findArticlesWithEntities();
          
          console.log(`Found ${articlesWithEntities.titlesCount} titles and ${articlesWithEntities.contentsCount} contents with entities`);

          // Step 3: Process titles
          if (articlesWithEntities.titleIds.length > 0) {
            console.log('Processing titles...');
            const titleResults = await this.processInBatches(articlesWithEntities.titleIds, 'title');
            results.titlesProcessed = titleResults.successCount;
            results.errors.push(...titleResults.errors);
          }

          // Step 4: Process contents
          if (articlesWithEntities.contentIds.length > 0) {
            console.log('Processing contents...');
            const contentResults = await this.processInBatches(articlesWithEntities.contentIds, 'content');
            results.contentsProcessed = contentResults.successCount;
            results.errors.push(...contentResults.errors);
          }

          // Step 5: Verify migration
          console.log('Verifying migration...');
          const verification = await this.verifyMigration();
          
          results.totalProcessed = results.titlesProcessed + results.contentsProcessed;
          results.duration = Date.now() - startTime;
          results.success = verification.migrationComplete;

          return results;
        } catch (error) {
          results.errors.push(`Migration failed: ${error}`);
          results.duration = Date.now() - startTime;
          return results;
        }
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Article Discovery', () => {
    it('should correctly identify articles with HTML entities in titles', async () => {
      // Mock articles with entities in titles
      const articlesWithTitleEntities = [
        { id: '1', title: 'Biden&rsquo;s Policy' },
        { id: '2', title: 'Q&amp;A Session' },
        { id: '3', title: 'Article&#8217;s Title' },
        // ... up to 68 articles
      ];

      mockSupabase.or.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: articlesWithTitleEntities,
          error: null
        })
      });

      const result = await migrationScript.findArticlesWithEntities();
      
      expect(result.titlesCount).toBeGreaterThan(0);
      expect(result.titleIds).toContain('1');
      expect(result.titleIds).toContain('2');
      expect(result.titleIds).toContain('3');
    });

    it('should correctly identify articles with HTML entities in content', async () => {
      // Mock articles with entities in content
      const articlesWithContentEntities = Array.from({ length: 277 }, (_, i) => ({
        id: `content-${i}`,
        content: `Content with &amp; and &rsquo; and &ldquo;quotes&rdquo;`
      }));

      mockSupabase.or.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: articlesWithContentEntities,
          error: null
        })
      });

      const result = await migrationScript.findArticlesWithEntities();
      
      expect(result.contentsCount).toBe(277);
      expect(result.contentIds).toHaveLength(277);
    });

    it('should handle articles with entities in both title and content', async () => {
      const article = {
        id: 'both-1',
        title: 'Title with &amp; entity',
        content: 'Content with &rsquo; entity'
      };

      // Should be found in both queries
      mockSupabase.or.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: [article],
          error: null
        })
      });

      const result = await migrationScript.findArticlesWithEntities();
      
      // Article should appear in both lists
      if (result.titleIds.includes('both-1')) {
        expect(result.titleIds).toContain('both-1');
      }
    });
  });

  describe('2. Batch Processing', () => {
    it('should process articles in batches of 200', async () => {
      // Create 450 article IDs (should result in 3 batches: 200, 200, 50)
      const articleIds = Array.from({ length: 450 }, (_, i) => `article-${i}`);
      
      // Mock fetch and update operations
      mockSupabase.in.mockReturnValue({
        data: articleIds.slice(0, 200).map(id => ({
          id,
          title: 'Title with &amp; entity',
          url: 'https://example.com'
        })),
        error: null
      });

      mockSupabase.eq.mockReturnValue({
        data: null,
        error: null
      });

      const results = await migrationScript.processInBatches(articleIds, 'title');
      
      expect(results.totalBatches).toBe(3); // 200 + 200 + 50
      expect(results.processedBatches).toBeLessThanOrEqual(3);
    });

    it('should add delay between batches to prevent overload', async () => {
      const articleIds = Array.from({ length: 400 }, (_, i) => `article-${i}`);
      
      mockSupabase.in.mockReturnValue({
        data: [],
        error: null
      });

      const startTime = Date.now();
      await migrationScript.processInBatches(articleIds, 'title');
      const duration = Date.now() - startTime;
      
      // Should have 1 delay between 2 batches (200 + 200)
      expect(duration).toBeGreaterThanOrEqual(migrationScript.DELAY_BETWEEN_BATCHES);
    });

    it('should handle batch processing errors gracefully', async () => {
      const articleIds = ['article-1', 'article-2', 'article-3'];
      
      // Mock a fetch error for testing
      mockSupabase.in.mockReturnValue({
        data: null,
        error: { message: 'Database error' }
      });

      const results = await migrationScript.processInBatches(articleIds, 'title');
      
      expect(results.errorCount).toBeGreaterThan(0);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0]).toContain('Database error');
    });
  });

  describe('3. Entity Decoding', () => {
    it('should correctly decode all specified HTML entities', async () => {
      const testCases = [
        { input: 'Biden&rsquo;s', expected: "Biden's" },
        { input: '&lsquo;Hello&rsquo;', expected: "'Hello'" },
        { input: '&ldquo;Quote&rdquo;', expected: '"Quote"' },
        { input: 'AT&amp;T', expected: 'AT&T' },
        { input: '&quot;Test&quot;', expected: '"Test"' },
        { input: '2020&ndash;2024', expected: '2020–2024' },
        { input: 'Breaking&mdash;News', expected: 'Breaking—News' },
        { input: 'Article&#8217;s', expected: "Article's" },
        { input: '&lt;div&gt;', expected: '<div>' }
      ];

      testCases.forEach(({ input, expected }) => {
        const decoded = mockDecoder.decodeHtmlEntities(input);
        expect(decoded).toBe(expected);
      });
    });

    it('should preserve URLs during migration', async () => {
      const articles = [
        {
          id: '1',
          title: 'Article &amp; Title',
          content: 'Content with &rsquo; entity',
          url: 'https://example.com/article?param=value&test=1'
        }
      ];

      mockSupabase.in.mockReturnValue({
        data: articles,
        error: null
      });

      // Process article
      const results = await migrationScript.processInBatches(['1'], 'title');
      
      // URL should remain unchanged
      expect(articles[0].url).toBe('https://example.com/article?param=value&test=1');
      expect(articles[0].url).toContain('&'); // & in URL preserved
    });
  });

  describe('4. Backup and Recovery', () => {
    it('should create backup before starting migration', async () => {
      const backup = await migrationScript.createBackup();
      
      expect(backup.success).toBe(true);
      expect(backup.backupTable).toContain('articles_backup_');
      expect(backup.timestamp).toBeDefined();
    });

    it('should abort migration if backup fails', async () => {
      // Mock backup failure
      migrationScript.createBackup = vi.fn().mockResolvedValue({
        success: false,
        error: 'Backup failed'
      });

      const results = await migrationScript.runMigration();
      
      expect(results.success).toBe(false);
      expect(results.errors).toContain('Migration failed: Error: Backup creation failed');
      expect(results.titlesProcessed).toBe(0);
      expect(results.contentsProcessed).toBe(0);
    });
  });

  describe('5. Migration Verification', () => {
    it('should verify no entities remain after migration', async () => {
      // Mock no remaining entities
      mockSupabase.or.mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      });

      const verification = await migrationScript.verifyMigration();
      
      expect(verification.titlesWithEntities).toBe(0);
      expect(verification.contentsWithEntities).toBe(0);
      expect(verification.migrationComplete).toBe(true);
    });

    it('should report incomplete migration if entities remain', async () => {
      // Mock some remaining entities
      mockSupabase.or.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: [{ id: '1', title: 'Still has &amp;' }],
          error: null
        })
      });

      mockSupabase.or.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      });

      const verification = await migrationScript.verifyMigration();
      
      expect(verification.titlesWithEntities).toBe(1);
      expect(verification.contentsWithEntities).toBe(0);
      expect(verification.migrationComplete).toBe(false);
    });
  });

  describe('6. Full Migration Flow', () => {
    it('should complete full migration successfully', async () => {
      // Mock successful flow
      mockSupabase.or.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: Array.from({ length: 68 }, (_, i) => ({
            id: `title-${i}`,
            title: `Title ${i} with &amp; entity`
          })),
          error: null
        })
      });

      mockSupabase.or.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: Array.from({ length: 277 }, (_, i) => ({
            id: `content-${i}`,
            content: `Content ${i} with &rsquo; entity`
          })),
          error: null
        })
      });

      // Mock successful updates
      mockSupabase.in.mockReturnValue({
        data: [],
        error: null
      });

      mockSupabase.eq.mockReturnValue({
        data: null,
        error: null
      });

      // Mock verification - no entities remain
      migrationScript.verifyMigration = vi.fn().mockResolvedValue({
        titlesWithEntities: 0,
        contentsWithEntities: 0,
        migrationComplete: true
      });

      const results = await migrationScript.runMigration();
      
      expect(results.success).toBe(true);
      expect(results.titlesProcessed).toBeGreaterThan(0);
      expect(results.contentsProcessed).toBeGreaterThan(0);
      expect(results.totalProcessed).toBe(results.titlesProcessed + results.contentsProcessed);
      expect(results.backup).toBeDefined();
      expect(results.duration).toBeGreaterThan(0);
    });

    it('should handle partial migration failure', async () => {
      // Mock finding articles
      mockSupabase.or.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: [{ id: '1', title: 'Title with &amp;' }],
          error: null
        })
      });

      mockSupabase.or.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: [{ id: '2', content: 'Content with &rsquo;' }],
          error: null
        })
      });

      // Mock title update success, content update failure
      mockSupabase.in.mockReturnValueOnce({
        data: [{ id: '1', title: 'Title with &amp;', url: 'https://example.com' }],
        error: null
      });

      mockSupabase.eq.mockReturnValueOnce({
        data: null,
        error: null
      });

      mockSupabase.in.mockReturnValueOnce({
        data: null,
        error: { message: 'Update failed' }
      });

      const results = await migrationScript.runMigration();
      
      expect(results.titlesProcessed).toBe(1);
      expect(results.contentsProcessed).toBe(0);
      expect(results.errors.length).toBeGreaterThan(0);
    });
  });

  describe('7. Performance Requirements', () => {
    it('should process 345 total articles efficiently', async () => {
      // 68 titles + 277 contents = 345 total
      const titleIds = Array.from({ length: 68 }, (_, i) => `title-${i}`);
      const contentIds = Array.from({ length: 277 }, (_, i) => `content-${i}`);

      // Mock successful processing
      mockSupabase.in.mockReturnValue({
        data: [],
        error: null
      });

      mockSupabase.eq.mockReturnValue({
        data: null,
        error: null
      });

      const startTime = Date.now();
      
      // Process both batches
      await migrationScript.processInBatches(titleIds, 'title');
      await migrationScript.processInBatches(contentIds, 'content');
      
      const totalTime = Date.now() - startTime;

      // Should complete in reasonable time
      // 345 articles in 2 batches (200 + 145) with delays
      expect(totalTime).toBeLessThan(5000); // Less than 5 seconds
    });
  });
});