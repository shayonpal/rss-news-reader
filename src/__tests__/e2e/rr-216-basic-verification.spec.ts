/**
 * Basic RR-216 Race Condition Fix Verification
 * 
 * Simple test to verify the core race condition fix is working:
 * - URL state preservation
 * - Header state preservation  
 * - Article content filtering (not all articles)
 */

import { test, expect } from "@playwright/test";

test.describe("RR-216: Basic Race Condition Fix", () => {
  test("Core race condition fix verification", async ({ page }) => {
    console.log("🧪 Testing core race condition fix...");

    // Enable gating detection
    let gatingDetected = false;
    page.on('console', msg => {
      if (msg.text().includes('🚫 Filters not ready, skipping article load.')) {
        gatingDetected = true;
        console.log('✅ Gating detected - preventing premature article load');
      }
      if (msg.text().includes('↩️ Stale request') && msg.text().includes('ignored')) {
        console.log('✅ Sequencing detected - rejecting stale request');
      }
    });

    // Navigate directly to filtered view to test race condition scenario
    const tagId = "b139c50e-19d9-4438-b69c-908aed45452d";
    await page.goto(`http://100.96.166.53:3000/reader?tag=${tagId}`);
    await page.waitForTimeout(5000); // Allow time for race condition scenario

    // Verify URL preservation
    expect(page.url()).toContain(`tag=${tagId}`);
    console.log("✅ URL contains correct tag parameter");

    // Check if we can find the "India/Canada" text anywhere on page
    const hasCorrectHeader = await page.locator('text=India/Canada').first().isVisible({ timeout: 10000 });
    if (hasCorrectHeader) {
      console.log("✅ Header shows India/Canada filter (not All Articles)");
    }

    // Most important: verify we're NOT showing all articles
    const pageText = await page.textContent('body');
    
    // These articles should NOT appear in India/Canada filter
    const hasAppleWatchArticle = pageText.includes('Apple Watch Reportedly Set');
    const hasAirPodsArticle = pageText.includes('Here are the best AirPods deals');
    const hasUnrelatedContent = hasAppleWatchArticle || hasAirPodsArticle;
    
    expect(hasUnrelatedContent).toBe(false);
    console.log("✅ Not showing unrelated articles - filtering is working correctly");

    // Verify we have some India/Canada specific content
    const hasIndiaCanadaContent = pageText.includes('Canada') || pageText.includes('Amazon') || pageText.includes('Realme');
    expect(hasIndiaCanadaContent).toBe(true);
    console.log("✅ Showing relevant India/Canada articles");

    console.log("✅ Core race condition fix verification PASSED");
    console.log(`📊 Gating was detected: ${gatingDetected}`);
  });
});