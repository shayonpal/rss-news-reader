## 1. Tab Bars

**Guideline summary:**

- Tab bars anchor to the **bottom** of the screen and provide quick access to primary app areas.
- **Icon + label** for each tab, with clear, active-state feedback.
- Use **no more than five** primary destinations.
- Provide **persistent navigation**—the bar is always visible except when modals are open.

**How to adapt:**

- If not already present, introduce a **tab bar** at the bottom for main sections (e.g., Articles, Feeds, Starred, Settings).
- Use Apple’s capsule/rounded rect icon style with readable, multi-density SVGs or the new layered _.icon_ files for maximum fidelity.
- Remove redundant hamburger navigation for top-level sections—that goes into tab bar for iPhone-sized screens.
- Text labels must always show (no icons-only).
- Active tab gets a bolder highlight and “lifted” appearance via subtle shadow/elevation, matching the new Liquid Glass material (use `.glass-regular` with capsule shapes).
- Use system SF Symbols for max legibility, or design your own using the icon layering system.

## 2. Sidebars

**Guideline summary:**

- On iPad and large iPhones (landscape or Plus/Ultra sizes), use a **sidebar** along the left to show feeds/folders and provide multi-level navigation.
- Sidebars float above a glass or blurred background, can be revealed/hidden, and never obscure top/bottom navigation.
- Primary-level sidebar items have large, touch-friendly targets.
- Don’t mix sidebar primary navigation with tab bar—pick one based on device size (sidebar for wide screens, tab bar for compact).

**How to adapt:**

- For iPad/tablet layouts, introduce a **sidebar** using Apple’s updated shape and blur guidance (apply `.glass-regular` for the background, keep feed list items opaque for readability).
- Sidebar should be collapsible/expandable. Use the compact pill styling for feed counters.
- The selected feed or folder row should float (slight glass/clear capsule highlight).
- Move lower-level navigation (e.g., All Articles, Starred, Folders) here when on iPad/landscape.
- On iPhone, default to tab bar for main navigation, revealing the sidebar as a modal sheet if needed.

## 3. Path Controls

**Guideline summary:**

- Path controls show the user’s **current position in a hierarchy**, visualize drill-down structure, and support direct navigation up or down.
- Follow Apple’s “glass pane” material, with clear, rounded backgrounds and strong contrast for the current node.
- Respect minimum target sizes and provide clear separation between path elements.
- Can be horizontal (typical) or vertical (less common), expanding/collapsing as needed.

**How to adapt:**

- For workflows with folders or hierarchical navigation (e.g., Smart Folders, nested feeds), add a **path control** just below the navigation bar or sidebar header.
- Implement with horizontal chips/capsules: each segment as a touchable glass capsule, with the current level bolder.
- Use translucent glass materials—default to `.glass-clear` for the background.
- Path elements must be large enough for finger-tapping, separated by chevrons or slashes.
- Support direct jumps up the hierarchy by tapping parent path segments.
- Collapse/expand long paths on small screens for space efficiency (Apple’s guidance).

## 4. Practical UI Refactoring Steps (Based on Your Screenshots)

- **Tab bar:** Anchor a liquid-glass (translucent) tab bar to the bottom for iPhone, moving main sections here.
- **Sidebar:** On iPad, always display a sidebar for feed categories—make it a glass-backed panel with sticky, large-hit feed rows. Keep article list/content to the right.
- **Navigation bar:** Float as a glass panel at the top (adopt Liquid Glass system: medium-strength blur, capsule/cornered search and action buttons).
- **Path control:** Where users traverse nested folders/tags, display a path control below the nav bar/header using clear glass, rounded capsules.
- **Feed and article actions:** All action buttons should use the new capsule or concentric radius shape.
- **Motion:** Animate tab and sidebar transitions with gentle scaling and fade, matching iOS 26.

## 5. Accessibility and Touch

- Tab bar and sidebar items: **minimum 44×44pt** hit area.
- Ensure path controls are large, with at least 8pt visual separation.
- All glass overlays must preserve **high contrast** and fallback to opaque backgrounds with `prefers-reduced-transparency` or if `backdrop-filter` is unsupported.

**Summary Table for Each Navigation Type:**

| UI Region    | iPhone (portrait)          | iPad/Large              |
| ------------ | -------------------------- | ----------------------- |
| Tab bar      | Always visible at bottom   | Optional, sidebar > tab |
| Sidebar      | Modal/drawer (optional)    | Persistent on left      |
| Path control | Under nav bar, collapsible | Under sidebar header    |

**Next steps:**

- Restructure main navigation for tab/side-bar split based on device class.
- Use glass-morphing backgrounds for all navigation overlays.
- Replace static icon assets with layered formats for tab/side bar items.
- Add horizontal path chips for hierarchical structures.

## Recommended iPhone Tab Bar Navigation Items for Your RSS Reader

Based on your app’s feature set and current UX, and following Apple’s guidelines for bottom tab navigation, here are navigation items to anchor in the bottom bar:

### Primary Sections for Your Tab Bar

| Tab                 | Icon Suggestion | Function                                       |
| ------------------- | --------------- | ---------------------------------------------- |
| All Articles        | List/Doc        | Master feed of all items aggregated            |
| Feeds               | Folder/Stack    | Browse feeds or folders (user’s subscriptions) |
| Starred/Saved       | Star/Bookmark   | Starred/Bookmarked articles                    |
| Settings/Stats/Logs | Chart           | Self-explanatory                               |

#### Typical Implementation

- **All Articles:** Main reading area (default on open).
- **Feeds:** Shows user’s own feed subscriptions, possibly with categories or folders.
- **Starred/Saved:** For important or later reading content.
- **Settings/Stats/Logs**

_Most RSS/new reader apps on iPhone use 3–5 tabs to avoid overcrowding and ensure each section is peer-level and instantly accessible. If your app’s complexity grows, surfaced options like “More” can be added, but clarity is lost past five tabs._

### Additional Notes

- **Icons:** Use Apple’s SF Symbols or your own layered icons for visual clarity.
- **Badges:** Show unread counts as small badge overlays on applicable tabs.
- **Navigation Rules:** Never use the bottom tab bar for one-off actions—tabs should always switch to a different section of the app.
- **Always Keep Tabs Visible:** The tab bar remains visible when drilling deeper into content unless a modal is presented.

This ensures your app feels native, fast, and predictable, and aligns with Apple’s best practices for mobile navigation.
