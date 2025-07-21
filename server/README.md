# RSS Reader Server

This server handles all Inoreader API communication for the RSS Reader PWA.

## Architecture

- **OAuth Management**: Automated setup using Playwright
- **Token Security**: AES-256-GCM encryption for stored tokens
- **API Proxy**: All Inoreader API calls go through the server
- **Automatic Refresh**: Tokens refresh automatically before expiry

## Initial Setup

1. Ensure your `.env` file contains all required variables:
   ```env
   INOREADER_CLIENT_ID=your_client_id
   INOREADER_CLIENT_SECRET=your_client_secret
   INOREADER_OAUTH_REDIRECT_URI=http://localhost:8080/auth/callback
   TEST_INOREADER_EMAIL=your_email
   TEST_INOREADER_PASSWORD=your_password
   TOKEN_ENCRYPTION_KEY=your_base64_key
   ```

2. Run the OAuth setup:
   ```bash
   npm run setup:oauth
   ```

   This will:
   - Start a local Express server on port 8080
   - Open a browser window with Playwright
   - Automatically log in to Inoreader
   - Capture the OAuth tokens
   - Encrypt and store them in `~/.rss-reader/tokens.json`

3. Test the setup:
   ```bash
   node server/scripts/test-tokens.js
   ```

## File Structure

```
server/
├── scripts/
│   ├── setup-oauth.js    # One-time OAuth setup
│   └── test-tokens.js    # Token verification
├── lib/
│   └── token-manager.js  # Token encryption/refresh
└── README.md
```

## Security

- Tokens are encrypted using AES-256-GCM
- Token file has 600 permissions (owner read/write only)
- Encryption key must be kept secret
- No tokens are ever sent to the client

## Next Steps

After OAuth setup, implement:
1. Sync service (US-102)
2. API endpoints (US-103)
3. Content extraction (US-104)
4. Tailscale monitoring (US-105)