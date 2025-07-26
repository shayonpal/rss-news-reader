#!/usr/bin/env node

const express = require('express');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const CONFIG = {
  serverPort: 8081,
  clientId: process.env.INOREADER_CLIENT_ID,
  clientSecret: process.env.INOREADER_CLIENT_SECRET,
  redirectUri: 'http://localhost:8080/auth/callback',
  tokensPath: path.join(process.env.HOME, '.rss-reader', 'tokens.json'),
  encryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
};

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

async function saveTokens(tokens) {
  const tokensDir = path.dirname(CONFIG.tokensPath);
  await fs.mkdir(tokensDir, { recursive: true });
  
  const encryptedData = encrypt(JSON.stringify(tokens));
  await fs.writeFile(CONFIG.tokensPath, JSON.stringify(encryptedData, null, 2));
  await fs.chmod(CONFIG.tokensPath, 0o600);
  
  console.log(`✅ Tokens saved to ${CONFIG.tokensPath}`);
}

const app = express();

app.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    console.error('❌ OAuth error:', error);
    res.send(`<h1>Authentication Failed</h1><p>${error}</p>`);
    return;
  }
  
  if (!code) {
    console.error('❌ No authorization code received');
    res.send('<h1>Authentication Failed</h1><p>No authorization code received</p>');
    return;
  }
  
  console.log('✅ Authorization code received');
  
  try {
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
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
    }
    
    const tokens = await response.json();
    console.log('✅ Tokens received successfully');
    
    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type,
      scope: tokens.scope,
      created_at: Date.now(),
    };
    
    await saveTokens(tokenData);
    
    res.send(`
      <h1>Authentication Successful!</h1>
      <p>Tokens have been saved. You can close this window.</p>
      <p>The sync server should now be able to process the queued changes.</p>
    `);
    
    console.log('\n✅ OAuth setup completed successfully!');
    console.log('🔒 Tokens are encrypted and stored securely.');
    console.log('🚀 The sync server can now access Inoreader.');
    
    setTimeout(() => {
      process.exit(0);
    }, 3000);
    
  } catch (error) {
    console.error('❌ Token exchange error:', error);
    res.send(`<h1>Token Exchange Failed</h1><p>${error.message}</p>`);
  }
});

const server = app.listen(CONFIG.serverPort, () => {
  console.log(`🚀 OAuth callback server listening on http://localhost:${CONFIG.serverPort}`);
  console.log('\n📋 OAuth Authorization URL:');
  
  const authUrl = new URL('https://www.inoreader.com/oauth2/auth');
  authUrl.searchParams.set('client_id', CONFIG.clientId);
  authUrl.searchParams.set('redirect_uri', CONFIG.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'read write');
  authUrl.searchParams.set('state', crypto.randomBytes(16).toString('hex'));
  
  console.log('\n' + authUrl.toString());
  console.log('\nPlease visit this URL in your browser to authenticate.');
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});