# Technical Documentation (docs/tech)

This README indexes the technical documents in this folder. It lists only files that exist under `docs/tech/`, with concise descriptions for quick navigation.

## Core

- **technology-stack.md**: Overview of frameworks, libraries, tools, and versions.
- **implementation-strategy.md**: High-level implementation approach and architectural decisions.
- **ci-cd-pipeline.md**: GitHub Actions pipeline, quality gates, test matrix, performance and security scans.

## Architecture

- **button-architecture.md**: Button component architecture, variants, states, and accessibility.
- **floating-controls-architecture.md**: Floating controls layout and interaction patterns.
- **cleanup-architecture.md**: Chunked deletion strategy and cleanup workflows for large datasets.
- **sync-progress-tracking-architecture.md**: Dual-write progress tracking across filesystem and database.
- **liquid-glass-unification.md**: Liquid glass UI component unification and design decisions.

## Integrations

- **api-integrations.md**: External APIs (Inoreader, Claude AI), auth flows, rate limits, endpoints, and error handling.
- **bidirectional-sync.md**: Two-way sync design with Inoreader and conflict handling.

## Testing

- **testing-strategy.md**: Testing layers and coverage strategy.
- **e2e-testing.md**: End-to-end testing setup and critical flows.

## Monitoring & Security

- **monitoring-and-alerting.md**: Monitoring objectives, metrics, alerting, and dashboards.
- **uptime-kuma-monitoring.md**: Uptime Kuma setup and monitor configuration.
- **security.md**: Security measures, policies, and incident documentation.

## Maintenance & Known Issues

- **webpack-recovery.md**: Webpack recovery steps and troubleshooting.
- **known-issues.md**: Known issues, limitations, and workarounds (living document).

## Historical Implementation Notes

- **mark-all-read-implementation.md**: Historical implementation notes and context.
- **browser-api-mocking.md**: Historical implementation notes and context.

---

If you add or rename files in `docs/tech/`, please update this index to keep it accurate.
