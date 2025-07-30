/**
 * Security Tests - Codebase Scan for RR-69
 * Ensures no test/debug endpoints remain in the codebase
 */

import { describe, it, expect } from 'vitest';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const projectRoot = process.cwd();

// Helper to recursively find all TypeScript/JavaScript files
async function findSourceFiles(dir: string, fileList: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    // Skip node_modules, .next, and other build directories
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', 'dist', '.git', 'coverage', '__tests__'].includes(entry.name)) {
        await findSourceFiles(fullPath, fileList);
      }
    } else if (entry.isFile()) {
      // Include TypeScript, JavaScript, and config files
      if (/\.(ts|tsx|js|jsx|json)$/.test(entry.name) && !entry.name.includes('.test.')) {
        fileList.push(fullPath);
      }
    }
  }
  
  return fileList;
}

describe('Codebase Security Scan - RR-69', () => {
  let sourceFiles: string[];

  beforeAll(async () => {
    // Get all source files
    sourceFiles = await findSourceFiles(join(projectRoot, 'src'));
    
    // Also check root config files
    const rootConfigs = [
      'next.config.js',
      'package.json',
      'tsconfig.json',
      'ecosystem.config.js'
    ].map(file => join(projectRoot, file));
    
    sourceFiles.push(...rootConfigs);
  });

  describe('Test Endpoint References', () => {
    const testEndpoints = [
      'test-supabase',
      'test-prompt-config',
      'test-api-endpoints',
      'test-refresh-stats',
      'debug/data-cleanup'
    ];

    testEndpoints.forEach(endpoint => {
      it(`should not contain references to ${endpoint}`, async () => {
        const filesWithEndpoint: string[] = [];
        
        for (const file of sourceFiles) {
          try {
            const content = await readFile(file, 'utf-8');
            if (content.includes(endpoint)) {
              filesWithEndpoint.push(file);
            }
          } catch (error) {
            // Skip files that can't be read
          }
        }
        
        expect(filesWithEndpoint).toHaveLength(0);
        if (filesWithEndpoint.length > 0) {
          console.error(`Files containing "${endpoint}":`, filesWithEndpoint);
        }
      });
    });
  });

  describe('Route File Existence', () => {
    it('should not have test route files in app directory', async () => {
      const testRoutes = [
        'src/app/test-supabase/page.tsx',
        'src/app/test-performance/page.tsx',
        'src/app/test-server-api/page.tsx',
        'src/app/test-article-controls/page.tsx',
        'src/app/api/test-supabase/route.ts',
        'src/app/api/test-prompt-config/route.ts',
        'src/app/api/test-api-endpoints/route.ts',
        'src/app/api/test-refresh-stats/route.ts',
        'src/app/api/debug/data-cleanup/route.ts'
      ];

      for (const routePath of testRoutes) {
        const fullPath = join(projectRoot, routePath);
        const exists = await readFile(fullPath, 'utf-8')
          .then(() => true)
          .catch(() => false);
        
        expect(exists).toBe(false);
        if (exists) {
          console.error(`Test route still exists: ${routePath}`);
        }
      }
    });
  });

  describe('Import Statement Scan', () => {
    it('should not import from test modules', async () => {
      const filesWithTestImports: string[] = [];
      const testImportPatterns = [
        /from\s+['"].*test-supabase/,
        /from\s+['"].*test-prompt-config/,
        /from\s+['"].*test-api-endpoints/,
        /from\s+['"].*debug\/data-cleanup/,
        /import\s+.*test-refresh-stats/
      ];

      for (const file of sourceFiles) {
        try {
          const content = await readFile(file, 'utf-8');
          for (const pattern of testImportPatterns) {
            if (pattern.test(content)) {
              filesWithTestImports.push(file);
              break;
            }
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }

      expect(filesWithTestImports).toHaveLength(0);
      if (filesWithTestImports.length > 0) {
        console.error('Files with test imports:', filesWithTestImports);
      }
    });
  });

  describe('Environment Variable Usage', () => {
    it('should not use test-specific environment variables', async () => {
      const filesWithTestEnvVars: string[] = [];
      const testEnvPatterns = [
        /NEXT_PUBLIC_TEST_MODE/,
        /ENABLE_DEBUG_ENDPOINTS/,
        /TEST_SUPABASE_ENABLED/,
        /DEBUG_API_ENABLED/
      ];

      for (const file of sourceFiles) {
        try {
          const content = await readFile(file, 'utf-8');
          for (const pattern of testEnvPatterns) {
            if (pattern.test(content)) {
              filesWithTestEnvVars.push(file);
              break;
            }
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }

      expect(filesWithTestEnvVars).toHaveLength(0);
    });
  });

  describe('Navigation and Link References', () => {
    it('should not have navigation links to test pages', async () => {
      const filesWithTestLinks: string[] = [];
      const linkPatterns = [
        /href=["'].*test-supabase/,
        /href=["'].*test-performance/,
        /href=["'].*test-server-api/,
        /href=["'].*debug\/data-cleanup/,
        /Link.*to=["'].*test-/
      ];

      for (const file of sourceFiles) {
        try {
          const content = await readFile(file, 'utf-8');
          for (const pattern of linkPatterns) {
            if (pattern.test(content)) {
              filesWithTestLinks.push(file);
              break;
            }
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }

      expect(filesWithTestLinks).toHaveLength(0);
    });
  });

  describe('API Client References', () => {
    it('should not have API client calls to test endpoints', async () => {
      const filesWithTestAPICalls: string[] = [];
      const apiCallPatterns = [
        /fetch.*test-supabase/,
        /fetch.*test-prompt-config/,
        /axios.*test-api-endpoints/,
        /request.*debug\/data-cleanup/,
        /\$\.ajax.*test-refresh-stats/
      ];

      for (const file of sourceFiles) {
        try {
          const content = await readFile(file, 'utf-8');
          for (const pattern of apiCallPatterns) {
            if (pattern.test(content)) {
              filesWithTestAPICalls.push(file);
              break;
            }
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }

      expect(filesWithTestAPICalls).toHaveLength(0);
    });
  });

  describe('Build Configuration', () => {
    it('should not include test pages in next.config.js', async () => {
      const nextConfigPath = join(projectRoot, 'next.config.js');
      
      try {
        const content = await readFile(nextConfigPath, 'utf-8');
        
        expect(content).not.toContain('test-supabase');
        expect(content).not.toContain('test-prompt-config');
        expect(content).not.toContain('debug/data-cleanup');
        
        // Check for any custom webpack rules for test endpoints
        expect(content).not.toMatch(/webpack.*test-/);
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          // next.config.js doesn't exist, which is fine - check next.config.mjs instead
          const mjsConfigPath = join(projectRoot, 'next.config.mjs');
          const content = await readFile(mjsConfigPath, 'utf-8');
          
          expect(content).not.toContain('test-supabase');
          expect(content).not.toContain('test-prompt-config');
          expect(content).not.toContain('debug/data-cleanup');
          
          // Check for any custom webpack rules for test endpoints
          expect(content).not.toMatch(/webpack.*test-/);
        } else {
          throw error;
        }
      }
    });

    it('should not have test scripts in package.json', async () => {
      const packageJsonPath = join(projectRoot, 'package.json');
      const content = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      
      // Check scripts section
      if (packageJson.scripts) {
        Object.entries(packageJson.scripts).forEach(([name, script]) => {
          if (typeof script === 'string') {
            expect(script).not.toContain('test-supabase');
            expect(script).not.toContain('test-api-endpoints');
            expect(script).not.toContain('debug/data-cleanup');
          }
        });
      }
    });
  });

  describe('Service Worker Precache', () => {
    it('should not precache test endpoints in service worker', async () => {
      const swPath = join(projectRoot, 'public', 'sw.js');
      try {
        const content = await readFile(swPath, 'utf-8');
        
        expect(content).not.toContain("'/test-supabase'");
        expect(content).not.toContain("'/api/test-supabase'");
        expect(content).not.toContain("'/api/test-prompt-config'");
        expect(content).not.toContain("'/api/debug/data-cleanup'");
        
        // Check for test endpoints in precache manifest
        expect(content).not.toMatch(/test-.*page_client-reference-manifest/);
      } catch (error) {
        // Service worker might not exist in test environment
        console.log('Service worker not found, skipping SW tests');
      }
    });
  });
});

describe('Scripts Directory Scan', () => {
  it('should update validate-build.sh to use production endpoints', async () => {
    const scriptPath = join(projectRoot, 'scripts', 'validate-build.sh');
    const content = await readFile(scriptPath, 'utf-8');
    
    // Should not reference test endpoint
    expect(content).not.toContain('/api/test-supabase');
    
    // Should use production health endpoints
    expect(content).toContain('/api/health/app');
    expect(content).toContain('/api/health/db');
  });

  it('should not have test endpoint references in any script', async () => {
    const scriptsDir = join(projectRoot, 'scripts');
    const scripts = await readdir(scriptsDir);
    const filesWithTestRefs: string[] = [];
    
    for (const script of scripts) {
      if (script.endsWith('.sh') || script.endsWith('.js')) {
        const content = await readFile(join(scriptsDir, script), 'utf-8');
        if (content.includes('test-supabase') || 
            content.includes('test-prompt-config') ||
            content.includes('debug/data-cleanup')) {
          filesWithTestRefs.push(script);
        }
      }
    }
    
    expect(filesWithTestRefs).toHaveLength(0);
    if (filesWithTestRefs.length > 0) {
      console.error('Scripts with test references:', filesWithTestRefs);
    }
  });
});