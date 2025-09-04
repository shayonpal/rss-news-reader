/**
 * E2E tests for RR-269: User Preferences in Settings Page
 * Tests full user flows for managing preferences through the UI
 */

import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

// Test constants
const BASE_URL = "http://100.96.166.53:3000/reader";
const SETTINGS_URL = `${BASE_URL}/settings`;
const API_BASE = `${BASE_URL}/api`;

// AI Models available in the system
const AI_MODELS = [
  { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
  { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet" },
  { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku" },
  { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
  { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
];

// Helper to wait for API response
async function waitForPreferencesAPI(page: Page, action: () => Promise<void>) {
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes("/api/users/preferences"),
    { timeout: 5000 }
  );
  await action();
  return await responsePromise;
}

// Helper to get current preferences via API
async function getCurrentPreferences(page: Page) {
  const response = await page.request.get(`${API_BASE}/users/preferences`);
  expect(response.ok()).toBeTruthy();
  return await response.json();
}

// Helper to check mobile viewport
async function setMobileViewport(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 Pro
}

test.describe("RR-269: Settings Page - User Preferences E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to settings page
    await page.goto(SETTINGS_URL);
    
    // Wait for page to be interactive
    await page.waitForLoadState("networkidle");
    
    // Verify we're on settings page
    await expect(page).toHaveURL(SETTINGS_URL);
    
    // Check for settings header
    const header = page.locator('h1:has-text("Settings")');
    await expect(header).toBeVisible();
  });

  test.describe("Display Preferences", () => {
    test("should load and display current preferences", async ({ page }) => {
      // Get preferences from API
      const prefs = await getCurrentPreferences(page);
      
      // Verify theme selector shows correct value
      const themeSelect = page.locator('select[name="theme"]');
      await expect(themeSelect).toHaveValue(prefs.theme || "system");
      
      // Verify font size selector
      const fontSizeSelect = page.locator('select[name="fontSize"]');
      await expect(fontSizeSelect).toHaveValue(prefs.fontSize || "medium");
      
      // Verify reading width selector
      const readingWidthSelect = page.locator('select[name="readingWidth"]');
      await expect(readingWidthSelect).toHaveValue(prefs.readingWidth || "medium");
    });

    test("should show default values for new users", async ({ page }) => {
      // Mock empty preferences response
      await page.route("**/api/users/preferences", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            json: {
              summaryWordCount: "70-80",
              summaryStyle: "objective",
              syncMaxArticles: 100,
              theme: "system",
              fontSize: "medium",
              readingWidth: "medium",
              enableNotifications: false,
            },
          });
        } else {
          await route.continue();
        }
      });

      await page.reload();
      
      // Verify default values are shown
      await expect(page.locator('select[name="theme"]')).toHaveValue("system");
      await expect(page.locator('input[name="summaryWordCount"]')).toHaveValue("70-80");
      await expect(page.locator('select[name="summaryStyle"]')).toHaveValue("objective");
      await expect(page.locator('input[name="syncMaxArticles"]')).toHaveValue("100");
    });
  });

  test.describe("Theme Preferences", () => {
    test("should update theme preference", async ({ page }) => {
      const themeSelect = page.locator('select[name="theme"]');
      
      // Change to dark theme
      const response = await waitForPreferencesAPI(page, async () => {
        await themeSelect.selectOption("dark");
      });
      
      expect(response.status()).toBe(200);
      const updatedPrefs = await response.json();
      expect(updatedPrefs.theme).toBe("dark");
      
      // Verify UI updates
      await expect(page.locator("body")).toHaveClass(/dark/);
    });

    test("should persist theme across page reloads", async ({ page }) => {
      // Set dark theme
      await page.locator('select[name="theme"]').selectOption("dark");
      await page.waitForResponse((resp) => resp.url().includes("/api/users/preferences"));
      
      // Reload page
      await page.reload();
      
      // Verify theme persisted
      await expect(page.locator('select[name="theme"]')).toHaveValue("dark");
      await expect(page.locator("body")).toHaveClass(/dark/);
    });

    test("should apply system theme when selected", async ({ page }) => {
      await page.locator('select[name="theme"]').selectOption("system");
      
      // Check if system preference is applied
      const prefersDark = await page.evaluate(() => 
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
      
      if (prefersDark) {
        await expect(page.locator("body")).toHaveClass(/dark/);
      } else {
        await expect(page.locator("body")).not.toHaveClass(/dark/);
      }
    });
  });

  test.describe("Summary Preferences", () => {
    test("should update summary word count", async ({ page }) => {
      const wordCountInput = page.locator('input[name="summaryWordCount"]');
      
      // Clear and set new value
      await wordCountInput.clear();
      
      const response = await waitForPreferencesAPI(page, async () => {
        await wordCountInput.type("150-200");
        await wordCountInput.blur(); // Trigger update on blur
      });
      
      expect(response.status()).toBe(200);
      const prefs = await response.json();
      expect(prefs.summaryWordCount).toBe("150-200");
    });

    test("should validate word count format", async ({ page }) => {
      const wordCountInput = page.locator('input[name="summaryWordCount"]');
      
      // Try invalid format
      await wordCountInput.clear();
      await wordCountInput.type("invalid");
      await wordCountInput.blur();
      
      // Should show error
      const error = page.locator('.error-message:has-text("Invalid format")');
      await expect(error).toBeVisible();
      
      // Should not save invalid value
      const prefs = await getCurrentPreferences(page);
      expect(prefs.summaryWordCount).not.toBe("invalid");
    });

    test("should update summary style", async ({ page }) => {
      const styleSelect = page.locator('select[name="summaryStyle"]');
      
      const response = await waitForPreferencesAPI(page, async () => {
        await styleSelect.selectOption("analytical");
      });
      
      expect(response.status()).toBe(200);
      const prefs = await response.json();
      expect(prefs.summaryStyle).toBe("analytical");
    });

    test("should update AI model preference", async ({ page }) => {
      const modelSelect = page.locator('select[name="summaryModel"]');
      
      // Verify all models are available
      const options = await modelSelect.locator("option").all();
      expect(options.length).toBeGreaterThanOrEqual(AI_MODELS.length);
      
      // Select a different model
      const response = await waitForPreferencesAPI(page, async () => {
        await modelSelect.selectOption("claude-3-haiku-20240307");
      });
      
      expect(response.status()).toBe(200);
      const prefs = await response.json();
      expect(prefs.summaryModel).toBe("claude-3-haiku-20240307");
    });

    test("should show model details on selection", async ({ page }) => {
      const modelSelect = page.locator('select[name="summaryModel"]');
      await modelSelect.selectOption("claude-3-opus-20240229");
      
      // Should display model info
      const modelInfo = page.locator('.model-info');
      await expect(modelInfo).toContainText("Claude 3 Opus");
      await expect(modelInfo).toContainText("Most capable");
    });
  });

  test.describe("Sync Preferences", () => {
    test("should update sync max articles", async ({ page }) => {
      const syncInput = page.locator('input[name="syncMaxArticles"]');
      
      await syncInput.clear();
      
      const response = await waitForPreferencesAPI(page, async () => {
        await syncInput.type("500");
        await syncInput.blur();
      });
      
      expect(response.status()).toBe(200);
      const prefs = await response.json();
      expect(prefs.syncMaxArticles).toBe(500);
    });

    test("should enforce sync limits (10-1000)", async ({ page }) => {
      const syncInput = page.locator('input[name="syncMaxArticles"]');
      
      // Try value below minimum
      await syncInput.clear();
      await syncInput.type("5");
      await syncInput.blur();
      
      const errorLow = page.locator('.error-message:has-text("Minimum 10")');
      await expect(errorLow).toBeVisible();
      
      // Try value above maximum
      await syncInput.clear();
      await syncInput.type("2000");
      await syncInput.blur();
      
      const errorHigh = page.locator('.error-message:has-text("Maximum 1000")');
      await expect(errorHigh).toBeVisible();
    });

    test("should show sync impact warning for high values", async ({ page }) => {
      const syncInput = page.locator('input[name="syncMaxArticles"]');
      
      await syncInput.clear();
      await syncInput.type("800");
      
      // Should show performance warning
      const warning = page.locator('.warning-message:has-text("may impact performance")');
      await expect(warning).toBeVisible();
    });
  });

  test.describe("Display Preferences", () => {
    test("should update font size and preview", async ({ page }) => {
      const fontSelect = page.locator('select[name="fontSize"]');
      const previewText = page.locator('.preview-text');
      
      // Change to large
      await fontSelect.selectOption("large");
      
      // Check preview updates
      await expect(previewText).toHaveCSS("font-size", "18px");
      
      // Change to small
      await fontSelect.selectOption("small");
      await expect(previewText).toHaveCSS("font-size", "14px");
    });

    test("should update reading width and preview", async ({ page }) => {
      const widthSelect = page.locator('select[name="readingWidth"]');
      const previewContainer = page.locator('.preview-container');
      
      // Change to narrow
      await widthSelect.selectOption("narrow");
      const narrowWidth = await previewContainer.evaluate((el) => el.offsetWidth);
      
      // Change to wide
      await widthSelect.selectOption("wide");
      const wideWidth = await previewContainer.evaluate((el) => el.offsetWidth);
      
      expect(wideWidth).toBeGreaterThan(narrowWidth);
    });

    test("should toggle notifications preference", async ({ page }) => {
      const notifToggle = page.locator('input[name="enableNotifications"]');
      
      // Check current state
      const initialChecked = await notifToggle.isChecked();
      
      // Toggle
      const response = await waitForPreferencesAPI(page, async () => {
        await notifToggle.click();
      });
      
      expect(response.status()).toBe(200);
      const prefs = await response.json();
      expect(prefs.enableNotifications).toBe(!initialChecked);
    });
  });

  test.describe("Mobile Experience", () => {
    test("should work on mobile viewport", async ({ page }) => {
      await setMobileViewport(page);
      await page.reload();
      
      // Settings should be accessible
      const settingsHeader = page.locator('h1:has-text("Settings")');
      await expect(settingsHeader).toBeVisible();
      
      // All preference sections should be visible (may require scrolling)
      const sections = ["Display", "Summary", "Sync"];
      for (const section of sections) {
        const sectionHeader = page.locator(`h2:has-text("${section}")`);
        await sectionHeader.scrollIntoViewIfNeeded();
        await expect(sectionHeader).toBeVisible();
      }
    });

    test("should have touch-friendly controls", async ({ page }) => {
      await setMobileViewport(page);
      
      // Check minimum touch target sizes (44x44px)
      const selects = await page.locator("select").all();
      for (const select of selects) {
        const box = await select.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
      
      const buttons = await page.locator("button").all();
      for (const button of buttons) {
        const box = await button.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        expect(box?.width).toBeGreaterThanOrEqual(44);
      }
    });

    test("should handle swipe gestures for navigation", async ({ page }) => {
      await setMobileViewport(page);
      
      // Swipe between preference sections
      await page.locator(".settings-container").evaluate((el) => {
        const touch = new Touch({
          identifier: 1,
          target: el,
          clientX: 300,
          clientY: 400,
        });
        
        const startEvent = new TouchEvent("touchstart", {
          touches: [touch],
          targetTouches: [touch],
          changedTouches: [touch],
        });
        
        const moveTouch = new Touch({
          identifier: 1,
          target: el,
          clientX: 50,
          clientY: 400,
        });
        
        const moveEvent = new TouchEvent("touchmove", {
          touches: [moveTouch],
          targetTouches: [moveTouch],
          changedTouches: [moveTouch],
        });
        
        el.dispatchEvent(startEvent);
        el.dispatchEvent(moveEvent);
      });
      
      // Verify navigation occurred
      await expect(page.locator(".active-section")).toBeVisible();
    });
  });

  test.describe("Bulk Operations", () => {
    test("should reset all preferences to defaults", async ({ page }) => {
      // Find reset button
      const resetButton = page.locator('button:has-text("Reset to Defaults")');
      
      // Click reset
      await resetButton.click();
      
      // Confirm in dialog
      const confirmButton = page.locator('.dialog button:has-text("Confirm")');
      await confirmButton.click();
      
      // Wait for API call
      await page.waitForResponse((resp) => 
        resp.url().includes("/api/users/preferences") && 
        resp.request().method() === "PUT"
      );
      
      // Verify defaults applied
      const prefs = await getCurrentPreferences(page);
      expect(prefs.summaryWordCount).toBe("70-80");
      expect(prefs.summaryStyle).toBe("objective");
      expect(prefs.syncMaxArticles).toBe(100);
      expect(prefs.theme).toBe("system");
    });

    test("should export preferences as JSON", async ({ page }) => {
      // Find export button
      const exportButton = page.locator('button:has-text("Export")');
      
      // Setup download promise
      const downloadPromise = page.waitForEvent("download");
      
      // Click export
      await exportButton.click();
      
      // Wait for download
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain("preferences");
      expect(download.suggestedFilename()).toContain(".json");
      
      // Verify content
      const content = await download.createReadStream();
      const text = await streamToString(content);
      const exported = JSON.parse(text);
      
      expect(exported).toHaveProperty("summaryWordCount");
      expect(exported).toHaveProperty("theme");
    });

    test("should import preferences from JSON", async ({ page }) => {
      const importData = {
        theme: "dark",
        summaryWordCount: "200-250",
        summaryStyle: "concise",
        syncMaxArticles: 750,
      };
      
      // Find import button
      const importButton = page.locator('button:has-text("Import")');
      await importButton.click();
      
      // File input appears
      const fileInput = page.locator('input[type="file"]');
      
      // Create file and upload
      const buffer = Buffer.from(JSON.stringify(importData));
      await fileInput.setInputFiles({
        name: "preferences.json",
        mimeType: "application/json",
        buffer,
      });
      
      // Wait for import to complete
      await page.waitForResponse((resp) => 
        resp.url().includes("/api/users/preferences") && 
        resp.request().method() === "PUT"
      );
      
      // Verify imported values
      await expect(page.locator('select[name="theme"]')).toHaveValue("dark");
      await expect(page.locator('input[name="summaryWordCount"]')).toHaveValue("200-250");
      await expect(page.locator('select[name="summaryStyle"]')).toHaveValue("concise");
      await expect(page.locator('input[name="syncMaxArticles"]')).toHaveValue("750");
    });
  });

  test.describe("Performance", () => {
    test("should load settings page within 3 seconds on mobile", async ({ page }) => {
      await setMobileViewport(page);
      
      const startTime = Date.now();
      await page.goto(SETTINGS_URL);
      await page.waitForLoadState("networkidle");
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(3000);
    });

    test("should update preferences optimistically", async ({ page }) => {
      const themeSelect = page.locator('select[name="theme"]');
      
      // Measure time from interaction to UI update
      const startTime = Date.now();
      await themeSelect.selectOption("dark");
      
      // UI should update immediately
      await expect(page.locator("body")).toHaveClass(/dark/);
      const uiUpdateTime = Date.now() - startTime;
      
      // Should be near-instant (under 100ms)
      expect(uiUpdateTime).toBeLessThan(100);
      
      // API call happens in background
      await page.waitForResponse((resp) => resp.url().includes("/api/users/preferences"));
    });

    test("should debounce rapid preference changes", async ({ page }) => {
      const syncInput = page.locator('input[name="syncMaxArticles"]');
      
      let apiCallCount = 0;
      page.on("request", (request) => {
        if (request.url().includes("/api/users/preferences") && 
            request.method() === "PUT") {
          apiCallCount++;
        }
      });
      
      // Make rapid changes
      await syncInput.clear();
      await syncInput.type("1");
      await syncInput.type("0");
      await syncInput.type("0");
      
      // Wait for debounce period
      await page.waitForTimeout(1000);
      
      // Should only make one API call
      expect(apiCallCount).toBeLessThanOrEqual(1);
    });
  });

  test.describe("Error Handling", () => {
    test("should show error when API fails", async ({ page }) => {
      // Mock API failure
      await page.route("**/api/users/preferences", async (route) => {
        if (route.request().method() === "PUT") {
          await route.fulfill({
            status: 500,
            json: { error: "Database error" },
          });
        } else {
          await route.continue();
        }
      });
      
      // Try to update preference
      const themeSelect = page.locator('select[name="theme"]');
      await themeSelect.selectOption("dark");
      
      // Should show error message
      const errorToast = page.locator('.toast-error:has-text("Failed to save")');
      await expect(errorToast).toBeVisible();
      
      // Value should revert
      await expect(themeSelect).not.toHaveValue("dark");
    });

    test("should retry failed updates", async ({ page }) => {
      let attempts = 0;
      
      await page.route("**/api/users/preferences", async (route) => {
        if (route.request().method() === "PUT") {
          attempts++;
          if (attempts < 3) {
            await route.fulfill({ status: 500 });
          } else {
            await route.continue();
          }
        } else {
          await route.continue();
        }
      });
      
      // Update preference
      const themeSelect = page.locator('select[name="theme"]');
      await themeSelect.selectOption("dark");
      
      // Wait for retries to complete
      await page.waitForTimeout(3000);
      
      // Should eventually succeed
      expect(attempts).toBe(3);
      await expect(themeSelect).toHaveValue("dark");
    });

    test("should handle network offline gracefully", async ({ page, context }) => {
      // Go offline
      await context.setOffline(true);
      
      // Try to update preference
      const themeSelect = page.locator('select[name="theme"]');
      await themeSelect.selectOption("dark");
      
      // Should show offline message
      const offlineMessage = page.locator('.toast-warning:has-text("Offline")');
      await expect(offlineMessage).toBeVisible();
      
      // Go back online
      await context.setOffline(false);
      
      // Should auto-retry and succeed
      await page.waitForResponse((resp) => resp.url().includes("/api/users/preferences"));
      await expect(themeSelect).toHaveValue("dark");
    });
  });
});

// Helper function to convert stream to string
async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}