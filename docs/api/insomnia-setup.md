# Insomnia Setup Guide

This guide will help you import and configure the RSS News Reader API collection in Insomnia.

## Quick Start

### 1. Export the Collection

You have three options to get the Insomnia collection:

#### Option A: Download from Swagger UI (Recommended)

1. Navigate to [http://100.96.166.53:3000/reader/api-docs](http://100.96.166.53:3000/reader/api-docs)
2. Click the **"Export to Insomnia"** button in the header
3. Save the `rss-reader-insomnia.json` file

#### Option B: Direct API Download

```bash
# Download via curl
curl -o rss-reader-insomnia.json http://100.96.166.53:3000/reader/api/insomnia.json

# Or via wget
wget -O rss-reader-insomnia.json http://100.96.166.53:3000/reader/api/insomnia.json
```

#### Option C: CLI Export Script

```bash
# Export with default localhost
npm run export:insomnia

# Export with Tailscale URL
npm run export:insomnia -- --server http://100.96.166.53:3000

# Export with custom server
npm run export:insomnia -- --server http://127.0.0.1:3000
```

The CLI script saves files to `exports/insomnia/` directory.

### 2. Import into Insomnia

1. **Open Insomnia** (v8.0 or later recommended)

2. **Import the Collection**:
   - Go to **Application** → **Preferences** → **Data** → **Import Data**
   - Or use keyboard shortcut: `Cmd+O` (Mac) / `Ctrl+O` (Windows/Linux)
   - Select **"From File"**
   - Choose your downloaded `rss-reader-insomnia.json` file

3. **Collection Imported!** You'll see:
   - A new workspace called "RSS Reader API"
   - Folders organized by API tags (Health, Sync Operations, etc.)
   - All endpoints with proper request configuration

### 3. Configure Environment Variables

The collection includes an environment with placeholders. Configure these for your setup:

1. **Click the Environment dropdown** (top-left, shows "RSS Reader Environment")
2. **Click "Manage Environments"**
3. **Edit the RSS Reader Environment**:

```json
{
  "base_url": "http://100.96.166.53:3000/reader",
  "api_key": "your-api-key-here",
  "auth_token": "your-bearer-token-here"
}
```

#### Environment Variables Explained:

- **`base_url`**: The server URL (automatically set based on export source)
- **`api_key`**: Your API key (if using API key authentication)
- **`auth_token`**: Bearer token for authenticated endpoints

### 4. Domain Configuration

The collection automatically adapts to different domains:

| Environment       | Base URL                           |
| ----------------- | ---------------------------------- |
| Local Development | `http://localhost:3000/reader`     |
| Loopback          | `http://127.0.0.1:3000/reader`     |
| Tailscale Network | `http://100.96.166.53:3000/reader` |
| Production        | `https://your-domain.com/reader`   |

To switch domains:

1. Edit the environment's `base_url` variable
2. All requests will automatically use the new domain

## Using the Collection

### Making Requests

1. **Select an endpoint** from the collection sidebar
2. **Review the request** - URL, method, headers are pre-configured
3. **Add parameters** if needed (query params, path params, body)
4. **Click "Send"** to execute the request
5. **View the response** in the response pane

### Authentication

For protected endpoints, you'll need to authenticate first:

1. **Get OAuth Token**:
   - Use the `/api/auth/inoreader/login` endpoint
   - Follow the OAuth flow
   - Copy the returned token

2. **Set the Token**:
   - Go to Environment settings
   - Update `auth_token` with your token
   - Requests will automatically include: `Authorization: Bearer {{ _.auth_token }}`

### Example Workflows

#### Health Check

```
1. Open: Health → GET /api/health
2. Click "Send"
3. Verify all services are operational
```

#### Trigger Sync

```
1. Authenticate first (get token)
2. Open: Sync Operations → POST /api/sync/trigger
3. Add body: { "type": "incremental" }
4. Click "Send"
5. Monitor progress with GET /api/sync/status/{syncId}
```

#### Fetch Articles

```
1. Open: Articles → GET /api/articles
2. Add query params: limit=20, offset=0
3. Click "Send"
4. Browse paginated results
```

## Advanced Features

### Request Chaining

Use Insomnia's chaining to use response data in subsequent requests:

```javascript
// In request URL or body:
{
  {
    _.response.body.syncId;
  }
} // Use syncId from previous response
```

### Environment Switching

Create multiple environments for different setups:

- Development (localhost)
- Staging (test server)
- Production (live server)

Switch between them using the environment dropdown.

### Request Groups

The collection is organized by OpenAPI tags:

- **Health**: System health checks
- **Sync Operations**: Article synchronization
- **Articles**: Article CRUD operations
- **Tags**: Tag management
- **Authentication**: OAuth flows
- **Developer Tools**: Export and debug endpoints

## Troubleshooting

### CORS Issues

The API includes CORS headers (`Access-Control-Allow-Origin: *`). If you encounter CORS issues:

1. Ensure you're using the correct base URL
2. Check if the server is running
3. Verify network connectivity (especially for Tailscale)

### Rate Limiting

The Insomnia export endpoint is rate-limited:

- **Limit**: 1 request per minute per IP
- **Cache**: Responses cached for 5 minutes
- If rate-limited, wait 60 seconds before retrying

### Authentication Errors

If requests return 401 Unauthorized:

1. Check if token is expired
2. Re-authenticate using login endpoint
3. Update the `auth_token` environment variable

### Memory Issues (CLI Export)

If the CLI script fails with memory errors:

```bash
# Run with increased memory
node --max-old-space-size=1024 scripts/export-insomnia.ts
```

## Additional Resources

- **Swagger UI**: [http://100.96.166.53:3000/reader/api-docs](http://100.96.166.53:3000/reader/api-docs)
- **OpenAPI Spec**: [http://100.96.166.53:3000/reader/api-docs/openapi.json](http://100.96.166.53:3000/reader/api-docs/openapi.json)
- **Insomnia Documentation**: [https://docs.insomnia.rest](https://docs.insomnia.rest)

## Screenshots

### Import Dialog

![Import Dialog](./screenshots/insomnia-import.png)
_Location: Application → Preferences → Data → Import Data_

### Environment Configuration

![Environment Setup](./screenshots/insomnia-environment.png)
_Configure base_url and authentication tokens_

### Making a Request

![Request Example](./screenshots/insomnia-request.png)
_Example of making a health check request_

## Notes

- The collection is auto-generated from the OpenAPI specification
- New endpoints are automatically included when the spec is updated
- The collection supports Insomnia v4 format (compatible with v8.0+)
- All request examples use environment variables for flexibility

## Support

For issues or questions:

1. Check the [API Documentation](http://100.96.166.53:3000/reader/api-docs)
2. Review server logs: `pm2 logs rss-reader-dev`
3. Create an issue in Linear with tag "API"
