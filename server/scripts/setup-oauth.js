#!/usr/bin/env node

const { chromium } = require('playwright');
const express = require('express');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { URL } = require('url');
require('dotenv').config();

// Configuration
const CONFIG = {
  serverPort: process.env.SERVER_PORT || 8080,
  clientId: process.env.INOREADER_CLIENT_ID,
  clientSecret: process.env.INOREADER_CLIENT_SECRET,
  redirectUri: process.env.INOREADER_OAUTH_REDIRECT_URI || 'http://localhost:8080/auth/callback',
  testEmail: process.env.TEST_INOREADER_EMAIL,
  testPassword: process.env.TEST_INOREADER_PASSWORD,
  tokensPath: process.env.RSS_READER_TOKENS_PATH || path.join(process.env.HOME, '.rss-reader', 'tokens.json'),
  encryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
};

// Validate configuration
function validateConfig() {
  const required = ['clientId', 'clientSecret', 'testEmail', 'testPassword', 'encryptionKey'];
  const missing = required.filter(key => !CONFIG[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please ensure your .env file contains all required values.');
    process.exit(1);
  }
}

// Encryption utilities
function encrypt(text) {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(CONFIG.encryptionKey, 'base64');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

// Create Express server for OAuth callback
function createOAuthServer() {
  return new Promise((resolve, reject) => {
    const app = express();
    let server;
    let receivedTokens = null;
    
    // OAuth callback handler
    app.get('/auth/callback', async (req, res) => {
      const { code, error } = req.query;
      
      if (error) {
        console.error('❌ OAuth error:', error);
        res.send(`<h1>Authentication Failed</h1><p>${error}</p>`);
        reject(new Error(error));
        return;
      }
      
      if (!code) {
        console.error('❌ No authorization code received');
        res.send('<h1>Authentication Failed</h1><p>No authorization code received</p>');
        reject(new Error('No authorization code'));
        return;
      }
      
      console.log('✅ Authorization code received');
      
      try {
        // Exchange code for tokens
        const tokenUrl = 'https://www.inoreader.com/oauth2/token';
        const params = new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: CONFIG.clientId,
          client_secret: CONFIG.clientSecret,
          redirect_uri: CONFIG.redirectUri,
        });
        
        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });
        
        if (!response.ok) {
          throw new Error(`Token exchange failed: ${response.status}`);
        }
        
        const tokens = await response.json();
        console.log('✅ Tokens received successfully');
        
        receivedTokens = {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
          token_type: tokens.token_type,
          scope: tokens.scope,
          created_at: Date.now(),
        };
        
        res.send(`
          <h1>Authentication Successful!</h1>
          <p>You can close this window and return to the terminal.</p>
          <script>setTimeout(() => window.close(), 2000);</script>
        `);
        
        // Close server after successful auth
        setTimeout(() => {
          server.close();
          resolve(receivedTokens);
        }, 1000);
        
      } catch (error) {
        console.error('❌ Token exchange error:', error);
        res.send(`<h1>Token Exchange Failed</h1><p>${error.message}</p>`);
        reject(error);
      }
    });
    
    // Start server
    server = app.listen(CONFIG.serverPort, () => {
      console.log(`🚀 OAuth callback server listening on http://localhost:${CONFIG.serverPort}`);
    });
    
    // Handle server errors
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      reject(error);
    });
  });
}

// Automate OAuth flow with Playwright
async function automateOAuthFlow() {
  console.log('🎭 Starting Playwright automation...');
  
  const browser = await chromium.launch({
    headless: false, // Show browser for user to see the process
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Build OAuth URL
    const authUrl = new URL('https://www.inoreader.com/oauth2/auth');
    authUrl.searchParams.set('client_id', CONFIG.clientId);
    authUrl.searchParams.set('redirect_uri', CONFIG.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'read write');
    authUrl.searchParams.set('state', crypto.randomBytes(16).toString('hex'));
    
    console.log('📱 Navigating to Inoreader login...');
    await page.goto(authUrl.toString());
    
    // Wait for login form
    await page.waitForSelector('input[name="username"], input[type="email"]', { timeout: 10000 });
    
    // Fill login credentials
    console.log('🔑 Entering credentials...');
    const emailInput = await page.$('input[name="username"], input[type="email"]');
    const passwordInput = await page.$('input[name="password"], input[type="password"]');
    
    await emailInput.fill(CONFIG.testEmail);
    await passwordInput.fill(CONFIG.testPassword);
    
    // Submit login form
    console.log('📤 Submitting login form...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"], input[type="submit"]'),
    ]);
    
    // Check if we need to authorize the app
    const authorizeButton = await page.$('button:has-text("Authorize"), input[value="Authorize"]');
    if (authorizeButton) {
      console.log('🔐 Authorizing application...');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle' }),
        authorizeButton.click(),
      ]);
    }
    
    // Wait for callback
    console.log('⏳ Waiting for OAuth callback...');
    
  } catch (error) {
    console.error('❌ Automation error:', error);
    throw error;
  } finally {
    // Keep browser open for a moment to see the result
    setTimeout(async () => {
      await browser.close();
    }, 3000);
  }
}

// Save encrypted tokens
async function saveTokens(tokens) {
  const tokensDir = path.dirname(CONFIG.tokensPath);
  
  // Create directory if it doesn't exist
  await fs.mkdir(tokensDir, { recursive: true });
  
  // Encrypt tokens
  const encryptedData = encrypt(JSON.stringify(tokens));
  
  // Save to file
  await fs.writeFile(CONFIG.tokensPath, JSON.stringify(encryptedData, null, 2));
  
  // Set file permissions to 600 (owner read/write only)
  await fs.chmod(CONFIG.tokensPath, 0o600);
  
  console.log(`✅ Tokens saved to ${CONFIG.tokensPath}`);
}

// Main setup function
async function main() {
  console.log('🚀 Starting Inoreader OAuth Setup');
  console.log('==================================\n');
  
  // Validate configuration
  validateConfig();
  
  try {
    // Start OAuth callback server
    const serverPromise = createOAuthServer();
    
    // Start browser automation
    await automateOAuthFlow();
    
    // Wait for tokens
    const tokens = await serverPromise;
    
    // Save encrypted tokens
    await saveTokens(tokens);
    
    console.log('\n✅ OAuth setup completed successfully!');
    console.log('🔒 Tokens are encrypted and stored securely.');
    console.log('🚀 The server can now access Inoreader on your behalf.');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { encrypt, CONFIG };