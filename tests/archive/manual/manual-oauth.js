#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");
require("dotenv").config();

const CONFIG = {
  clientId: process.env.INOREADER_CLIENT_ID,
  clientSecret: process.env.INOREADER_CLIENT_SECRET,
  redirectUri:
    process.env.INOREADER_REDIRECT_URI || "http://localhost:8080/auth/callback",
  tokensPath: path.join(process.env.HOME, ".rss-reader", "tokens.json"),
  encryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
};

function encrypt(text) {
  const algorithm = "aes-256-gcm";
  const key = Buffer.from(CONFIG.encryptionKey, "base64");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

async function saveTokens(tokens) {
  const tokensDir = path.dirname(CONFIG.tokensPath);
  await fs.mkdir(tokensDir, { recursive: true });

  const encryptedData = encrypt(JSON.stringify(tokens));
  await fs.writeFile(CONFIG.tokensPath, JSON.stringify(encryptedData, null, 2));
  await fs.chmod(CONFIG.tokensPath, 0o600);

  console.log(`✅ Tokens saved to ${CONFIG.tokensPath}`);
}

async function exchangeCodeForTokens(code) {
  const tokenUrl = "https://www.inoreader.com/oauth2/token";
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: CONFIG.clientId,
    client_secret: CONFIG.clientSecret,
    redirect_uri: CONFIG.redirectUri,
  });

  console.log("🔄 Exchanging authorization code for tokens...");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
  }

  const tokens = await response.json();
  console.log("✅ Tokens received successfully");

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
    token_type: tokens.token_type,
    scope: tokens.scope,
    created_at: Date.now(),
  };
}

async function main() {
  console.log("🚀 Manual Inoreader OAuth Setup");
  console.log("================================\n");

  // Generate OAuth URL
  const authUrl = new URL("https://www.inoreader.com/oauth2/auth");
  authUrl.searchParams.set("client_id", CONFIG.clientId);
  authUrl.searchParams.set("redirect_uri", CONFIG.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "read write");
  authUrl.searchParams.set("state", crypto.randomBytes(16).toString("hex"));

  console.log("📋 Step 1: Visit this URL in your browser:\n");
  console.log(authUrl.toString());

  console.log(
    "\n📋 Step 2: After authorization, you'll be redirected to a URL like:"
  );
  console.log(`${CONFIG.redirectUri}?code=AUTHORIZATION_CODE&state=STATE`);

  console.log("\n📋 Step 3: Copy the authorization code from the URL and run:");
  console.log(`node ${__filename} YOUR_AUTHORIZATION_CODE`);

  const code = process.argv[2];

  if (code) {
    try {
      const tokens = await exchangeCodeForTokens(code);
      await saveTokens(tokens);

      console.log("\n✅ OAuth setup completed successfully!");
      console.log("🔒 Tokens are encrypted and stored securely.");
      console.log("🚀 The sync server can now access Inoreader.");

      // Verify sync queue
      console.log("\n📊 Checking sync queue status...");
      const { execSync } = require("child_process");
      try {
        const result = execSync(
          "pm2 logs rss-sync-server --nostream --lines 5",
          { encoding: "utf8" }
        );
        console.log("Recent sync server logs:", result);
      } catch (e) {
        console.log("Could not check sync server logs");
      }
    } catch (error) {
      console.error("\n❌ Error:", error.message);
      process.exit(1);
    }
  }
}

main().catch(console.error);
