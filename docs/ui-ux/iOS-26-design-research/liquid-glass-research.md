# Apple’s Liquid Glass Design System

**Liquid Glass replaces the old “frosted-blur” look with a, translucent material that bends light in real time.** It now governs navigation bars, toolbars, sidebars, sheets, and floating controls across iOS 26, iPadOS 26, macOS Tahoe, watchOS 26, and tvOS 26. Apple’s Human Interface Guidelines (HIG) were rewritten on June 9 2025 to document the material, updated icon grids, and revised button shapes.

## 1. Core Principles of Liquid Glass

| Principle    | What it means                                                                                         | Design cues                                     |
| ------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Lensing      | Material refracts & tints whatever scrolls underneath, providing depth while keeping content readable | Dynamic highlights, adaptive shadows            |
| Variants     | Regular (default) vs. Clear (extra-transparent). Never mix them in the same context                   | Regular for most UI; Clear for minimal overlays |
| Hierarchy    | Navigation & controls float _above_ content, never inside it                                          | Keep primary content fully opaque               |
| Shape system | UI now uses Fixed, Capsule, and Concentric radii for concentric nesting across devices                | Buttons default to capsules on touch surfaces   |

Apple explicitly warns against turning everything into glass; only overlay-level elements should adopt it.

## 2. System-Wide Visual Updates

1. **System colors** retuned for better hue separation in both Light and Dark appearances.
2. **Typography**: bolder weights and left-aligned copy in key moments (alerts, onboarding) for readability.
3. **Larger padding & corner radii** in lists/forms for more breathing room and visual rhythm.

## 3. New App-Icon Guidelines

| Aspect  | Old icons         | Liquid Glass icons                                                                  |
| ------- | ----------------- | ----------------------------------------------------------------------------------- |
| Grid    | Platform-specific | Unified 1024 × 1024 grid with rounder radii                                         |
| Layers  | Flattened artwork | Up to 4 interactive layers rendered in real time (light, dark, clear, tinted modes) |
| Tooling | Static asset sets | **Icon Composer** generates a single _.icon_ file for all platforms & modes         |

Design tips:

- Embrace **simple vector geometry**; Icon Composer adds depth, frost, and specular highlights for you.
- Avoid cramming detail into edges—the system applies an unavoidable glass rim.
- Export individual layers (SVG/PNG) and limit to four to avoid performance warnings.

## 4. Button & Control Updates

1. **Capsule default**: Icon-only buttons are circular; text or mixed buttons use capsules or concentric shapes for edge harmony.
2. **glassEffect & glass ButtonStyle** in SwiftUI automatically give buttons responsive Liquid Glass, including “lift” on press.
3. **GlassEffectContainer** lets clustered buttons merge like liquid blobs for fab-style menus.
4. **Size classes**: macOS gains new _X-Large_ pill buttons for spacious layouts; iOS still encourages standard size guidance.
5. **Don’t stack glass on glass**—place non-glass overlays (icons, glyphs) atop a single glass layer to avoid muddiness.

## 5. Implementing in a Tailwind + React PWA

Apple’s fluid shaders are native, but you can approximate the aesthetic with progressive enhancement:

Step 1 – Structure

- Keep navigation bars, tab bars, modals, and floating action buttons in a dedicated overlay layer (`z-10`).
- Use CSS `backdrop-filter: blur(24px) saturate(180%)` and `background-color: rgba(255,255,255,0.28)` (Regular) or `rgba(255,255,255,0.16)` (Clear).
- Apply `supports(backdrop-filter)` checks to fall back to solid colors on browsers that lack the property (many Android WebViews).

Step 2 – Shapes

- Create Tailwind utilities for `.rounded-[theme.radius.capsule]` (half height) and `.rounded-[theme.radius.concentric]` (use `calc(1rem + 50%)` patterns).
- Maintain minimum 44 × 44 pt hit targets for touch.

Step 3 – Icon Layers

- Export four 512 × 512 PNG layers, stack them in a React component, and animate `opacity` or small `transform` tilts on pointer-move to fake parallax.
- Supply fully flat PNG fallback for Android.

Step 4 – Accessibility

- Offer a _Reduce-transparency_ toggle (`prefers-contrast: more` / `prefers-reduced-transparency: reduce`) that swaps glass backdrops to opaque colors.
- Verify text contrast ratios as lensing can swing background luminance quickly.

## 6. Where to Find the Official Docs & Videos

- Adopting Liquid Glass overview (Technology Overviews)
- HIG → Materials, Icons, Buttons, Layout sections (updated June 9 2025)
- WWDC 25 sessions:
  – _Meet Liquid Glass_ (219) for physics & variants
  – _Get to Know the New Design System_ (356) for shapes & typography
  – _Say Hello to the New Look of App Icons_ (220) for grid & layering
  – _Create Icons with Icon Composer_ (361) for tool workflow

## 7. Quick Checklist for Your PWA

- [ ] Overlay elements use backdrop-filter blur + translucency.
- [ ] Navigation bars / tab bars float; main content stays opaque.
- [ ] Capsule radii and 44 pt hit targets respected.
- [ ] Glass effects disabled when `prefers-reduced-transparency`.
- [ ] Layered app icon delivered as single file (or flattened fallback).
- [ ] Avoid mixing Regular & Clear glass in one view.
- [ ] No more than one glass layer per stacked element.

### Key Takeaways

Liquid Glass aims to unify Apple’s UI by treating navigation and controls as light-bending glass panes that sit above content. Adopt it selectively, respect the new capsule/concentric shapes, and switch icons to the layered format generated with Icon Composer. In a web context, approximate with modern CSS filters, but always offer opaque fallbacks for performance, accessibility, and cross-platform consistency.
