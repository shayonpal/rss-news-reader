# ADR-001: Remove Production Environment

- **Status:** Accepted
- **Date:** 2025-08-01

## Context

The application was running in a dual-environment setup (development and production) on a single Mac Mini. The production server (`rss-reader-prod`) was experiencing critical resource contention, leading to system instability. On July 31, 2025, the production process had 51 restarts in 4 hours, and overall system memory usage was at 87.5%. This instability was causing cascading failures across all services, including the development and sync processes.

## Decision

We will remove the production environment entirely. The application will run as a single, development-only instance accessible via a Tailscale-protected URL (`http://100.96.166.53:3000/reader`). This simplifies the architecture to a single-user, self-hosted model, which aligns with its primary purpose. The Caddy reverse proxy, which was only used for the production instance, will also be removed.

## Consequences

**Positive:**

- System memory usage was immediately reduced from 87.5% to ~71%.
- Service instability caused by resource contention was eliminated.
- The monitoring, maintenance, and deployment processes are significantly simplified.
- The removal of the Caddy layer simplifies the network stack for direct client-to-Next.js access.

**Negative:**

- There is no longer a separate, isolated "production" environment. The `dev` branch is the live, running instance. This is an acceptable trade-off for a single-user, personal application.

**Neutral:**

- Port 3147 is freed for future use.
- The application's architecture is now formally a single-environment setup.
