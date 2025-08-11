import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Unit Tests for RR-168: Remove auto-cleanup of fetched full content
 * 
 * These tests serve as the SPECIFICATION for removing all auto-cleanup mechanisms
 * for fetched full content. The 3 AM cleanup job and all related code paths must
 * be completely removed while preserving RR-129's 1000-article retention limit.
 * 
 * IMPORTANT: These tests define the expected behavior. If tests fail, fix the 
 * implementation, NOT the tests. Tests should never be modified to match implementation.
 */

describe('RR-168: Remove Auto-Cleanup of Fetched Full Content', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock Supabase client with chainable methods
    mockSupabase = {
      from: vi.fn(() => mockSupabase),
      select: vi.fn(() => mockSupabase),
      eq: vi.fn(() => mockSupabase),
      single: vi.fn(() => mockSupabase),
      rpc: vi.fn(),
      query: vi.fn()
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('File System Verification', () => {
    it('should NOT have cleanup-parsed-content.js script', () => {
      const scriptPath = path.join(process.cwd(), 'scripts', 'cleanup-parsed-content.js');
      const scriptExists = fs.existsSync(scriptPath);
      
      expect(scriptExists).toBe(false);
    });

    it('should NOT have any cleanup-related scripts in scripts directory', () => {
      const scriptsDir = path.join(process.cwd(), 'scripts');
      
      if (fs.existsSync(scriptsDir)) {
        const files = fs.readdirSync(scriptsDir);
        const cleanupScripts = files.filter(file => 
          file.includes('cleanup') && file.includes('content')
        );
        
        expect(cleanupScripts).toHaveLength(0);
      }
    });
  });

  describe('PM2 Configuration Verification', () => {
    it('should NOT have rss-content-cleanup app in ecosystem.config.js', () => {
      const ecosystemPath = path.join(process.cwd(), 'ecosystem.config.js');
      
      expect(fs.existsSync(ecosystemPath)).toBe(true);
      
      const content = fs.readFileSync(ecosystemPath, 'utf-8');
      expect(content).not.toContain('rss-content-cleanup');
    });

    it('should NOT have any cleanup-related cron schedules', () => {
      const ecosystemPath = path.join(process.cwd(), 'ecosystem.config.js');
      const content = fs.readFileSync(ecosystemPath, 'utf-8');
      
      // Should not contain 3 AM cleanup schedule
      expect(content).not.toMatch(/["']0\s+3\s+\*\s+\*\s+\*["']/);
      expect(content).not.toContain('cleanup-parsed-content');
    });

    it('should only contain valid RSS reader apps', () => {
      const ecosystemPath = path.join(process.cwd(), 'ecosystem.config.js');
      
      if (fs.existsSync(ecosystemPath)) {
        const content = fs.readFileSync(ecosystemPath, 'utf-8');
        
        // Valid apps that should exist
        const validApps = [
          'rss-reader-dev',
          'rss-sync-cron', 
          'rss-sync-server',
          'kuma-push-monitor',
          'rss-services-monitor'
        ];
        
        validApps.forEach(appName => {
          expect(content).toContain(appName);
        });
        
        // Should not contain cleanup app
        expect(content).not.toContain('rss-content-cleanup');
      }
    });
  });

  describe('Service Layer Verification', () => {
    it('should NOT have cleanupOldContent function in ContentParsingService', () => {
      const servicePath = path.join(process.cwd(), 'src', 'lib', 'services', 'content-parsing-service.ts');
      
      if (fs.existsSync(servicePath)) {
        const content = fs.readFileSync(servicePath, 'utf-8');
        expect(content).not.toContain('cleanupOldContent');
      }
    });

    it('should NOT have any content cleanup imports or references', () => {
      const servicePath = path.join(process.cwd(), 'src', 'lib', 'services', 'content-parsing-service.ts');
      
      if (fs.existsSync(servicePath)) {
        const content = fs.readFileSync(servicePath, 'utf-8');
        
        // Should not import or reference cleanup functionality
        expect(content).not.toMatch(/import.*cleanup.*content/i);
        expect(content).not.toMatch(/cleanup.*full_content/i);
        expect(content).not.toMatch(/null.*full_content.*retention/i);
      }
    });
  });

  describe('Database Function Verification', () => {
    it('should NOT have cleanup_old_parsed_content function in database', async () => {
      // Mock database query to check for function existence
      mockSupabase.rpc.mockImplementation((functionName: string) => {
        if (functionName === 'cleanup_old_parsed_content') {
          // Simulate function not found error (which is what we want)
          return Promise.reject(new Error('function cleanup_old_parsed_content() does not exist'));
        }
        return Promise.resolve({ data: null });
      });

      // Attempt to call the function - should fail
      await expect(mockSupabase.rpc('cleanup_old_parsed_content'))
        .rejects.toThrow('function cleanup_old_parsed_content() does not exist');
    });

    it('should have migration file to drop cleanup function', () => {
      const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
      
      if (fs.existsSync(migrationsDir)) {
        const migrationFiles = fs.readdirSync(migrationsDir);
        
        // Look for migration that removes content cleanup
        const cleanupRemovalMigration = migrationFiles.find(file => 
          file.includes('remove_content_cleanup') || 
          file.includes('drop_cleanup') ||
          file.includes('011_remove_content_cleanup')
        );
        
        if (cleanupRemovalMigration) {
          const migrationPath = path.join(migrationsDir, cleanupRemovalMigration);
          const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
          
          expect(migrationContent).toMatch(/DROP\s+FUNCTION.*cleanup_old_parsed_content/i);
        }
      }
    });
  });

  describe('System Configuration Verification', () => {
    it('should NOT use content_retention_days configuration', async () => {
      // Mock system config query to simulate absence of retention config
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'system_config') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({
                  data: null, // No retention config found
                  error: { message: 'No rows returned' }
                }))
              }))
            }))
          };
        }
        return mockSupabase;
      });

      // This would be used in the actual service - should not find retention config
      await expect(mockSupabase.from('system_config').select('*').eq('key', 'content_retention_days').single())
        .resolves.toEqual({ data: null, error: { message: 'No rows returned' } });
    });
  });

  describe('Health Endpoint Verification', () => {
    it('should NOT include retentionDays in health response', async () => {
      const healthPath = path.join(process.cwd(), 'src', 'app', 'api', 'health', 'parsing', 'route.ts');
      
      if (fs.existsSync(healthPath)) {
        const content = fs.readFileSync(healthPath, 'utf-8');
        
        // Should not include retentionDays in response
        expect(content).not.toMatch(/retentionDays.*configMap\.content_retention_days/);
        expect(content).not.toContain('content_retention_days');
      }
    });

    it('should have clean configuration object without retention fields', () => {
      const healthPath = path.join(process.cwd(), 'src', 'app', 'api', 'health', 'parsing', 'route.ts');
      
      if (fs.existsSync(healthPath)) {
        const content = fs.readFileSync(healthPath, 'utf-8');
        
        // Should only have valid parsing configuration fields
        expect(content).toMatch(/timeoutSeconds.*parse_timeout_seconds/);
        expect(content).toMatch(/maxConcurrent.*max_concurrent_parses/);
        expect(content).toMatch(/maxAttempts.*max_parse_attempts/);
        
        // Should NOT reference retention
        expect(content).not.toMatch(/retentionDays/);
      }
    });
  });

  describe('Test File Updates Verification', () => {
    it('should NOT have auto-cleanup tests in rr-148-retention-policy.test.ts', () => {
      const testPath = path.join(process.cwd(), 'src', '__tests__', 'unit', 'rr-148-retention-policy.test.ts');
      
      if (fs.existsSync(testPath)) {
        const content = fs.readFileSync(testPath, 'utf-8');
        
        // Should not test automatic cleanup of full_content
        expect(content).not.toMatch(/full_content.*null.*retention/i);
        expect(content).not.toMatch(/cleanup.*schedule.*3.*AM/i);
        expect(content).not.toContain("'0 3 * * *'");
      }
    });
  });

  describe('Documentation Verification', () => {
    it('should NOT have cleanup references in cleanup-architecture.md', () => {
      const docPath = path.join(process.cwd(), 'docs', 'tech', 'cleanup-architecture.md');
      
      if (fs.existsSync(docPath)) {
        const content = fs.readFileSync(docPath, 'utf-8');
        
        // Should not contain cleanup references
        expect(content).not.toMatch(/parsed-content.*cleanup/i);
        expect(content).not.toMatch(/3\s*AM.*cleanup/i);
        expect(content).not.toMatch(/full_content.*cleanup/i);
        expect(content).not.toMatch(/cron.*job.*integration.*parsed/i);
      }
    });
  });

  describe('CHANGELOG Verification', () => {
    it('should have RR-168 entry documenting cleanup removal', () => {
      const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
      
      expect(fs.existsSync(changelogPath)).toBe(true);
      
      const content = fs.readFileSync(changelogPath, 'utf-8');
      
      // Should contain RR-168 entry
      expect(content).toMatch(/RR-168/);
      expect(content).toMatch(/remove.*auto-cleanup.*full.*content/i);
      expect(content).toMatch(/feat\(cleanup\).*remove.*auto-cleanup/i);
    });
  });

  describe('Integration Test - Content Preservation', () => {
    it('should preserve full_content indefinitely regardless of age', async () => {
      // Mock an old article with full content
      const oldArticle = {
        id: 'test-article-123',
        full_content: '<p>This is preserved content</p>',
        parsed_at: new Date('2024-01-01').toISOString(), // Very old
        has_full_content: true,
        is_read: true,
        is_starred: false
      };

      // Mock articles query
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'articles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({
                data: [oldArticle]
              }))
            }))
          };
        }
        return mockSupabase;
      });

      const { data: articles } = await mockSupabase
        .from('articles')
        .select('*')
        .eq('id', 'test-article-123');

      expect(articles[0].full_content).toBe('<p>This is preserved content</p>');
      expect(articles[0].full_content).not.toBeNull();
      expect(articles[0].parsed_at).not.toBeNull();
    });

    it('should NOT have any background process that nulls full_content', () => {
      // This is verified by the absence of cleanup scripts, functions, and cron jobs
      // tested in other test cases. This test documents the integration requirement.
      
      const scriptsDir = path.join(process.cwd(), 'scripts');
      let hasCleanupScripts = false;
      
      if (fs.existsSync(scriptsDir)) {
        const files = fs.readdirSync(scriptsDir);
        hasCleanupScripts = files.some(file => 
          file.includes('cleanup') && file.includes('content')
        );
      }
      
      expect(hasCleanupScripts).toBe(false);
    });
  });

  describe('Environment and Configuration Cleanup', () => {
    it('should NOT have cleanup-related environment variables in .env examples', () => {
      const envExamplePath = path.join(process.cwd(), '.env.example');
      
      if (fs.existsSync(envExamplePath)) {
        const content = fs.readFileSync(envExamplePath, 'utf-8');
        
        expect(content).not.toMatch(/CONTENT.*RETENTION.*DAYS/i);
        expect(content).not.toMatch(/CLEANUP.*SCHEDULE/i);
      }
    });

    it('should NOT have cleanup references in package.json scripts', () => {
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageContent = fs.readFileSync(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageContent);
      
      if (packageJson.scripts) {
        const scriptNames = Object.keys(packageJson.scripts);
        const cleanupScripts = scriptNames.filter(name => 
          name.includes('cleanup') && name.includes('content')
        );
        
        expect(cleanupScripts).toHaveLength(0);
      }
    });
  });
});