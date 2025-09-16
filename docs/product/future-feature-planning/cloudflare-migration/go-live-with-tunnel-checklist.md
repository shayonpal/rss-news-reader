# Go‑Live with Cloudflare Tunnel — Checklist

Goal: Serve the current app publicly at https://reader.uberfolks.ca with minimal code changes (keep `/reader` base path for now).

## Prerequisites

- Cloudflare account with `uberfolks.ca` in your Cloudflare zone
- `cloudflared` installed on the Mac Mini (origin)
- App available on the origin at `http://localhost:3000` (or `https://localhost:3000` if you use the dev HTTPS server)

## 1) Create a named Tunnel

```bash
cloudflared tunnel login                     # one‑time auth
cloudflared tunnel create rss-reader         # creates tunnel + credentials
```

## 2) Configure ingress

Create `~/.cloudflared/config.yml` (replace ORIGIN with your actual scheme):

```yaml
tunnel: rss-reader
credentials-file: /Users/<you>/.cloudflared/<generated>.json

ingress:
  - hostname: reader.uberfolks.ca
    service: http://localhost:3000    # OR use https://localhost:3000 with noTLSVerify
  - service: http_status:404

# If your local app is HTTPS with self‑signed cert, add:
originRequest:
  noTLSVerify: true
```

## 3) Route DNS to the Tunnel

```bash
cloudflared tunnel route dns rss-reader reader.uberfolks.ca
```

This creates the CNAME in Cloudflare for `reader.uberfolks.ca` → your Tunnel.

## 4) Run the Tunnel (foreground to test, then as a service)

```bash
# Quick test
cloudflared tunnel run rss-reader

# Install as a service (optional, for persistence)
sudo cloudflared service install
cloudflared tunnel run rss-reader &
```

## 5) Add a root → /reader redirect (temporary)

In Cloudflare Dashboard → Rules → URL Rewrite (Transform Rule):

- If Host equals `reader.uberfolks.ca` AND Path equals `/`
- Then Static Rewrite Path to `/reader`

This keeps the current basePath working while giving a clean root URL.

## 6) Smoke test

- Open https://reader.uberfolks.ca/reader
- Verify app loads (icons/manifest, fonts, images)
- Hit health endpoints:
  - `https://reader.uberfolks.ca/reader/api/health/app`
  - `https://reader.uberfolks.ca/reader/api/health/cron`
- Trigger a light API call (e.g., `POST /reader/api/sync`) if safe

## 7) Optional — OAuth callback

When ready to test OAuth via the public domain, update Inoreader’s callback to:

```
https://reader.uberfolks.ca/reader/api/auth/inoreader/callback
```

## 8) Rollback

- Disable the Tunnel: `cloudflared tunnel run` process stop (or disable the service)
- Remove the DNS route: Cloudflare Dashboard → DNS → delete the CNAME

## Notes & Gotchas

- If you run the app with HTTPS locally (self‑signed), keep `originRequest.noTLSVerify: true`.
- Ensure the Mac Mini firewall allows `cloudflared` outbound connections.
- Keep PM2/Next running as before; the Tunnel only proxies traffic—no app changes needed.

