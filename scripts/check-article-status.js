#!/usr/bin/env node
const path = require("path");
const TokenManager = require("../server/lib/token-manager");

async function checkArticleStatus(inoreaderItemId) {
  const tokenManager = new TokenManager();

  try {
    const response = await tokenManager.makeAuthenticatedRequest(
      `https://www.inoreader.com/reader/api/0/stream/items/contents?i=${inoreaderItemId}`
    );

    const data = await response.json();
    const item = data.items?.[0];

    if (!item) {
      console.log(`Article ${inoreaderItemId} not found`);
      return;
    }

    const isRead = item.categories?.some((cat) =>
      cat.endsWith("/state/com.google/read")
    );

    console.log(`Article: ${item.title}`);
    console.log(`Status: ${isRead ? "✅ READ" : "❌ UNREAD"}`);
    console.log(`ID: ${inoreaderItemId}`);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// Check one article from each set
const articles = [
  {
    id: "tag:google.com,2005:reader/item/0000000aaf16e0ee",
    name: "Apple free cash flow (DB marked)",
  },
  {
    id: "tag:google.com,2005:reader/item/0000000aaf1b1935",
    name: "FastestVPN (App marked)",
  },
];

(async () => {
  console.log("Checking article read status in Inoreader...\n");

  for (const article of articles) {
    console.log(`\nChecking: ${article.name}`);
    console.log("─".repeat(50));
    await checkArticleStatus(article.id);
  }
})();
