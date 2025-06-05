# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Shayon's News RSS Reader project.

## What is an ADR?

An Architecture Decision Record captures an important architectural decision made along with its context and consequences.

## ADR Format

Each ADR follows this template:

1. **Title**: ADR-NNN: Short descriptive title
2. **Status**: Proposed | Accepted | Deprecated | Superseded
3. **Context**: What is the issue we're seeing that motivates this decision?
4. **Decision**: What is the change that we're proposing/accepting?
5. **Consequences**: What becomes easier or harder because of this decision?
6. **Alternatives Considered**: What other options were evaluated?

## Index of ADRs

- [ADR-001: Choose Next.js as Primary Framework](./ADR-001-nextjs-framework.md)
- [ADR-002: Use Zustand for State Management](./ADR-002-zustand-state-management.md)
- [ADR-003: Mozilla Readability for Content Extraction](./ADR-003-content-extraction-approach.md)
- [ADR-004: Client-Side API Rate Limiting Strategy](./ADR-004-api-rate-limiting.md)
- [ADR-005: IndexedDB for Offline Storage](./ADR-005-indexeddb-storage.md)
- [ADR-006: Self-Hosted Mac Mini Deployment](./ADR-006-mac-mini-deployment.md)
- [ADR-007: PWA Over Native Mobile App](./ADR-007-pwa-over-native.md)
- [ADR-008: Single User Architecture](./ADR-008-single-user-architecture.md)

## Creating New ADRs

When making significant architectural decisions:

1. Copy the template from `ADR-000-template.md`
2. Number it sequentially (ADR-009, ADR-010, etc.)
3. Fill in all sections thoroughly
4. Link it in this README
5. Reference it in code comments where relevant

## Reviewing ADRs

ADRs should be reviewed as part of:
- Major feature implementations
- Significant refactoring efforts
- Performance optimization work
- Security improvements

When an ADR is superseded, update its status and link to the new ADR that replaces it.