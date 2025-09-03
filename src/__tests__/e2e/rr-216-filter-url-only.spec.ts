/**
 * E2E Tests for RR-216: Filter URL Updates Only
 *
 * Focused test just on URL updates when filters are selected
 */

import { test, expect } from "@playwright/test";

test.describe("RR-216: Filter URL Updates", () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging to monitor for errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.error("Browser console error:", msg.text());
      } else if (
        msg.text().includes("RR-216") ||
        msg.text().includes("filter")
      ) {
        console.log("Filter log:", msg.text());
      }
    });

    await page.goto("");
    await page.waitForTimeout(5000); // Wait for app to load
  });

  test("Topic selection updates URL with tag parameter", async ({ page }) => {
    console.log("🧪 Testing topic URL updates...");

    // Click on a topic
    const topics = page.locator("text=AI Related News");
    if ((await topics.count()) > 0) {
      console.log("📍 Clicking AI Related News topic");
      await topics.first().click();
      await page.waitForTimeout(1000);

      // Check URL contains tag parameter
      const url = page.url();
      console.log(`📍 URL after topic click: ${url}`);
      expect(url).toMatch(/[?&]tag=/);

      console.log("✅ Topic URL update test passed!");
    } else {
      console.log("⚠️ AI Related News topic not found, trying any topic");

      // Try any topic under Topics section
      const topicSection = page.locator("text=Topics").first();
      await expect(topicSection).toBeVisible();

      // Look for any clickable element near Topics
      const anyTopic = page
        .locator(".cursor-pointer")
        .filter({ hasText: /Gaming|Tech|Apple|Google/ })
        .first();
      if ((await anyTopic.count()) > 0) {
        const topicText = await anyTopic.textContent();
        console.log(`📍 Clicking topic: ${topicText}`);
        await anyTopic.click();
        await page.waitForTimeout(1000);

        const url = page.url();
        console.log(`📍 URL after topic click: ${url}`);
        expect(url).toMatch(/[?&]tag=/);

        console.log("✅ Topic URL update test passed!");
      } else {
        console.log("⚠️ No topics found, skipping test");
      }
    }
  });

  test("Feed selection updates URL with feed parameter", async ({ page }) => {
    console.log("🧪 Testing feed URL updates...");

    // Look for feeds section
    const feedsSection = page.locator("text=Feeds").first();
    await expect(feedsSection).toBeVisible();

    // Try to find a feed to click
    const feedNames = [
      "The Verge",
      "TechCrunch",
      "9to5Mac",
      "MacRumors",
      "Ars Technica",
    ];
    let foundFeed = false;

    for (const feedName of feedNames) {
      const feed = page.locator(`text=${feedName}`);
      if ((await feed.count()) > 0) {
        console.log(`📍 Clicking feed: ${feedName}`);
        await feed.first().click();
        await page.waitForTimeout(1000);

        const url = page.url();
        console.log(`📍 URL after feed click: ${url}`);
        expect(url).toMatch(/[?&]feed=/);

        foundFeed = true;
        console.log("✅ Feed URL update test passed!");
        break;
      }
    }

    if (!foundFeed) {
      console.log("⚠️ No recognizable feeds found, trying any clickable feed");

      // Try any clickable element that looks like a feed (has numbers)
      const anyFeed = page
        .locator(".cursor-pointer")
        .filter({ hasText: /\d+/ })
        .first();
      if ((await anyFeed.count()) > 0) {
        const feedText = await anyFeed.textContent();
        console.log(`📍 Clicking feed: ${feedText}`);
        await anyFeed.click();
        await page.waitForTimeout(1000);

        const url = page.url();
        console.log(`📍 URL after feed click: ${url}`);
        expect(url).toMatch(/[?&]feed=/);

        console.log("✅ Feed URL update test passed!");
      } else {
        console.log("⚠️ No feeds found, skipping test");
      }
    }
  });

  test("All Articles clears URL parameters", async ({ page }) => {
    console.log("🧪 Testing All Articles URL clearing...");

    // First select a filter to have something to clear
    const topics = page
      .locator("text=Gaming")
      .or(page.locator("text=AI Related News"));
    if ((await topics.count()) > 0) {
      console.log("📍 First selecting a topic filter");
      await topics.first().click();
      await page.waitForTimeout(1000);

      // Verify filter is applied
      let url = page.url();
      console.log(`📍 URL with filter: ${url}`);
      expect(url).toMatch(/[?&](feed|tag)=/);

      // Now click All Articles
      console.log("📍 Clicking All Articles");
      const allArticles = page.locator("text=All Articles").first();
      await expect(allArticles).toBeVisible();
      await allArticles.click();
      await page.waitForTimeout(1000);

      // Check URL is cleared
      url = page.url();
      console.log(`📍 URL after All Articles: ${url}`);
      expect(url).not.toMatch(/[?&](feed|tag)=/);

      console.log("✅ All Articles URL clearing test passed!");
    } else {
      console.log("⚠️ No topics found to test clearing, skipping");
    }
  });
});
