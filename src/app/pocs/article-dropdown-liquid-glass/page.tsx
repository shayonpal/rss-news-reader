"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Ellipsis,
  ExternalLink,
  Share2,
  BarChart3,
  Star,
  BookOpen,
  Download,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Import the existing global styles
import "../../../app/globals.css";

export default function ArticleDropdownLiquidGlassPOC() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [isPartialFeed, setIsPartialFeed] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  const handleActionClick = (action: string) => {
    setSelectedAction(action);
    setIsDropdownOpen(false);

    // Clear the selection after showing feedback
    setTimeout(() => setSelectedAction(null), 2000);

    // Handle Partial Feed toggle
    if (action === "partial-feed") {
      setIsPartialFeed(!isPartialFeed);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isDropdownOpen]);

  // Close dropdown on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isDropdownOpen]);

  // Handle theme toggle
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Handle scroll to show/hide header
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Hide header when scrolling down, show when scrolling up
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setHeaderVisible(false);
      } else {
        setHeaderVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const mockArticle = {
    title: "Understanding the New iOS 26 Liquid Glass Design System",
    feedTitle: "Apple Developer News",
    author: "Sarah Chen",
    publishedAt: "2 hours ago",
    tags: ["Design", "iOS", "Mobile"],
    content: `
      <p>Apple's latest iOS 26 introduces a revolutionary design language called "Liquid Glass" that fundamentally reimagines how we interact with mobile interfaces. This isn't just a visual refresh – it's a complete rethinking of user interaction paradigms.</p>
      
      <h2>The Philosophy Behind Liquid Glass</h2>
      <p>At its core, Liquid Glass is about creating interfaces that feel alive and responsive. UI elements don't just appear and disappear; they morph, flow, and adapt to their context. The design language draws inspiration from physical materials while maintaining the flexibility only possible in digital spaces.</p>
      
      <p>The key innovation is the concept of "morphing interactions" where buttons transform into their resulting UI rather than triggering separate components. This maintains spatial continuity and helps users understand the relationship between actions and outcomes.</p>
      
      <h2>Material Properties</h2>
      <p>The glass effect in iOS 26 uses advanced backdrop filters with variable blur intensity that adapts based on the content beneath. This creates a sense of depth and layering that feels natural without being overwhelming.</p>
      
      <p>Context-aware adaptation means that materials dynamically adjust their properties. Glass opacity increases over complex backgrounds, blur intensity adapts to content movement, and colors shift based on underlying content – all in real-time.</p>

      <h2>Implementation in Practice</h2>
      <p>When implementing Liquid Glass in your applications, consider the following key aspects:</p>
      
      <ul>
        <li><strong>Performance First:</strong> Glass effects can be computationally expensive. Always test on lower-end devices and provide fallbacks for reduced transparency settings.</li>
        <li><strong>Contextual Adaptation:</strong> The glass material should respond to its environment. Over busy backgrounds, increase opacity slightly to maintain readability.</li>
        <li><strong>Smooth Transitions:</strong> All state changes should use spring animations with carefully tuned parameters to feel natural and responsive.</li>
        <li><strong>Spatial Consistency:</strong> Elements should maintain their spatial relationships during transitions. Users should never lose track of where UI elements came from or where they're going.</li>
      </ul>

      <h2>Accessibility Considerations</h2>
      <p>While Liquid Glass creates beautiful, engaging interfaces, accessibility must remain a top priority:</p>
      
      <ul>
        <li><strong>Contrast Ratios:</strong> Ensure all text meets WCAG AA standards (4.5:1 for normal text, 3:1 for large text) even with glass effects applied.</li>
        <li><strong>Reduced Motion:</strong> Respect the user's motion preferences. When reduced motion is enabled, replace morphing animations with simple fades.</li>
        <li><strong>Reduced Transparency:</strong> Provide opaque alternatives when users have enabled reduced transparency in their system settings.</li>
        <li><strong>Touch Targets:</strong> Maintain minimum 44x44pt touch targets for all interactive elements, even during animations.</li>
      </ul>

      <h2>Real-World Applications</h2>
      <p>Several Apple apps have already adopted Liquid Glass design principles:</p>
      
      <h3>Messages</h3>
      <p>The Messages app showcases morphing interactions beautifully. When you tap the compose button, it doesn't just open a new screen – it expands from the button itself, maintaining spatial continuity. The message bubbles use subtle glass effects that adapt based on the wallpaper behind them.</p>
      
      <h3>Control Center</h3>
      <p>Control Center is perhaps the best example of Liquid Glass in action. Controls morph and expand when activated, sliders feel physical and responsive, and the entire interface adapts its blur and opacity based on what's behind it.</p>
      
      <h3>Photos</h3>
      <p>The Photos app uses Liquid Glass for its selection interface. When you select photos, they don't just get a checkmark – they subtly morph to indicate selection, with the glass overlay adapting to each photo's colors.</p>

      <h2>Technical Implementation Details</h2>
      <p>For developers looking to implement Liquid Glass in their own applications, here are the key technical considerations:</p>
      
      <h3>CSS Implementation</h3>
      <pre><code>
.glass-surface {
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: all 320ms cubic-bezier(0.2, 0, 0.2, 1);
}

@supports not (backdrop-filter: blur(14px)) {
  .glass-surface {
    background: rgba(255, 255, 255, 0.95);
  }
}
      </code></pre>
      
      <h3>JavaScript Animations</h3>
      <p>Use spring physics for natural-feeling animations:</p>
      
      <pre><code>
const spring = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 0.8
};

element.animate({
  transform: ["scale(1)", "scale(1.05)", "scale(1)"],
  opacity: [0, 1]
}, {
  duration: 320,
  easing: "cubic-bezier(0.2, 0, 0.2, 1)"
});
      </code></pre>

      <h2>Performance Optimization</h2>
      <p>Glass effects can impact performance, especially on older devices. Here are strategies to maintain 60fps:</p>
      
      <ul>
        <li><strong>GPU Acceleration:</strong> Use <code>transform: translateZ(0)</code> or <code>will-change</code> to force GPU acceleration.</li>
        <li><strong>Selective Application:</strong> Don't apply glass effects to every element. Reserve them for key UI components.</li>
        <li><strong>Blur Radius:</strong> Lower blur values (10-14px) perform better than higher values while still looking good.</li>
        <li><strong>Caching:</strong> For static content behind glass, consider using cached renders to reduce repainting.</li>
      </ul>

      <h2>Common Pitfalls to Avoid</h2>
      <p>When implementing Liquid Glass, watch out for these common mistakes:</p>
      
      <ol>
        <li><strong>Overuse:</strong> Not every element needs glass effects. Use them strategically for navigation and key controls.</li>
        <li><strong>Inconsistent Timing:</strong> All animations should use consistent timing functions. Stick to the standard 320ms duration with ease-out curves.</li>
        <li><strong>Ignoring Context:</strong> Glass effects should adapt to their surroundings. A fixed opacity value won't work for all backgrounds.</li>
        <li><strong>Forgetting Fallbacks:</strong> Always provide fallbacks for browsers that don't support backdrop-filter.</li>
        <li><strong>Poor Contrast:</strong> Glass effects can reduce contrast. Always test readability with different content behind the glass.</li>
      </ol>

      <h2>Future Directions</h2>
      <p>Apple has hinted at several upcoming enhancements to Liquid Glass:</p>
      
      <h3>Adaptive Blur</h3>
      <p>Future versions will feature adaptive blur that changes intensity based on scroll velocity and content complexity. This will make interfaces feel even more responsive and alive.</p>
      
      <h3>Haptic Integration</h3>
      <p>Deeper integration with the Taptic Engine will make glass surfaces feel physical. Different materials will have different haptic signatures.</p>
      
      <h3>Machine Learning Enhancement</h3>
      <p>ML models will predict user intentions and pre-morph UI elements for instantaneous response times.</p>

      <h2>Conclusion</h2>
      <p>Liquid Glass represents a significant evolution in mobile interface design. By creating interfaces that feel alive and responsive, Apple has set a new standard for user experience. While implementation requires careful attention to performance and accessibility, the results create truly magical user experiences that feel years ahead of traditional flat design.</p>
      
      <p>As developers and designers, we have the opportunity to embrace these principles and create applications that don't just function well, but feel incredible to use. The key is to start small – implement glass effects on a few key components, perfect the animations, and gradually expand from there.</p>
      
      <p>Remember: great design is invisible when done right. Users shouldn't notice the glass effects explicitly; they should simply feel that the interface is more responsive, more alive, and more delightful to use.</p>
    `,
  };

  return (
    <div
      className={cn(
        "min-h-screen bg-gray-50 dark:bg-gray-900",
        isDarkMode && "dark"
      )}
    >
      {/* Header Bar */}
      <div className="sticky top-0 z-50 border-b border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-4xl">
          <div className="mb-2 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Article Dropdown POC - Current Implementation
            </h1>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="rounded-lg bg-gray-200 p-2 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
              aria-label="Toggle theme"
            >
              {isDarkMode ? (
                <Sun className="h-5 w-5 text-yellow-500" />
              ) : (
                <Moon className="h-5 w-5 text-gray-700" />
              )}
            </button>
          </div>
          <div className="text-sm">
            <a
              href="/reader/pocs/article-dropdown-liquid-glass/enhanced"
              className="text-blue-500 underline hover:text-blue-600"
            >
              → View Enhanced Liquid Glass Version
            </a>
          </div>
        </div>
      </div>

      {/* Feedback Display */}
      {selectedAction && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 transform">
          <div className="rounded-lg bg-green-500 px-4 py-2 text-white shadow-lg">
            Action triggered: {selectedAction}
          </div>
        </div>
      )}

      {/* Article Detail View - Exact Implementation */}
      <div className="min-h-screen w-full overflow-x-hidden bg-white dark:bg-gray-900">
        {/* Floating controls container - with scroll hide/show behavior */}
        <div
          ref={headerRef}
          className="article-header-controls fixed left-0 right-0 z-10 transition-transform duration-300 ease-in-out"
          style={{
            transform: headerVisible ? "translateY(0)" : "translateY(-100%)",
            top: "80px",
          }}
        >
          <div className="mx-auto flex w-full max-w-4xl items-start justify-between px-4 sm:px-6 lg:px-8">
            {/* Back button - using exact glass-icon-btn class */}
            <div className="pointer-events-auto">
              <button
                type="button"
                aria-label="Back to list"
                className="glass-icon-btn"
                onClick={() => setSelectedAction("back")}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            </div>

            {/* Actions toolbar - using exact glass-toolbar class */}
            <div
              className={cn(
                "glass-toolbar pointer-events-auto",
                isDropdownOpen && "menu-open"
              )}
            >
              <div className="toolbar-group">
                <button
                  className="glass-toolbar-btn"
                  onClick={() => {
                    setIsStarred(!isStarred);
                    setSelectedAction(isStarred ? "unstarred" : "starred");
                  }}
                  aria-label={isStarred ? "Unstar" : "Star"}
                  title={isStarred ? "Unstar" : "Star"}
                >
                  <Star
                    className={cn(
                      "h-5 w-5",
                      isStarred && "fill-yellow-500 text-yellow-500"
                    )}
                  />
                  <span className="ml-2 hidden text-sm md:inline">
                    {isStarred ? "Unstar" : "Star"}
                  </span>
                </button>
                <button
                  className="glass-toolbar-btn"
                  onClick={() => setSelectedAction("summary")}
                  aria-label="Summarize"
                  title="Summarize"
                >
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                  <span className="ml-2 hidden text-sm md:inline">
                    Summarize
                  </span>
                </button>
                <button
                  className="glass-toolbar-btn"
                  onClick={() => setSelectedAction("fetch-content")}
                  aria-label="Fetch"
                  title="Fetch"
                >
                  <Download className="h-5 w-5 text-muted-foreground" />
                  <span className="ml-2 hidden text-sm md:inline">Fetch</span>
                </button>
              </div>

              {/* Dropdown trigger - exact implementation */}
              <button
                ref={triggerRef}
                className="glass-toolbar-btn"
                aria-label="More options"
                aria-expanded={isDropdownOpen}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <Ellipsis className="h-5 w-5 text-muted-foreground" />
              </button>

              {/* Dropdown Content - using exact glass-popover class */}
              {isDropdownOpen && (
                <div
                  ref={dropdownRef}
                  className="glass-popover absolute right-0 top-full mt-2 w-64 p-2"
                  role="menu"
                >
                  {/* Partial Feed Option */}
                  <button
                    onClick={() => handleActionClick("partial-feed")}
                    className="relative flex w-full items-center rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-accent/20 focus:bg-accent/20"
                    role="menuitem"
                  >
                    <span className="mr-2 text-base transition-opacity duration-200">
                      {isPartialFeed ? "☑" : "☐"}
                    </span>
                    <span className="transition-opacity duration-200">
                      Partial Feed
                    </span>
                  </button>

                  <div className="menu-separator my-1" />

                  {/* Share */}
                  <button
                    onClick={() => handleActionClick("share")}
                    className="relative flex w-full items-center rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-accent/20 focus:bg-accent/20"
                    role="menuitem"
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </button>

                  {/* Open Original */}
                  <button
                    onClick={() => handleActionClick("open-original")}
                    className="relative flex w-full items-center rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-accent/20 focus:bg-accent/20"
                    role="menuitem"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Original
                  </button>

                  <div className="menu-separator my-1" />

                  {/* Fetch Stats */}
                  <button
                    onClick={() => handleActionClick("fetch-stats")}
                    className="relative flex w-full items-center rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-accent/20 focus:bg-accent/20"
                    role="menuitem"
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Fetch Stats
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Spacer for fixed header */}
        <div className="h-[140px]" />

        {/* Article Content */}
        <article className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {/* Metadata */}
          <div className="mb-6 sm:mb-8">
            <h1 className="mb-3 text-2xl font-bold leading-tight text-gray-900 dark:text-gray-100 sm:mb-4 sm:text-3xl md:text-4xl">
              {mockArticle.title}
            </h1>

            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">{mockArticle.feedTitle}</span>
              <span>•</span>
              <span>{mockArticle.author}</span>
              <span>•</span>
              <time>{mockArticle.publishedAt}</time>
            </div>

            {/* Tags */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {mockArticle.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Article Body - Now with much longer content */}
          <div
            className="prose prose-gray max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: mockArticle.content }}
          />
        </article>
      </div>
    </div>
  );
}
