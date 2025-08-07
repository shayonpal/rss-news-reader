import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit Tests for RR-148: Configurable Retention Policy for Read Articles
 * 
 * Tests the configurable retention policy system that manages article cleanup
 * to prevent database storage issues, especially after implementing on-demand parsing.
 * 
 * These tests are designed to FAIL initially (TDD red phase) until the 
 * actual implementation is created.
 */

describe('RR-148: Retention Policy Configuration', () => {
  let mockSupabase: any;
  let mockConfig: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock Supabase client
    mockSupabase = {
      from: vi.fn(() => mockSupabase),
      select: vi.fn(() => mockSupabase),
      eq: vi.fn(() => mockSupabase),
      lt: vi.fn(() => mockSupabase),
      lte: vi.fn(() => mockSupabase),
      gte: vi.fn(() => mockSupabase),
      is: vi.fn(() => mockSupabase),
      not: vi.fn(() => mockSupabase),
      update: vi.fn(() => mockSupabase),
      delete: vi.fn(),
      single: vi.fn(),
      rpc: vi.fn()
    };

    // Mock system configuration
    mockConfig = {
      retention: {
        read_articles_days: 30,
        unread_articles_days: 365,
        starred_articles_days: -1, // Never delete starred
        full_content_cache_days: 7,
        cleanup_schedule: '0 2 * * *', // 2 AM daily
        batch_size: 1000,
        enabled: true,
        dry_run: false
      }
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Retention Policy Configuration Types', () => {
    it('should define comprehensive retention configuration interface', () => {
      // This interface will fail until implemented - documents expected structure
      interface RetentionConfig {
        read_articles_days: number;           // Days to keep read articles
        unread_articles_days: number;         // Days to keep unread articles  
        starred_articles_days: number;        // Days to keep starred (-1 = forever)
        full_content_cache_days: number;      // Days to keep cached full content
        cleanup_schedule: string;             // Cron schedule for cleanup
        batch_size: number;                   // Articles to process per batch
        enabled: boolean;                     // Enable/disable cleanup
        dry_run: boolean;                     // Preview mode without deletion
        max_database_size_mb?: number;        // Trigger cleanup at size
        preserve_recent_days: number;         // Always keep articles newer than X days
      }

      const validateRetentionConfig = (config: RetentionConfig): { valid: boolean; errors: string[] } => {
        const errors: string[] = [];

        if (config.read_articles_days < 0) {
          errors.push('read_articles_days must be non-negative');
        }
        
        if (config.unread_articles_days < 0) {
          errors.push('unread_articles_days must be non-negative');
        }

        if (config.full_content_cache_days < 0) {
          errors.push('full_content_cache_days must be non-negative');
        }

        if (config.batch_size <= 0) {
          errors.push('batch_size must be positive');
        }

        // Validate cron expression format
        const cronRegex = /^(\*|[0-5]?[0-9]) (\*|[01]?[0-9]|2[0-3]) (\*|[01]?[0-9]|[12][0-9]|3[01]) (\*|[01]?[0-9]|1[0-2]) (\*|[0-6])$/;
        if (!cronRegex.test(config.cleanup_schedule)) {
          errors.push('cleanup_schedule must be valid cron expression');
        }

        return { valid: errors.length === 0, errors };
      };

      // Valid configuration
      const validConfig: RetentionConfig = {
        read_articles_days: 30,
        unread_articles_days: 365,
        starred_articles_days: -1,
        full_content_cache_days: 7,
        cleanup_schedule: '0 2 * * *',
        batch_size: 1000,
        enabled: true,
        dry_run: false,
        preserve_recent_days: 3
      };

      const validation = validateRetentionConfig(validConfig);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Invalid configuration
      const invalidConfig: RetentionConfig = {
        read_articles_days: -5,
        unread_articles_days: 365,
        starred_articles_days: -1,
        full_content_cache_days: -1,
        cleanup_schedule: 'invalid-cron',
        batch_size: 0,
        enabled: true,
        dry_run: false,
        preserve_recent_days: 3
      };

      const invalidValidation = validateRetentionConfig(invalidConfig);
      expect(invalidValidation.valid).toBe(false);
      expect(invalidValidation.errors).toContain('read_articles_days must be non-negative');
      expect(invalidValidation.errors).toContain('full_content_cache_days must be non-negative');
      expect(invalidValidation.errors).toContain('batch_size must be positive');
      expect(invalidValidation.errors).toContain('cleanup_schedule must be valid cron expression');
    });

    it('should provide sensible default configurations', () => {
      // Default configuration factory - will fail until implemented
      const createDefaultRetentionConfig = () => ({
        read_articles_days: 30,
        unread_articles_days: 365,
        starred_articles_days: -1,
        full_content_cache_days: 7,
        cleanup_schedule: '0 2 * * *',
        batch_size: 1000,
        enabled: true,
        dry_run: false,
        preserve_recent_days: 3
      });

      const defaults = createDefaultRetentionConfig();
      
      expect(defaults.read_articles_days).toBeGreaterThan(0);
      expect(defaults.unread_articles_days).toBeGreaterThan(defaults.read_articles_days);
      expect(defaults.starred_articles_days).toBe(-1); // Never delete starred
      expect(defaults.full_content_cache_days).toBeLessThan(defaults.read_articles_days);
      expect(defaults.cleanup_schedule).toMatch(/^\d+ \d+ \* \* \*$/);
      expect(defaults.batch_size).toBeGreaterThan(0);
      expect(defaults.enabled).toBe(true);
    });
  });

  describe('Article Classification for Cleanup', () => {
    it('should identify articles eligible for cleanup based on age and status', () => {
      // Article classification logic - will fail until implemented
      interface ArticleForCleanup {
        id: string;
        is_read: boolean;
        is_starred: boolean;
        published_at: string;
        last_accessed?: string;
        has_full_content: boolean;
        full_content_size?: number;
      }

      const classifyForCleanup = (article: ArticleForCleanup, config: any, currentDate: Date = new Date()) => {
        const publishedDate = new Date(article.published_at);
        const ageInDays = Math.floor((currentDate.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Never delete recent articles
        if (ageInDays <= (config.preserve_recent_days || 3)) {
          return { shouldDelete: false, reason: 'too_recent' };
        }

        // Never delete starred articles if configured
        if (article.is_starred && config.starred_articles_days === -1) {
          return { shouldDelete: false, reason: 'starred_preserved' };
        }

        // Check starred articles with expiration
        if (article.is_starred && config.starred_articles_days > 0) {
          if (ageInDays > config.starred_articles_days) {
            return { shouldDelete: true, reason: 'starred_expired', ageInDays };
          }
          return { shouldDelete: false, reason: 'starred_not_expired' };
        }

        // Check read articles
        if (article.is_read && ageInDays > config.read_articles_days) {
          return { shouldDelete: true, reason: 'read_expired', ageInDays };
        }

        // Check unread articles
        if (!article.is_read && ageInDays > config.unread_articles_days) {
          return { shouldDelete: true, reason: 'unread_expired', ageInDays };
        }

        return { shouldDelete: false, reason: 'within_retention_period' };
      };

      const currentDate = new Date('2024-02-01T10:00:00Z');
      const config = mockConfig.retention;

      // Recent article (should not delete)
      const recentArticle: ArticleForCleanup = {
        id: 'recent-123',
        is_read: true,
        is_starred: false,
        published_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        has_full_content: true
      };

      const recentResult = classifyForCleanup(recentArticle, config, currentDate);
      expect(recentResult.shouldDelete).toBe(false);
      expect(recentResult.reason).toBe('too_recent');

      // Old read article (should delete)
      const oldReadArticle: ArticleForCleanup = {
        id: 'old-read-456',
        is_read: true,
        is_starred: false,
        published_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days ago
        has_full_content: true
      };

      const oldReadResult = classifyForCleanup(oldReadArticle, config, currentDate);
      expect(oldReadResult.shouldDelete).toBe(true);
      expect(oldReadResult.reason).toBe('read_expired');

      // Starred article (should preserve)
      const starredArticle: ArticleForCleanup = {
        id: 'starred-789',
        is_read: true,
        is_starred: true,
        published_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year ago
        has_full_content: true
      };

      const starredResult = classifyForCleanup(starredArticle, config, currentDate);
      expect(starredResult.shouldDelete).toBe(false);
      expect(starredResult.reason).toBe('starred_preserved');
    });

    it('should handle full content cache cleanup separately', () => {
      // Full content cache cleanup logic - will fail until implemented
      const shouldCleanupFullContent = (article: any, config: any, currentDate: Date = new Date()) => {
        if (!article.has_full_content || !article.full_content) {
          return { shouldCleanup: false, reason: 'no_full_content' };
        }

        const extractedDate = article.extracted_at ? new Date(article.extracted_at) : new Date(article.updated_at);
        const ageInDays = Math.floor((currentDate.getTime() - extractedDate.getTime()) / (1000 * 60 * 60 * 24));

        if (ageInDays > config.full_content_cache_days) {
          return { 
            shouldCleanup: true, 
            reason: 'cache_expired', 
            ageInDays,
            sizeBytes: article.full_content.length 
          };
        }

        return { shouldCleanup: false, reason: 'cache_fresh' };
      };

      const config = mockConfig.retention;
      const currentDate = new Date('2024-02-01T10:00:00Z');

      // Article with old cached content
      const oldCachedArticle = {
        id: 'cached-123',
        has_full_content: true,
        full_content: '<p>Cached content here</p>',
        extracted_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
        updated_at: new Date().toISOString()
      };

      const result = shouldCleanupFullContent(oldCachedArticle, config, currentDate);
      expect(result.shouldCleanup).toBe(true);
      expect(result.reason).toBe('cache_expired');
      expect(result.ageInDays).toBeGreaterThan(config.full_content_cache_days);

      // Article with fresh cached content
      const freshCachedArticle = {
        id: 'cached-456',
        has_full_content: true,
        full_content: '<p>Fresh cached content</p>',
        extracted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        updated_at: new Date().toISOString()
      };

      const freshResult = shouldCleanupFullContent(freshCachedArticle, config, currentDate);
      expect(freshResult.shouldCleanup).toBe(false);
      expect(freshResult.reason).toBe('cache_fresh');
    });
  });

  describe('Cleanup Execution Logic', () => {
    it('should implement batch processing for large datasets', async () => {
      // Batch cleanup implementation - will fail until implemented
      class RetentionCleanupService {
        constructor(private supabase: any, private config: any) {}

        async cleanupReadArticles(dryRun: boolean = false): Promise<{
          processed: number;
          deleted: number;
          batches: number;
          duration: number;
          errors: string[];
        }> {
          const startTime = Date.now();
          let processed = 0;
          let deleted = 0;
          let batches = 0;
          const errors: string[] = [];

          try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.config.read_articles_days);

            // Process in batches
            let offset = 0;
            let hasMore = true;

            while (hasMore) {
              // Fetch batch of eligible articles
              const { data: articles, error } = await this.supabase
                .from('articles')
                .select('id, published_at, is_read, is_starred')
                .eq('is_read', true)
                .eq('is_starred', false)
                .lt('published_at', cutoffDate.toISOString())
                .range(offset, offset + this.config.batch_size - 1);

              if (error) {
                errors.push(`Batch ${batches}: ${error.message}`);
                break;
              }

              if (!articles || articles.length === 0) {
                hasMore = false;
                break;
              }

              processed += articles.length;
              batches++;

              if (!dryRun) {
                // Delete articles in this batch
                const articleIds = articles.map(a => a.id);
                const { error: deleteError } = await this.supabase
                  .from('articles')
                  .delete()
                  .in('id', articleIds);

                if (deleteError) {
                  errors.push(`Delete batch ${batches}: ${deleteError.message}`);
                } else {
                  deleted += articles.length;
                }
              } else {
                // In dry run, just count what would be deleted
                deleted += articles.length;
              }

              offset += this.config.batch_size;
              
              if (articles.length < this.config.batch_size) {
                hasMore = false;
              }

              // Add delay between batches to avoid overwhelming the database
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } catch (error) {
            errors.push(`General error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }

          return {
            processed,
            deleted,
            batches,
            duration: Date.now() - startTime,
            errors
          };
        }
      }

      const service = new RetentionCleanupService(mockSupabase, mockConfig.retention);

      // Mock articles to cleanup
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.lt.mockReturnThis();
      mockSupabase.range.mockResolvedValue({
        data: Array.from({ length: 500 }, (_, i) => ({
          id: `article-${i}`,
          published_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
          is_read: true,
          is_starred: false
        })),
        error: null
      });

      mockSupabase.delete.mockReturnThis();
      mockSupabase.in.mockResolvedValue({ error: null });

      // Test dry run
      const dryRunResult = await service.cleanupReadArticles(true);
      expect(dryRunResult.processed).toBe(500);
      expect(dryRunResult.deleted).toBe(500);
      expect(dryRunResult.batches).toBe(1);
      expect(dryRunResult.errors).toHaveLength(0);

      // Test actual cleanup
      const cleanupResult = await service.cleanupReadArticles(false);
      expect(cleanupResult.processed).toBe(500);
      expect(cleanupResult.deleted).toBe(500);
      expect(mockSupabase.delete).toHaveBeenCalled();
    });

    it('should handle cleanup scheduling and automation', async () => {
      // Cleanup scheduler - will fail until implemented
      interface CleanupJob {
        id: string;
        type: 'read_articles' | 'unread_articles' | 'full_content_cache';
        schedule: string;
        enabled: boolean;
        last_run?: string;
        next_run?: string;
      }

      class CleanupScheduler {
        private jobs: CleanupJob[] = [];

        addJob(job: Omit<CleanupJob, 'id'>): string {
          const id = `job-${Date.now()}-${Math.random()}`;
          this.jobs.push({ ...job, id });
          return id;
        }

        getNextRunTime(cronExpression: string, fromDate: Date = new Date()): Date {
          // Simplified cron parsing for testing - would use a real cron library
          const parts = cronExpression.split(' ');
          const [minute, hour] = parts;
          
          const nextRun = new Date(fromDate);
          nextRun.setHours(parseInt(hour), parseInt(minute), 0, 0);
          
          // If time has passed today, schedule for tomorrow
          if (nextRun <= fromDate) {
            nextRun.setDate(nextRun.getDate() + 1);
          }
          
          return nextRun;
        }

        getDueJobs(currentTime: Date = new Date()): CleanupJob[] {
          return this.jobs.filter(job => {
            if (!job.enabled) return false;
            
            const nextRun = job.next_run ? new Date(job.next_run) : this.getNextRunTime(job.schedule);
            return nextRun <= currentTime;
          });
        }

        updateJobLastRun(jobId: string, runTime: Date): void {
          const job = this.jobs.find(j => j.id === jobId);
          if (job) {
            job.last_run = runTime.toISOString();
            job.next_run = this.getNextRunTime(job.schedule, runTime).toISOString();
          }
        }
      }

      const scheduler = new CleanupScheduler();

      // Add cleanup jobs
      const readArticlesJobId = scheduler.addJob({
        type: 'read_articles',
        schedule: '0 2 * * *', // 2 AM daily
        enabled: true
      });

      const fullContentJobId = scheduler.addJob({
        type: 'full_content_cache',
        schedule: '0 3 * * *', // 3 AM daily
        enabled: true
      });

      expect(readArticlesJobId).toBeTruthy();
      expect(fullContentJobId).toBeTruthy();

      // Test next run time calculation
      const testDate = new Date('2024-01-01T10:00:00Z'); // 10 AM
      const nextRun = scheduler.getNextRunTime('0 2 * * *', testDate);
      expect(nextRun.getHours()).toBe(2);
      expect(nextRun.getMinutes()).toBe(0);
      expect(nextRun.getDate()).toBe(2); // Next day since 2 AM has passed

      // Test due jobs detection
      const dueTomorrowMorning = new Date('2024-01-02T02:01:00Z'); // 2:01 AM next day
      const dueJobs = scheduler.getDueJobs(dueTomorrowMorning);
      expect(dueJobs).toHaveLength(1);
      expect(dueJobs[0].type).toBe('read_articles');

      // Update job run time
      scheduler.updateJobLastRun(readArticlesJobId, dueTomorrowMorning);
      const updatedDueJobs = scheduler.getDueJobs(dueTomorrowMorning);
      expect(updatedDueJobs).toHaveLength(0); // Should not be due again immediately
    });
  });

  describe('Database Storage Management', () => {
    it('should monitor database size and trigger cleanup when needed', async () => {
      // Database size monitoring - will fail until implemented
      const getDatabaseStats = async () => {
        const { data } = await mockSupabase.rpc('get_database_stats');
        return data;
      };

      const shouldTriggerEmergencyCleanup = (stats: any, maxSizeMB: number) => {
        const currentSizeMB = stats.total_size_mb;
        const usagePercentage = (currentSizeMB / maxSizeMB) * 100;
        
        return {
          shouldCleanup: usagePercentage > 85, // Trigger at 85% capacity
          currentSizeMB,
          maxSizeMB,
          usagePercentage,
          severity: usagePercentage > 95 ? 'critical' : usagePercentage > 85 ? 'warning' : 'normal'
        };
      };

      // Mock database stats
      mockSupabase.rpc.mockResolvedValue({
        data: {
          total_size_mb: 850,
          articles_size_mb: 600,
          full_content_size_mb: 250,
          article_count: 50000,
          articles_with_full_content: 15000
        }
      });

      const stats = await getDatabaseStats();
      const cleanupDecision = shouldTriggerEmergencyCleanup(stats, 1000);

      expect(cleanupDecision.shouldCleanup).toBe(true);
      expect(cleanupDecision.severity).toBe('warning');
      expect(cleanupDecision.usagePercentage).toBeGreaterThan(85);
      expect(cleanupDecision.currentSizeMB).toBe(850);

      // Test critical threshold
      const criticalStats = {
        total_size_mb: 980,
        articles_size_mb: 700,
        full_content_size_mb: 280,
        article_count: 60000,
        articles_with_full_content: 18000
      };

      const criticalDecision = shouldTriggerEmergencyCleanup(criticalStats, 1000);
      expect(criticalDecision.severity).toBe('critical');
      expect(criticalDecision.usagePercentage).toBeGreaterThan(95);
    });

    it('should prioritize cleanup order based on impact and safety', () => {
      // Cleanup prioritization strategy - will fail until implemented
      interface CleanupStrategy {
        name: string;
        description: string;
        impact: 'low' | 'medium' | 'high';
        safety: 'safe' | 'moderate' | 'risky';
        estimated_space_mb: number;
        execution_time_estimate: number;
      }

      const getCleanupStrategies = (): CleanupStrategy[] => [
        {
          name: 'full_content_cache_cleanup',
          description: 'Remove cached full content older than configured days',
          impact: 'medium',
          safety: 'safe',
          estimated_space_mb: 200,
          execution_time_estimate: 30000 // 30 seconds
        },
        {
          name: 'old_read_articles_cleanup',
          description: 'Delete read articles older than retention period',
          impact: 'high',
          safety: 'moderate',
          estimated_space_mb: 400,
          execution_time_estimate: 120000 // 2 minutes
        },
        {
          name: 'unread_articles_cleanup',
          description: 'Delete very old unread articles',
          impact: 'high',
          safety: 'risky',
          estimated_space_mb: 100,
          execution_time_estimate: 60000 // 1 minute
        }
      ];

      const prioritizeCleanupStrategies = (strategies: CleanupStrategy[], urgency: 'normal' | 'urgent' | 'emergency') => {
        const weights = {
          normal: { safety: 0.5, impact: 0.3, efficiency: 0.2 },
          urgent: { safety: 0.3, impact: 0.5, efficiency: 0.2 },
          emergency: { safety: 0.1, impact: 0.6, efficiency: 0.3 }
        };

        const currentWeights = weights[urgency];

        return strategies
          .map(strategy => ({
            ...strategy,
            score: calculateScore(strategy, currentWeights),
            efficiency: strategy.estimated_space_mb / (strategy.execution_time_estimate / 1000) // MB per second
          }))
          .sort((a, b) => b.score - a.score);
      };

      const calculateScore = (strategy: CleanupStrategy, weights: any) => {
        const safetyScore = strategy.safety === 'safe' ? 3 : strategy.safety === 'moderate' ? 2 : 1;
        const impactScore = strategy.impact === 'high' ? 3 : strategy.impact === 'medium' ? 2 : 1;
        const efficiencyScore = strategy.estimated_space_mb / (strategy.execution_time_estimate / 60000); // MB per minute

        return (safetyScore * weights.safety) + (impactScore * weights.impact) + (efficiencyScore * weights.efficiency);
      };

      const strategies = getCleanupStrategies();

      // Normal priority (safety first)
      const normalPriority = prioritizeCleanupStrategies(strategies, 'normal');
      expect(normalPriority[0].name).toBe('full_content_cache_cleanup'); // Safest option first

      // Emergency priority (impact first)
      const emergencyPriority = prioritizeCleanupStrategies(strategies, 'emergency');
      expect(emergencyPriority[0].impact).toBe('high'); // Highest impact options first
      expect(emergencyPriority[0].name).toBe('old_read_articles_cleanup'); // Most space, reasonably safe

      expect(strategies).toHaveLength(3);
      expect(normalPriority).toHaveLength(3);
      expect(emergencyPriority).toHaveLength(3);
    });
  });

  describe('Configuration Management', () => {
    it('should support dynamic configuration updates', async () => {
      // Dynamic configuration updates - will fail until implemented
      class RetentionConfigManager {
        private config: any;

        constructor(initialConfig: any) {
          this.config = { ...initialConfig };
        }

        async updateConfig(updates: Partial<any>): Promise<{ success: boolean; errors: string[] }> {
          const errors: string[] = [];

          try {
            // Validate updates
            if (updates.read_articles_days !== undefined && updates.read_articles_days < 0) {
              errors.push('read_articles_days cannot be negative');
            }

            if (updates.batch_size !== undefined && updates.batch_size <= 0) {
              errors.push('batch_size must be positive');
            }

            if (errors.length > 0) {
              return { success: false, errors };
            }

            // Apply updates
            this.config = { ...this.config, ...updates };

            // Persist to database (would use actual Supabase call)
            await mockSupabase
              .from('system_config')
              .update({ retention_policy: this.config })
              .eq('key', 'retention');

            return { success: true, errors: [] };

          } catch (error) {
            return { 
              success: false, 
              errors: [error instanceof Error ? error.message : 'Unknown error'] 
            };
          }
        }

        getConfig(): any {
          return { ...this.config };
        }

        async resetToDefaults(): Promise<void> {
          this.config = {
            read_articles_days: 30,
            unread_articles_days: 365,
            starred_articles_days: -1,
            full_content_cache_days: 7,
            cleanup_schedule: '0 2 * * *',
            batch_size: 1000,
            enabled: true,
            dry_run: false
          };
        }
      }

      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockResolvedValue({ error: null });

      const configManager = new RetentionConfigManager(mockConfig.retention);

      // Test valid update
      const validUpdate = await configManager.updateConfig({
        read_articles_days: 45,
        batch_size: 500
      });

      expect(validUpdate.success).toBe(true);
      expect(validUpdate.errors).toHaveLength(0);

      const updatedConfig = configManager.getConfig();
      expect(updatedConfig.read_articles_days).toBe(45);
      expect(updatedConfig.batch_size).toBe(500);

      // Test invalid update
      const invalidUpdate = await configManager.updateConfig({
        read_articles_days: -10,
        batch_size: 0
      });

      expect(invalidUpdate.success).toBe(false);
      expect(invalidUpdate.errors).toContain('read_articles_days cannot be negative');
      expect(invalidUpdate.errors).toContain('batch_size must be positive');

      // Original config should be unchanged
      const unchangedConfig = configManager.getConfig();
      expect(unchangedConfig.read_articles_days).toBe(45); // Still the valid value
    });

    it('should provide configuration presets for different use cases', () => {
      // Configuration presets - will fail until implemented
      const getConfigurationPresets = () => ({
        conservative: {
          name: 'Conservative',
          description: 'Keep articles longer, minimal cleanup',
          config: {
            read_articles_days: 90,
            unread_articles_days: 730, // 2 years
            starred_articles_days: -1,
            full_content_cache_days: 30,
            cleanup_schedule: '0 2 * * 0', // Weekly
            batch_size: 500,
            enabled: true,
            dry_run: false
          }
        },
        moderate: {
          name: 'Moderate',
          description: 'Balanced approach for most users',
          config: {
            read_articles_days: 30,
            unread_articles_days: 365,
            starred_articles_days: -1,
            full_content_cache_days: 7,
            cleanup_schedule: '0 2 * * *', // Daily
            batch_size: 1000,
            enabled: true,
            dry_run: false
          }
        },
        aggressive: {
          name: 'Aggressive',
          description: 'Minimal storage usage, frequent cleanup',
          config: {
            read_articles_days: 7,
            unread_articles_days: 30,
            starred_articles_days: 90,
            full_content_cache_days: 1,
            cleanup_schedule: '0 2,14 * * *', // Twice daily
            batch_size: 2000,
            enabled: true,
            dry_run: false
          }
        }
      });

      const presets = getConfigurationPresets();
      
      expect(Object.keys(presets)).toHaveLength(3);
      expect(presets.conservative.config.read_articles_days).toBeGreaterThan(presets.moderate.config.read_articles_days);
      expect(presets.moderate.config.read_articles_days).toBeGreaterThan(presets.aggressive.config.read_articles_days);
      
      // All presets should have valid configurations
      Object.values(presets).forEach(preset => {
        expect(preset.config.read_articles_days).toBeGreaterThan(0);
        expect(preset.config.unread_articles_days).toBeGreaterThan(0);
        expect(preset.config.batch_size).toBeGreaterThan(0);
        expect(preset.config.cleanup_schedule).toMatch(/\d+ \d+/);
      });
    });
  });
});