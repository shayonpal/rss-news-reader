# ADR-005: Adopt Bottom Tab Navigation

- **Status:** Accepted
- **Date:** 2025-01-20

## Context

The application's primary navigation was based on a traditional hamburger menu that revealed a sidebar. While functional, this pattern is less ergonomic on mobile devices and does not align with modern iOS design conventions. The goal is to make the PWA feel like a native iOS application, where bottom tab bars are the standard for primary navigation.

## Decision

We will replace the hamburger menu and sidebar with a persistent, 4-tab bottom navigation bar for the application's primary sections:

1.  **Articles:** The main article list view.
2.  **Feeds:** The list of feeds and folders for filtering.
3.  **Stats:** A new section for application statistics.
4.  **Settings:** A new section for application settings.

This change will apply to all form factors (mobile, tablet, desktop) to create a consistent user experience, simplifying the overall navigation architecture.

## Consequences

**Positive:**

- Significantly improves mobile user experience by making primary navigation constantly accessible.
- Aligns the application's look and feel with native iOS 26 design standards.
- Simplifies the overall layout by removing the need for a collapsible sidebar.
- Makes key sections like "Feeds" and "Stats" more discoverable.

**Negative:**

- Requires a major refactoring of the application's root layout and routing structure.
- Reduces the screen real estate available for content on mobile devices due to the persistent bottom bar.

**Neutral:**

- This decision establishes a clear architectural pattern for primary navigation going forward.
