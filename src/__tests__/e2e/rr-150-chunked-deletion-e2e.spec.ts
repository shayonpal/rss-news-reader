import { test, expect } from '@playwright/test';

/**
 * RR-150: End-to-end tests for chunked article deletion
 * Tests the complete user flow to ensure 414 URI errors are resolved
 */
test.describe('RR-150: Chunked Article Deletion E2E', () => {
  const baseUrl = 'http://100.96.166.53:3000/reader';
  
  test.beforeEach(async ({ page }) => {
    // Navigate to RSS reader
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Manual Sync with Large Article Cleanup', () => {
    test('should complete sync without 414 errors when cleaning up 1000+ articles', async ({ page }) => {
      // Navigate to sync settings or trigger manual sync
      await page.click('[data-testid="sync-button"]', { timeout: 10000 });
      
      // Wait for sync to start
      await expect(page.locator('[data-testid="sync-status"]')).toContainText(['Syncing', 'Starting'], { timeout: 5000 });
      
      // Monitor sync progress - should not get 414 errors
      let syncCompleted = false;
      let has414Error = false;
      
      // Poll sync status for up to 2 minutes
      for (let i = 0; i < 120; i++) {
        await page.waitForTimeout(1000);
        
        const statusText = await page.locator('[data-testid="sync-status"]').textContent();
        const errorMessage = await page.locator('[data-testid="sync-error"]').textContent();
        
        if (statusText?.includes('Complete') || statusText?.includes('Success')) {
          syncCompleted = true;
          break;
        }
        
        if (errorMessage?.includes('414') || errorMessage?.includes('Request-URI Too Large')) {
          has414Error = true;
          break;
        }
      }
      
      // Verify sync completed without 414 errors
      expect(has414Error).toBe(false);
      expect(syncCompleted).toBe(true);
      
      // Check that sync status shows successful cleanup
      const finalStatus = await page.locator('[data-testid="sync-status"]').textContent();
      expect(finalStatus).not.toContain('414');
      expect(finalStatus).not.toContain('Request-URI Too Large');
    });

    test('should show progress indicators during chunked cleanup operations', async ({ page }) => {
      // Start manual sync
      await page.click('[data-testid="sync-button"]');
      
      // Check for chunked processing indicators
      await expect(page.locator('[data-testid="cleanup-progress"]')).toBeVisible({ timeout: 10000 });
      
      // Should show chunk progress if cleanup is happening
      const progressText = await page.locator('[data-testid="cleanup-progress"]').textContent();
      
      if (progressText && !progressText.includes('No articles to clean')) {
        // Should show chunked processing information
        expect(progressText).toMatch(/Processing chunk \d+ of \d+|Cleaned \d+ articles/);
      }
      
      // Wait for completion
      await expect(page.locator('[data-testid="sync-status"]')).toContainText('Complete', { timeout: 60000 });
    });
  });

  test.describe('Automatic Sync Behavior', () => {
    test('should handle scheduled sync without URI length errors', async ({ page }) => {
      // Check sync logs for recent automatic syncs
      await page.goto(`${baseUrl}/admin/sync-logs`);
      await page.waitForLoadState('networkidle');
      
      // Look for recent sync entries
      const recentSyncs = page.locator('[data-testid="sync-log-entry"]').first();
      await expect(recentSyncs).toBeVisible();
      
      // Check that recent syncs don't contain 414 errors
      const logEntries = await page.locator('[data-testid="sync-log-entry"]').all();
      
      for (const entry of logEntries.slice(0, 5)) { // Check last 5 entries
        const logText = await entry.textContent();
        expect(logText).not.toContain('414');
        expect(logText).not.toContain('Request-URI Too Large');
        expect(logText).not.toContain('Failed to delete articles');
      }
    });

    test('should show cleanup metrics in sync dashboard', async ({ page }) => {
      // Navigate to sync dashboard
      await page.goto(`${baseUrl}/admin/sync-dashboard`);
      await page.waitForLoadState('networkidle');
      
      // Check cleanup metrics
      const cleanupSection = page.locator('[data-testid="cleanup-metrics"]');
      await expect(cleanupSection).toBeVisible();
      
      // Should show chunked operation metrics
      const metricsText = await cleanupSection.textContent();
      
      if (metricsText?.includes('Articles Cleaned')) {
        // Should show chunk processing stats
        expect(page.locator('[data-testid="total-chunks"]')).toBeVisible();
        expect(page.locator('[data-testid="successful-chunks"]')).toBeVisible();
        expect(page.locator('[data-testid="processing-time"]')).toBeVisible();
      }
    });
  });

  test.describe('Error Handling and Recovery', () => {
    test('should display helpful error messages if chunked cleanup fails', async ({ page }) => {
      // Simulate scenario where some chunks fail
      // This would be triggered by admin controls or API
      
      await page.goto(`${baseUrl}/admin/test-cleanup`);
      await page.waitForLoadState('networkidle');
      
      // Trigger test cleanup with simulated failures
      await page.fill('[data-testid="test-article-count"]', '1000');
      await page.fill('[data-testid="test-failure-rate"]', '0.2');
      await page.click('[data-testid="start-test-cleanup"]');
      
      // Wait for test to complete
      await expect(page.locator('[data-testid="test-results"]')).toBeVisible({ timeout: 30000 });
      
      const results = await page.locator('[data-testid="test-results"]').textContent();
      
      // Should show detailed chunk results
      expect(results).toContain('Total Chunks');
      expect(results).toContain('Successful Chunks');
      expect(results).toContain('Failed Chunks');
      
      // Should not show 414 errors even with failures
      expect(results).not.toContain('414');
      expect(results).not.toContain('Request-URI Too Large');
    });

    test('should allow retry of failed cleanup operations', async ({ page }) => {
      // Navigate to cleanup management
      await page.goto(`${baseUrl}/admin/cleanup-management`);
      await page.waitForLoadState('networkidle');
      
      // Check if there are any failed operations to retry
      const retryButtons = page.locator('[data-testid="retry-cleanup"]');
      
      if (await retryButtons.count() > 0) {
        // Click retry on first failed operation
        await retryButtons.first().click();
        
        // Should show retry progress
        await expect(page.locator('[data-testid="retry-progress"]')).toBeVisible();
        
        // Wait for retry completion
        await expect(page.locator('[data-testid="retry-status"]')).toContainText('Complete', { timeout: 60000 });
        
        // Verify retry didn't encounter 414 errors
        const retryStatus = await page.locator('[data-testid="retry-status"]').textContent();
        expect(retryStatus).not.toContain('414');
        expect(retryStatus).not.toContain('Request-URI Too Large');
      }
    });
  });

  test.describe('Performance and User Experience', () => {
    test('should maintain responsive UI during large cleanup operations', async ({ page }) => {
      // Start cleanup of large dataset
      await page.click('[data-testid="sync-button"]');
      
      // UI should remain responsive during operation
      await expect(page.locator('[data-testid="article-list"]')).toBeVisible();
      
      // Should be able to navigate during sync
      await page.click('[data-testid="settings-link"]');
      await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();
      
      // Navigate back to main view
      await page.click('[data-testid="home-link"]');
      await expect(page.locator('[data-testid="article-list"]')).toBeVisible();
      
      // Sync should still be progressing
      const syncStatus = await page.locator('[data-testid="sync-status"]').textContent();
      expect(syncStatus).toMatch(/Syncing|Processing|Complete/);
    });

    test('should show estimated time remaining for large cleanup operations', async ({ page }) => {
      // Trigger sync that will involve cleanup
      await page.click('[data-testid="sync-button"]');
      
      // Should show progress with time estimates for large operations
      const progressIndicator = page.locator('[data-testid="cleanup-progress"]');
      
      if (await progressIndicator.isVisible()) {
        const progressText = await progressIndicator.textContent();
        
        if (progressText?.includes('chunk')) {
          // Should show estimated time or progress percentage
          expect(progressText).toMatch(/\d+%|\d+:\d+|estimated|remaining/i);
        }
      }
    });
  });

  test.describe('Configuration and Admin Controls', () => {
    test('should allow admin to configure chunk size for cleanup operations', async ({ page }) => {
      // Navigate to admin settings
      await page.goto(`${baseUrl}/admin/cleanup-settings`);
      await page.waitForLoadState('networkidle');
      
      // Should show chunk size configuration
      const chunkSizeInput = page.locator('[data-testid="chunk-size-input"]');
      await expect(chunkSizeInput).toBeVisible();
      
      // Current value should be reasonable (200 based on implementation)
      const currentValue = await chunkSizeInput.inputValue();
      expect(parseInt(currentValue)).toBeGreaterThan(50);
      expect(parseInt(currentValue)).toBeLessThan(500);
      
      // Should allow modification
      await chunkSizeInput.fill('150');
      await page.click('[data-testid="save-settings"]');
      
      // Should confirm save
      await expect(page.locator('[data-testid="settings-saved"]')).toBeVisible();
    });

    test('should show cleanup statistics and health metrics', async ({ page }) => {
      // Navigate to cleanup dashboard
      await page.goto(`${baseUrl}/admin/cleanup-dashboard`);
      await page.waitForLoadState('networkidle');
      
      // Should show key metrics
      await expect(page.locator('[data-testid="articles-cleaned-today"]')).toBeVisible();
      await expect(page.locator('[data-testid="average-chunk-size"]')).toBeVisible();
      await expect(page.locator('[data-testid="cleanup-success-rate"]')).toBeVisible();
      
      // Should show that 414 errors are resolved
      const errorMetrics = page.locator('[data-testid="error-metrics"]');
      if (await errorMetrics.isVisible()) {
        const errorText = await errorMetrics.textContent();
        
        // Should show zero or declining 414 errors
        expect(errorText).toMatch(/414.*0|Request-URI.*0|No URI errors/i);
      }
    });
  });

  test.describe('Monitoring and Alerting', () => {
    test('should provide monitoring data for chunked operations', async ({ page }) => {
      // Navigate to monitoring page
      await page.goto(`${baseUrl}/admin/monitoring`);
      await page.waitForLoadState('networkidle');
      
      // Should show chunked operation metrics
      const monitoringData = page.locator('[data-testid="chunked-operations"]');
      await expect(monitoringData).toBeVisible();
      
      // Should include relevant metrics
      const metricsText = await monitoringData.textContent();
      expect(metricsText).toMatch(/chunks processed|average chunk time|success rate/i);
    });

    test('should alert on cleanup failures but not on 414 errors', async ({ page }) => {
      // Check alerts page
      await page.goto(`${baseUrl}/admin/alerts`);
      await page.waitForLoadState('networkidle');
      
      // Look for recent alerts
      const alerts = page.locator('[data-testid="alert-entry"]');
      
      if (await alerts.count() > 0) {
        const alertTexts = await alerts.allTextContents();
        
        // Should not have 414 or URI length alerts
        const uri414Alerts = alertTexts.filter(text => 
          text.includes('414') || text.includes('Request-URI Too Large')
        );
        
        expect(uri414Alerts).toHaveLength(0);
      }
    });
  });
});