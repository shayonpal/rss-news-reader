const express = require("express");
const router = express.Router();
const TokenManager = require("../lib/token-manager");

router.post("/mark-all-read", async (req, res) => {
  try {
    const { streamId } = req.body;

    if (!streamId) {
      return res.status(400).json({ error: "Stream ID is required" });
    }

    const tokenManager = new TokenManager();

    // Prepare the request to Inoreader
    const params = new URLSearchParams({
      s: streamId,
      ts: Math.floor(Date.now() / 1000).toString(), // Current timestamp in seconds
    });

    // Call Inoreader mark-all-as-read API
    const response = await tokenManager.makeAuthenticatedRequest(
      "https://www.inoreader.com/reader/api/0/mark-all-as-read",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(
        "Inoreader mark-all-as-read failed:",
        response.status,
        text
      );
      return res.status(response.status).json({
        error: `Mark all as read failed: ${response.statusText}`,
        details: text,
      });
    }

    // Log the API call
    const fs = require("fs").promises;
    const path = require("path");
    const logEntry = {
      timestamp: new Date().toISOString(),
      endpoint: "/mark-all-as-read",
      trigger: "mark-all-read",
      method: "POST",
      streamId: streamId,
    };

    const logPath = path.join(
      __dirname,
      "../../logs/inoreader-api-calls.jsonl"
    );
    await fs
      .appendFile(logPath, JSON.stringify(logEntry) + "\n")
      .catch((err) => {
        console.error("Failed to log API call:", err);
      });

    res.json({ success: true });
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({
      error: "Failed to mark all as read",
      message: error.message,
    });
  }
});

module.exports = router;
