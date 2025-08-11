"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft,
  Ellipsis,
  ExternalLink, 
  Share2,
  Star,
  BookOpen,
  Download,
  Sun,
  Moon
} from "lucide-react";
import { cn } from "@/lib/utils";

// Import the existing global styles
import "../../../app/globals.css";

type AnimationMode = "sequential" | "simultaneous";
type EasingMode = "smooth" | "spring";

export default function ArticleDropdownEnhancedPOC() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [isPartialFeed, setIsPartialFeed] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [animationMode, setAnimationMode] = useState<AnimationMode>("sequential");
  const [easingMode, setEasingMode] = useState<EasingMode>("smooth");
  
  const toolbarRef = useRef<HTMLDivElement>(null);
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
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        if (isDropdownOpen) {
          setIsDropdownOpen(false);
        }
      }
    };
    
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isDropdownOpen]);

  // Close dropdown on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDropdownOpen) {
        setIsDropdownOpen(false);
      }
    };
    
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDropdownOpen]);

  // Handle theme toggle
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
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

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getEasingFunction = () => {
    if (easingMode === "spring") {
      // Subtle spring with bounce = 0.15 as per iOS guidelines
      return "cubic-bezier(0.34, 1.56, 0.64, 1)";
    }
    // Smooth easeInOut for natural motion
    return "cubic-bezier(0.4, 0, 0.2, 1)";
  };

  const getAnimationDuration = () => {
    // iOS standard: 300ms for smooth transitions
    return animationMode === "sequential" ? "400ms" : "300ms";
  };

  const mockArticle = {
    title: "Understanding the New iOS 26 Liquid Glass Design System",
    feedTitle: "Apple Developer News",
    author: "Sarah Chen",
    publishedAt: "2 hours ago",
    tags: ["Design", "iOS", "Mobile"],
    content: `
      <p>Apple's latest iOS 26 introduces a revolutionary design language called "Liquid Glass" that fundamentally reimagines how we interact with mobile interfaces.</p>
      
      <h2>The Philosophy Behind Liquid Glass</h2>
      <p>At its core, Liquid Glass is about creating interfaces that feel alive and responsive. UI elements don't just appear and disappear; they morph, flow, and adapt to their context.</p>
      
      <h2>Material Properties</h2>
      <p>The glass effect in iOS 26 uses advanced backdrop filters with variable blur intensity that adapts based on the content beneath.</p>

      <h2>Implementation in Practice</h2>
      <p>When implementing Liquid Glass in your applications, consider performance, contextual adaptation, smooth transitions, and spatial consistency.</p>
      
      <h2>Accessibility Considerations</h2>
      <p>While Liquid Glass creates beautiful, engaging interfaces, accessibility must remain a top priority. Ensure contrast ratios, respect reduced motion preferences, provide transparency alternatives, and maintain proper touch targets.</p>

      <h2>Real-World Applications</h2>
      <p>Several Apple apps have already adopted Liquid Glass design principles including Messages, Control Center, and Photos.</p>

      <h2>Technical Implementation Details</h2>
      <p>For developers looking to implement Liquid Glass, use backdrop-filter CSS properties with proper fallbacks and spring physics for animations.</p>

      <h2>Performance Optimization</h2>
      <p>Glass effects can impact performance. Use GPU acceleration, apply effects selectively, optimize blur radius values, and consider caching for static content.</p>

      <h2>Conclusion</h2>
      <p>Liquid Glass represents a significant evolution in mobile interface design, setting a new standard for user experience through responsive, alive interfaces.</p>
    `
  };

  return (
    <div className={cn("min-h-screen bg-gray-50 dark:bg-gray-900", isDarkMode && "dark")}>
      {/* Header Bar with Controls */}
      <div className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Article Dropdown POC - Enhanced Liquid Glass
            </h1>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              aria-label="Toggle theme"
            >
              {isDarkMode ? (
                <Sun className="h-5 w-5 text-yellow-500" />
              ) : (
                <Moon className="h-5 w-5 text-gray-700" />
              )}
            </button>
          </div>
          
          {/* Animation Controls */}
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <label className="text-gray-600 dark:text-gray-400">Animation:</label>
              <button
                onClick={() => setAnimationMode("sequential")}
                className={cn(
                  "px-3 py-1 rounded",
                  animationMode === "sequential" 
                    ? "bg-blue-500 text-white" 
                    : "bg-gray-200 dark:bg-gray-700"
                )}
              >
                Sequential
              </button>
              <button
                onClick={() => setAnimationMode("simultaneous")}
                className={cn(
                  "px-3 py-1 rounded",
                  animationMode === "simultaneous" 
                    ? "bg-blue-500 text-white" 
                    : "bg-gray-200 dark:bg-gray-700"
                )}
              >
                Simultaneous
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-gray-600 dark:text-gray-400">Easing:</label>
              <button
                onClick={() => setEasingMode("smooth")}
                className={cn(
                  "px-3 py-1 rounded",
                  easingMode === "smooth" 
                    ? "bg-green-500 text-white" 
                    : "bg-gray-200 dark:bg-gray-700"
                )}
              >
                Smooth
              </button>
              <button
                onClick={() => setEasingMode("spring")}
                className={cn(
                  "px-3 py-1 rounded",
                  easingMode === "spring" 
                    ? "bg-green-500 text-white" 
                    : "bg-gray-200 dark:bg-gray-700"
                )}
              >
                Spring
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Display */}
      {selectedAction && (
        <div className="fixed top-32 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
            Action triggered: {selectedAction}
          </div>
        </div>
      )}

      {/* Article Detail View */}
      <div className="min-h-screen w-full overflow-x-hidden bg-white dark:bg-gray-900">
        {/* Floating controls container */}
        <div 
          ref={headerRef}
          className="fixed left-0 right-0 z-10 transition-transform duration-300 ease-in-out"
          style={{ 
            transform: headerVisible ? "translateY(0)" : "translateY(-100%)", 
            top: "140px" 
          }}
        >
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 flex items-start justify-between">
            {/* Back button - enhanced liquid glass */}
            <div className="pointer-events-auto">
              <button
                type="button"
                aria-label="Back to list"
                onClick={() => setSelectedAction("back")}
                style={{
                  // Enhanced glass effect matching toolbar
                  backdropFilter: 'blur(16px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                  background: isDarkMode 
                    ? 'rgba(10, 10, 10, 0.18)' 
                    : 'rgba(255, 255, 255, 0.18)',
                  border: isDarkMode
                    ? '1px solid rgba(255, 255, 255, 0.08)'
                    : '1px solid rgba(0, 0, 0, 0.04)',
                  boxShadow: isDarkMode
                    ? '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
                    : '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 160ms ease-out, background-color 160ms ease-out',
                  cursor: 'pointer',
                  // iOS touch optimizations
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDarkMode 
                    ? 'rgba(10, 10, 10, 0.25)' 
                    : 'rgba(255, 255, 255, 0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isDarkMode 
                    ? 'rgba(10, 10, 10, 0.18)' 
                    : 'rgba(255, 255, 255, 0.18)';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.98)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            </div>

            {/* Enhanced Actions toolbar with inline dropdown */}
            <div 
              ref={toolbarRef}
              className="pointer-events-auto overflow-hidden"
              style={{
                // Enhanced glass effect properties
                backdropFilter: 'blur(16px) saturate(180%)',
                WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                background: isDarkMode 
                  ? 'rgba(10, 10, 10, 0.18)' 
                  : 'rgba(255, 255, 255, 0.18)',
                border: isDarkMode
                  ? '1px solid rgba(255, 255, 255, 0.08)'
                  : '1px solid rgba(0, 0, 0, 0.04)',
                boxShadow: isDarkMode
                  ? '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
                  : '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
                // Keep consistent rounded corners
                borderRadius: '22px',
                // Size and layout - increased for better touch targets
                width: isDropdownOpen ? '220px' : 'auto',
                minHeight: '48px',
                padding: isDropdownOpen ? '8px' : '2px',
                position: 'relative',
                // Transform origin for expansion from top center
                transformOrigin: 'top center',
                // Smooth transitions for all properties
                transition: `width ${getAnimationDuration()} ${getEasingFunction()}, padding ${getAnimationDuration()} ${getEasingFunction()}`,
                // GPU acceleration
                transform: 'translateZ(0)',
                willChange: 'width, padding',
              }}
            >
              <div style={{ position: 'relative', minHeight: '44px' }}>
                {/* Toolbar buttons layer */}
                <div 
                  style={{
                    position: isDropdownOpen ? 'absolute' : 'static',
                    top: 0,
                    left: 0,
                    right: 0,
                    opacity: isDropdownOpen ? 0 : 1,
                    transform: isDropdownOpen 
                      ? (animationMode === 'sequential' ? 'translateX(-20px)' : 'scale(0.95)')
                      : 'translateX(0) scale(1)',
                    transition: animationMode === 'sequential'
                      ? `opacity 150ms ${getEasingFunction()}, transform 150ms ${getEasingFunction()}`
                      : `opacity ${getAnimationDuration()} ${getEasingFunction()}, transform ${getAnimationDuration()} ${getEasingFunction()}`,
                    pointerEvents: isDropdownOpen ? 'none' : 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    // GPU acceleration
                    willChange: 'opacity, transform',
                  }}
                >
                  <div className="toolbar-group" style={{ gap: '2px' }}>
                    <button 
                      onClick={() => {
                        setIsStarred(!isStarred);
                        setSelectedAction(isStarred ? "unstarred" : "starred");
                      }}
                      aria-label={isStarred ? "Unstar" : "Star"}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '48px',
                        height: '44px',
                        padding: '0 12px',
                        borderRadius: '22px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 160ms ease-out, transform 160ms ease-out',
                        // iOS touch optimizations
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation',
                        WebkitTouchCallout: 'none',
                        WebkitUserSelect: 'none',
                        userSelect: 'none',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isDarkMode 
                          ? 'rgba(255, 255, 255, 0.1)' 
                          : 'rgba(0, 0, 0, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                      onMouseDown={(e) => {
                        e.currentTarget.style.transform = 'scale(0.98)';
                      }}
                      onMouseUp={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <Star className={cn("h-5 w-5 text-muted-foreground", isStarred && "fill-yellow-500 text-yellow-500")} />
                      <span className="ml-2 hidden md:inline text-sm">
                        {isStarred ? "Unstar" : "Star"}
                      </span>
                    </button>
                    <button 
                      onClick={() => setSelectedAction("summary")}
                      aria-label="Summarize"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '48px',
                        height: '44px',
                        padding: '0 12px',
                        borderRadius: '22px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 160ms ease-out, transform 160ms ease-out',
                        // iOS touch optimizations
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation',
                        WebkitTouchCallout: 'none',
                        WebkitUserSelect: 'none',
                        userSelect: 'none',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isDarkMode 
                          ? 'rgba(255, 255, 255, 0.1)' 
                          : 'rgba(0, 0, 0, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                      onMouseDown={(e) => {
                        e.currentTarget.style.transform = 'scale(0.98)';
                      }}
                      onMouseUp={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <BookOpen className="h-5 w-5 text-muted-foreground" />
                      <span className="ml-2 hidden md:inline text-sm">
                        Summarize
                      </span>
                    </button>
                    <button 
                      onClick={() => setSelectedAction("fetch-content")}
                      aria-label="Fetch"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '48px',
                        height: '44px',
                        padding: '0 12px',
                        borderRadius: '22px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 160ms ease-out, transform 160ms ease-out',
                        // iOS touch optimizations
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation',
                        WebkitTouchCallout: 'none',
                        WebkitUserSelect: 'none',
                        userSelect: 'none',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isDarkMode 
                          ? 'rgba(255, 255, 255, 0.1)' 
                          : 'rgba(0, 0, 0, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                      onMouseDown={(e) => {
                        e.currentTarget.style.transform = 'scale(0.98)';
                      }}
                      onMouseUp={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <Download className="h-5 w-5 text-muted-foreground" />
                      <span className="ml-2 hidden md:inline text-sm">
                        Fetch
                      </span>
                    </button>
                  </div>
                  
                  {/* More button */}
                  <button 
                    aria-label="More options"
                    onClick={() => setIsDropdownOpen(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '48px',
                      height: '44px',
                      padding: '0',
                      borderRadius: '22px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background 160ms ease-out, transform 160ms ease-out',
                      // iOS touch optimizations
                      WebkitTapHighlightColor: 'transparent',
                      touchAction: 'manipulation',
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      userSelect: 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isDarkMode 
                        ? 'rgba(255, 255, 255, 0.1)' 
                        : 'rgba(0, 0, 0, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.transform = 'scale(0.98)';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    <Ellipsis className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>

                {/* Dropdown layer */}
                <div 
                  style={{
                    position: isDropdownOpen ? 'static' : 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    opacity: isDropdownOpen ? 1 : 0,
                    transform: isDropdownOpen 
                      ? 'translateY(0) scale(1)'
                      : 'translateY(-10px) scale(0.95)',
                    transformOrigin: 'top center',
                    transition: animationMode === 'sequential'
                      ? `opacity 200ms ${getEasingFunction()} ${isDropdownOpen ? '150ms' : '0ms'}, transform 200ms ${getEasingFunction()} ${isDropdownOpen ? '150ms' : '0ms'}`
                      : `opacity ${getAnimationDuration()} ${getEasingFunction()}, transform ${getAnimationDuration()} ${getEasingFunction()}`,
                    pointerEvents: isDropdownOpen ? 'auto' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '0',
                    // GPU acceleration
                    willChange: 'opacity, transform',
                  }}
                >
                  {/* Dropdown items with enhanced glass styling */}
                  <div className="space-y-1">
                    <button
                      onClick={() => handleActionClick("partial-feed")}
                      className="flex w-full items-center rounded-md px-3 py-2 text-sm transition-all text-left"
                      style={{
                        background: 'transparent',
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isDarkMode 
                          ? 'rgba(255, 255, 255, 0.08)' 
                          : 'rgba(0, 0, 0, 0.04)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span className="mr-2 text-base">
                        {isPartialFeed ? "☑" : "☐"}
                      </span>
                      <span>Partial Feed</span>
                    </button>
                    
                    <div 
                      className="h-px"
                      style={{
                        background: isDarkMode 
                          ? 'rgba(255, 255, 255, 0.06)' 
                          : 'rgba(0, 0, 0, 0.06)',
                      }}
                    />
                    
                    <button
                      onClick={() => handleActionClick("share")}
                      className="flex w-full items-center rounded-md px-3 py-2 text-sm transition-all text-left"
                      style={{
                        background: 'transparent',
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isDarkMode 
                          ? 'rgba(255, 255, 255, 0.08)' 
                          : 'rgba(0, 0, 0, 0.04)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <Share2 className="mr-2 h-4 w-4" />
                      Share
                    </button>
                    
                    <button
                      onClick={() => handleActionClick("open-original")}
                      className="flex w-full items-center rounded-md px-3 py-2 text-sm transition-all text-left"
                      style={{
                        background: 'transparent',
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = isDarkMode 
                          ? 'rgba(255, 255, 255, 0.08)' 
                          : 'rgba(0, 0, 0, 0.04)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Original
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Spacer for fixed header */}
        <div className="h-[200px]" />

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

          {/* Article Body */}
          <div 
            className="prose prose-gray max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: mockArticle.content }}
          />
        </article>
      </div>
    </div>
  );
}