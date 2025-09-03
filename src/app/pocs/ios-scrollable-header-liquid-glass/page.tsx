"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, Menu, Search, Filter, RefreshCw } from "lucide-react";

// Types for header states
type ScrollState = "expanded" | "transitioning" | "collapsed";

interface Article {
  id: string;
  title: string;
  source: string;
  time: string;
  summary: string;
  isRead?: boolean;
}

// Custom hook for iOS-style scroll behavior
const useIOSHeaderScroll = () => {
  const [scrollState, setScrollState] = useState<ScrollState>("expanded");
  const [scrollY, setScrollY] = useState(0);
  const [isScrollingUp, setIsScrollingUp] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const updateScrollState = useCallback(() => {
    const currentScrollY = window.scrollY;

    // Determine scroll direction
    const scrollingUp = currentScrollY < lastScrollY.current;
    setIsScrollingUp(scrollingUp);

    // Update scroll state based on position
    if (currentScrollY <= 44) {
      setScrollState("expanded");
    } else if (currentScrollY > 44 && currentScrollY <= 150) {
      setScrollState("transitioning");
    } else {
      setScrollState("collapsed");
    }

    setScrollY(currentScrollY);
    lastScrollY.current = currentScrollY;
    ticking.current = false;
  }, []);

  const handleScroll = useCallback(() => {
    if (!ticking.current) {
      window.requestAnimationFrame(updateScrollState);
      ticking.current = true;
    }
  }, [updateScrollState]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return { scrollState, scrollY, isScrollingUp };
};

export default function IOSScrollableHeaderPOC() {
  const { scrollState, scrollY } = useIOSHeaderScroll();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calculate dynamic values based on scroll
  const titleScale = Math.max(0.5, 1 - scrollY / 300);
  const titleOpacity = Math.max(0.7, 1 - scrollY / 200);
  const headerHeight = Math.max(54, 120 - scrollY * 0.4);
  const blurIntensity = Math.min(16, 8 + scrollY / 20);

  // Mock articles data
  const [articles] = useState<Article[]>([
    {
      id: "1",
      title: "Apple Unveils iOS 26 with Revolutionary Liquid Glass Design",
      source: "TechCrunch",
      time: "2 hours ago",
      summary:
        "Apple has announced iOS 26, featuring a complete design overhaul with the new Liquid Glass design language...",
    },
    {
      id: "2",
      title: "Understanding the New ScrollView APIs in SwiftUI 6",
      source: "Swift by Sundell",
      time: "5 hours ago",
      summary:
        "A deep dive into the new ScrollView APIs introduced in SwiftUI 6, including advanced scroll position tracking...",
    },
    {
      id: "3",
      title: "The Future of Mobile Design: Glass Morphism Returns",
      source: "Smashing Magazine",
      time: "1 day ago",
      summary:
        "Glass morphism is making a comeback with improved performance and accessibility features...",
    },
    {
      id: "4",
      title: "Performance Optimization for Backdrop Filters",
      source: "Web.dev",
      time: "2 days ago",
      summary:
        "Learn how to optimize backdrop-filter performance for smooth 60fps scrolling on mobile devices...",
    },
    {
      id: "5",
      title: "Building Native-Feel Web Apps with Modern CSS",
      source: "CSS-Tricks",
      time: "3 days ago",
      summary:
        "Explore techniques for creating web apps that feel as smooth and responsive as native applications...",
    },
    // Add more articles for scrolling
    ...Array.from({ length: 15 }, (_, i) => ({
      id: `${i + 6}`,
      title: `Article ${i + 6}: Lorem ipsum dolor sit amet`,
      source: "Various Sources",
      time: `${i + 4} days ago`,
      summary:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua...",
    })),
  ]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* POC Header - REQUIRED */}
      <div className="fixed left-0 right-0 top-0 z-[100] bg-gradient-to-b from-blue-600 to-purple-600 p-4 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="text-lg font-bold">
            🧪 iOS Scrollable Header Liquid Glass POC
          </div>
        </div>
      </div>

      {/* POC Purpose Section - REQUIRED */}
      <div className="px-4 pb-4 pt-24">
        <div className="mx-auto max-w-6xl">
          <details className="mb-6 rounded-lg bg-white shadow-sm dark:bg-gray-800">
            <summary className="cursor-pointer p-4 font-semibold text-gray-900 dark:text-gray-100">
              📋 POC Purpose & Goals
            </summary>
            <div className="space-y-4 px-4 pb-4">
              <div className="text-gray-700 dark:text-gray-300">
                <h3 className="mb-2 font-semibold">Purpose:</h3>
                <p>
                  Implement iOS 26 Liquid Glass design with a native iOS-style
                  scrollable header for the article listing page, similar to
                  Apple News and Mail apps.
                </p>
              </div>

              <div className="text-gray-700 dark:text-gray-300">
                <h3 className="mb-2 font-semibold">Key Features:</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>Large title that scales down on scroll (34px → 17px)</li>
                  <li>Morphing navigation button (hamburger → back)</li>
                  <li>Glass effect with dynamic blur intensity</li>
                  <li>Spring physics animations (0.35s cubic-bezier)</li>
                  <li>
                    Scroll state management with three states: expanded,
                    transitioning, collapsed
                  </li>
                </ul>
              </div>

              <div className="text-gray-700 dark:text-gray-300">
                <h3 className="mb-2 font-semibold">Technical Decisions:</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>
                    Using requestAnimationFrame for smooth scroll tracking
                  </li>
                  <li>
                    CSS transforms for performance over top/height changes
                  </li>
                  <li>Backdrop-filter with fallback for older devices</li>
                  <li>44px minimum touch targets for accessibility</li>
                </ul>
              </div>

              <div className="text-gray-700 dark:text-gray-300">
                <h3 className="mb-2 font-semibold">Related Linear Issue:</h3>
                <p className="text-blue-600 dark:text-blue-400">
                  RR-215: POC: iOS 26 Liquid Glass Scrollable Header for Article
                  Listing
                </p>
              </div>
            </div>
          </details>
        </div>
      </div>

      {/* iOS-Style Scrollable Header */}
      <header
        className="fixed left-0 right-0 z-50 transition-all duration-[350ms]"
        style={{
          top: "80px", // Account for POC header
          height: `${headerHeight}px`,
          transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        data-scroll-state={scrollState}
      >
        <div
          className="absolute inset-0 border-b border-gray-200/50 bg-white/80 dark:border-gray-700/50 dark:bg-gray-900/80"
          style={{
            backdropFilter: `blur(${blurIntensity}px) saturate(180%)`,
            WebkitBackdropFilter: `blur(${blurIntensity}px) saturate(180%)`,
          }}
        />

        <div className="relative flex h-full flex-col justify-end px-4 pb-2">
          <div className="mx-auto w-full max-w-6xl">
            {/* Navigation Bar */}
            <div className="mb-2 flex items-center justify-between">
              {/* Morphing Navigation Button */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300 hover:scale-95 active:scale-90"
                style={{
                  background: "rgba(255, 255, 255, 0.12)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div className="relative h-6 w-6">
                  {/* Hamburger/Back Icon Morph */}
                  <div
                    className="absolute inset-0 transition-all duration-300"
                    style={{
                      transform:
                        scrollState === "collapsed"
                          ? "rotate(-180deg)"
                          : "rotate(0deg)",
                      opacity: scrollState === "collapsed" ? 0 : 1,
                    }}
                  >
                    <Menu className="h-6 w-6 text-gray-700 dark:text-gray-300" />
                  </div>
                  <div
                    className="absolute inset-0 transition-all duration-300"
                    style={{
                      transform:
                        scrollState === "collapsed"
                          ? "rotate(0deg)"
                          : "rotate(180deg)",
                      opacity: scrollState === "collapsed" ? 1 : 0,
                    }}
                  >
                    <ChevronLeft className="h-6 w-6 text-gray-700 dark:text-gray-300" />
                  </div>
                </div>
              </button>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300 hover:scale-95 active:scale-90 ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                  style={{
                    background: "rgba(255, 255, 255, 0.12)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <RefreshCw className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                </button>
                <button
                  className="flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300 hover:scale-95 active:scale-90"
                  style={{
                    background: "rgba(255, 255, 255, 0.12)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <Search className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                </button>
                <button
                  className="flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300 hover:scale-95 active:scale-90"
                  style={{
                    background: "rgba(255, 255, 255, 0.12)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <Filter className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                </button>
              </div>
            </div>

            {/* Large/Compact Title */}
            <h1
              className="origin-left font-bold text-gray-900 transition-all duration-[350ms] dark:text-gray-100"
              style={{
                fontSize:
                  scrollState === "expanded"
                    ? "34px"
                    : scrollState === "transitioning"
                      ? `${34 - (scrollY - 44) * 0.17}px`
                      : "17px",
                transform: `scale(${titleScale})`,
                opacity: titleOpacity,
                transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
              }}
            >
              RSS Reader
            </h1>
          </div>
        </div>
      </header>

      {/* Filter Pills (Sticky Sub-header) */}
      <div
        className="sticky z-40 border-b border-gray-200/50 bg-white/95 backdrop-blur-md dark:border-gray-700/50 dark:bg-gray-900/95"
        style={{
          top: `${80 + headerHeight}px`,
          transition: "top 350ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="scrollbar-hide flex gap-2 overflow-x-auto">
            {[
              "all",
              "unread",
              "starred",
              "technology",
              "design",
              "development",
            ].map((filter) => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  selectedFilter === filter
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main
        className="mx-auto max-w-6xl px-4"
        style={{
          paddingTop: `${200 + headerHeight}px`,
          transition: "padding-top 350ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {/* Pull-to-refresh indicator */}
        {isRefreshing && (
          <div className="fixed left-1/2 top-32 z-50 -translate-x-1/2 transform">
            <div className="rounded-full bg-blue-600 px-4 py-2 text-white shadow-lg">
              Refreshing...
            </div>
          </div>
        )}

        {/* Article List */}
        <div className="space-y-2 pb-20">
          {articles.map((article) => (
            <article
              key={article.id}
              className="cursor-pointer rounded-xl bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98] dark:bg-gray-800"
            >
              <div className="mb-2 flex items-start justify-between">
                <h2 className="text-lg font-semibold leading-tight text-gray-900 dark:text-gray-100">
                  {article.title}
                </h2>
                {!article.isRead && (
                  <span className="ml-2 mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" />
                )}
              </div>
              <div className="mb-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">{article.source}</span>
                <span>•</span>
                <span>{article.time}</span>
              </div>
              <p className="line-clamp-2 text-gray-700 dark:text-gray-300">
                {article.summary}
              </p>
            </article>
          ))}
        </div>
      </main>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/50 transition-opacity duration-300"
            onClick={() => setIsSidebarOpen(false)}
          />
          <aside className="fixed bottom-0 left-0 top-0 z-[70] w-80 transform bg-white shadow-2xl transition-transform duration-300 dark:bg-gray-900">
            <div className="p-6 pt-28">
              <h2 className="mb-6 text-xl font-bold text-gray-900 dark:text-gray-100">
                Feeds
              </h2>
              <nav className="space-y-2">
                {[
                  "All Articles",
                  "Technology",
                  "Design",
                  "Development",
                  "Business",
                  "Science",
                ].map((feed) => (
                  <button
                    key={feed}
                    className="w-full rounded-lg px-4 py-3 text-left text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    {feed}
                  </button>
                ))}
              </nav>
            </div>
          </aside>
        </>
      )}

      {/* Debug Info (Development Only) */}
      <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-black/80 p-3 font-mono text-xs text-white">
        <div>Scroll State: {scrollState}</div>
        <div>Scroll Y: {Math.round(scrollY)}px</div>
        <div>Header Height: {Math.round(headerHeight)}px</div>
        <div>Title Scale: {titleScale.toFixed(2)}</div>
      </div>
    </div>
  );
}
