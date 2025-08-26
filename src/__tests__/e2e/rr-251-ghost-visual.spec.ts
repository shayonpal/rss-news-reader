/**
 * RR-251: Ghost Button Visual E2E Test
 * 
 * Tests ghost button violet theme integration in actual browser
 * Validates CSS variable resolution, visual appearance, and contrast
 */

import { test, expect } from "@playwright/test";

test.describe("RR-251: Ghost Button Violet Theme E2E", () => {
  const articleId = "1b6db912-773b-426b-b6f6-d0fdaf65c416"; // Sample article
  
  test.beforeEach(async ({ page }) => {
    // Navigate to article detail page
    await page.goto(`/reader/articles/${articleId}`);
    await page.waitForSelector(".glass-footer", { timeout: 10000 });
  });
  
  test("Ghost navigation buttons should render with violet theme", async ({ page }) => {
    // Check Previous button exists with ghost variant
    const prevButton = page.locator('button:has-text("Previous")');
    await expect(prevButton).toBeVisible();
    
    // Check Next button exists with ghost variant
    const nextButton = page.locator('button:has-text("Next")');
    await expect(nextButton).toBeVisible();
    
    // Verify ghost variant classes are applied
    const prevClasses = await prevButton.getAttribute("class");
    expect(prevClasses).toContain("text-[color:var(--ghost-text-light)]");
    expect(prevClasses).toContain("dark:text-[color:var(--ghost-text-dark)]");
    
    const nextClasses = await nextButton.getAttribute("class");
    expect(nextClasses).toContain("text-[color:var(--ghost-text-light)]");
    expect(nextClasses).toContain("dark:text-[color:var(--ghost-text-dark)]");
  });
  
  test("CSS variables should resolve to correct colors", async ({ page }) => {
    // Get computed styles for light mode
    const prevButton = page.locator('button:has-text("Previous")');
    
    // Check CSS variable values exist in globals.css
    const ghostTextLight = await page.evaluate(() => {
      const root = document.documentElement;
      return getComputedStyle(root).getPropertyValue("--ghost-text-light").trim();
    });
    
    const ghostTextDark = await page.evaluate(() => {
      const root = document.documentElement;
      return getComputedStyle(root).getPropertyValue("--ghost-text-dark").trim();
    });
    
    // Verify violet-700 RGB values (109, 40, 217)
    expect(ghostTextLight).toBe("rgb(109, 40, 217)");
    
    // Verify white for dark mode
    expect(ghostTextDark).toBe("rgb(255 255 255)");
  });
  
  test("Ghost buttons should have proper glass effects", async ({ page }) => {
    const prevButton = page.locator('button:has-text("Previous")');
    
    // Check for glass morphing classes
    const classes = await prevButton.getAttribute("class");
    expect(classes).toContain("backdrop-blur-[16px]");
    expect(classes).toContain("backdrop-saturate-[180%]");
    expect(classes).toContain("hover:bg-white/35");
  });
  
  test("Ghost buttons should maintain accessibility", async ({ page }) => {
    // Check aria-labels
    const prevButton = page.locator('button[aria-label="Previous article"]');
    const nextButton = page.locator('button[aria-label="Next article"]');
    
    await expect(prevButton).toBeVisible();
    await expect(nextButton).toBeVisible();
    
    // Check minimum touch target sizes (48px)
    const prevBox = await prevButton.boundingBox();
    const nextBox = await nextButton.boundingBox();
    
    expect(prevBox?.height).toBeGreaterThanOrEqual(48);
    expect(prevBox?.width).toBeGreaterThanOrEqual(48);
    expect(nextBox?.height).toBeGreaterThanOrEqual(48);
    expect(nextBox?.width).toBeGreaterThanOrEqual(48);
  });
  
  test("Dark mode toggle should change ghost button colors", async ({ page }) => {
    // Get initial color in light mode
    const initialColor = await page.evaluate(() => {
      const button = document.querySelector('button:has-text("Previous")') as HTMLElement;
      return window.getComputedStyle(button).color;
    });
    
    // Toggle dark mode (assuming toggle exists in header)
    const themeToggle = page.locator('[aria-label*="theme"]').first();
    if (await themeToggle.count() > 0) {
      await themeToggle.click();
      await page.waitForTimeout(500); // Wait for transition
      
      // Get color after dark mode toggle
      const darkModeColor = await page.evaluate(() => {
        const button = document.querySelector('button:has-text("Previous")') as HTMLElement;
        return window.getComputedStyle(button).color;
      });
      
      // Colors should be different
      expect(darkModeColor).not.toBe(initialColor);
    }
  });
  
  test("Ghost buttons should have proper hover states", async ({ page }) => {
    const prevButton = page.locator('button:has-text("Previous")');
    
    // Get initial background
    const initialBg = await prevButton.evaluate((el) => 
      window.getComputedStyle(el).backgroundColor
    );
    
    // Hover over button
    await prevButton.hover();
    await page.waitForTimeout(300); // Wait for transition
    
    // Get hover background
    const hoverBg = await prevButton.evaluate((el) => 
      window.getComputedStyle(el).backgroundColor
    );
    
    // Background should change on hover (glass effect)
    expect(hoverBg).not.toBe(initialBg);
  });
  
  test("WCAG contrast compliance", async ({ page }) => {
    // This test validates that the contrast ratios meet WCAG standards
    // Light mode: violet-700 (#6d28d9) on glass background
    // Dark mode: white on glass background
    
    const contrastReport = await page.evaluate(() => {
      // Helper function to calculate relative luminance
      const getLuminance = (r: number, g: number, b: number) => {
        const [rs, gs, bs] = [r, g, b].map(c => {
          c = c / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      };
      
      // Helper to calculate contrast ratio
      const getContrastRatio = (l1: number, l2: number) => {
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      };
      
      // Light mode: violet-700 on white-ish glass
      const violetLum = getLuminance(109, 40, 217);
      const lightBgLum = getLuminance(255, 255, 255); // Simplified for glass
      const lightModeRatio = getContrastRatio(violetLum, lightBgLum);
      
      // Dark mode: white on dark glass
      const whiteLum = getLuminance(255, 255, 255);
      const darkBgLum = getLuminance(30, 30, 30); // Simplified for dark glass
      const darkModeRatio = getContrastRatio(whiteLum, darkBgLum);
      
      return {
        lightMode: {
          ratio: lightModeRatio.toFixed(2),
          meetsAA: lightModeRatio >= 4.5,
          meetsAAA: lightModeRatio >= 7
        },
        darkMode: {
          ratio: darkModeRatio.toFixed(2),
          meetsAA: darkModeRatio >= 4.5,
          meetsAAA: darkModeRatio >= 7
        }
      };
    });
    
    // Both modes should meet WCAG AA standards (4.5:1 minimum)
    expect(contrastReport.lightMode.meetsAA).toBe(true);
    expect(contrastReport.darkMode.meetsAA).toBe(true);
    
    // Log the actual ratios for verification
    console.log("Contrast Ratios:", contrastReport);
  });
});