const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");
require("dotenv").config();

class TokenManager {
  constructor() {
    this.tokensPath =
      process.env.RSS_READER_TOKENS_PATH ||
      path.join(process.env.HOME, ".rss-reader", "tokens.json");
    this.encryptionKey = Buffer.from(
      process.env.TOKEN_ENCRYPTION_KEY,
      "base64"
    );
    this.clientId = process.env.INOREADER_CLIENT_ID;
    this.clientSecret = process.env.INOREADER_CLIENT_SECRET;
    this.tokens = null;
  }

  // Encrypt data
  encrypt(text) {
    const algorithm = "aes-256-gcm";
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
    };
  }

  // Decrypt data
  decrypt(encryptedData) {
    const algorithm = "aes-256-gcm";
    const iv = Buffer.from(encryptedData.iv, "hex");
    const authTag = Buffer.from(encryptedData.authTag, "hex");
    const decipher = crypto.createDecipheriv(algorithm, this.encryptionKey, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData.encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  // Load tokens from file
  async loadTokens() {
    try {
      const data = await fs.readFile(this.tokensPath, "utf8");
      const encryptedData = JSON.parse(data);
      const decrypted = this.decrypt(encryptedData);
      this.tokens = JSON.parse(decrypted);
      return this.tokens;
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error("No tokens found. Please run the OAuth setup first.");
      }
      throw error;
    }
  }

  // Save tokens to file
  async saveTokens(tokens) {
    const tokensDir = path.dirname(this.tokensPath);
    await fs.mkdir(tokensDir, { recursive: true });

    const encryptedData = this.encrypt(JSON.stringify(tokens));
    await fs.writeFile(this.tokensPath, JSON.stringify(encryptedData, null, 2));
    await fs.chmod(this.tokensPath, 0o600);

    this.tokens = tokens;
  }

  // Check if token needs refresh (1 hour before expiry)
  needsRefresh() {
    if (!this.tokens) return true;

    const expiresAt = this.tokens.created_at + this.tokens.expires_in * 1000;
    const refreshThreshold = expiresAt - 60 * 60 * 1000; // 1 hour before expiry

    return Date.now() >= refreshThreshold;
  }

  // Refresh access token
  async refreshTokens() {
    if (!this.tokens || !this.tokens.refresh_token) {
      throw new Error(
        "No refresh token available. Please run OAuth setup again."
      );
    }

    console.log("🔄 Refreshing access token...");

    const tokenUrl = "https://www.inoreader.com/oauth2/token";
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.tokens.refresh_token,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const newTokens = await response.json();

    // Update tokens
    this.tokens = {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || this.tokens.refresh_token,
      expires_in: newTokens.expires_in,
      token_type: newTokens.token_type,
      scope: newTokens.scope,
      created_at: Date.now(),
    };

    // Save updated tokens
    await this.saveTokens(this.tokens);

    console.log("✅ Token refreshed successfully");
    return this.tokens;
  }

  // Get valid access token (refresh if needed)
  async getAccessToken() {
    if (!this.tokens) {
      await this.loadTokens();
    }

    if (this.needsRefresh()) {
      await this.refreshTokens();
    }

    return this.tokens.access_token;
  }

  // Make authenticated request to Inoreader API
  async makeAuthenticatedRequest(url, options = {}) {
    const accessToken = await this.getAccessToken();

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token might be invalid, try refreshing
      console.log("🔄 Received 401, attempting token refresh...");
      await this.refreshTokens();

      // Retry request with new token
      const newAccessToken = await this.getAccessToken();
      headers.Authorization = `Bearer ${newAccessToken}`;

      return fetch(url, {
        ...options,
        headers,
      });
    }

    return response;
  }
}

module.exports = TokenManager;
