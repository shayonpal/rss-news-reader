# ADR-007: Dual Filter System for Article List

- **Status:** Accepted
- **Date:** 2025-01-20

## Context

The article list view needs to be filterable by two independent criteria: the **source** of the articles (e.g., a specific feed or folder) and their **read status** (unread, read, or all). A single filter control would be cumbersome and would not allow for persistent filtering of one criterion while changing the other.

## Decision

We will implement a dual-filter system with two distinct UI components:

1.  **Source Filter:** A traditional dropdown menu located in the main header. This will allow the user to select "All Articles," a specific folder, or a specific feed.
2.  **Read Status Filter:** A floating "pill" style segmented control that appears on scroll. This will provide quick access to toggle between "All," "Unread," and "Read" states without cluttering the primary header.

The state of these two filters will be managed independently but applied jointly to the article list.

## Consequences

**Positive:**

- Provides a powerful and flexible filtering experience for the user.
- Separates concerns, making the UI cleaner and more intuitive. The primary (source) filter is always visible, while the secondary (status) filter appears only when needed (during scrolling).
- The floating pill for read status is a modern UI pattern that aligns with the iOS 26 design aesthetic.

**Negative:**

- The state management is more complex, as two separate filter states must be tracked and combined.
- The floating pill adds a layer of UI complexity and requires careful implementation to manage its visibility based on scroll position.

**Neutral:**

- This establishes a clear pattern for how filtering is handled in the application.
