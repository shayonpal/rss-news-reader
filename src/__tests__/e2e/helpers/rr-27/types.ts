/**
 * RR-27: Test Consolidation - Type Definitions
 *
 * TypeScript interfaces for scenario catalog and test infrastructure
 */

import { Page, Locator } from "@playwright/test";

// Core State Types
export interface FilterState {
  feedId?: string;
  category?: string;
  searchQuery?: string;
  readFilter?: "all" | "unread" | "read";
  sortOrder?: "newest" | "oldest";
}

export interface AppState {
  filters: FilterState;
  scrollPosition: number;
  sessionStorage: Record<string, string>;
  articles: ArticleState[];
}

export interface ArticleState {
  id: string;
  title: string;
  feedId: string;
  isRead: boolean;
  isStarred: boolean;
  isSessionPreserved?: boolean;
  publishedAt: string;
}

// Scenario Definition Types
export interface TestScenario {
  id: string;
  category:
    | "persistence"
    | "clearing"
    | "navigation"
    | "regression"
    | "performance";
  description: string;
  priority: "critical" | "high" | "medium";
  expectedDuration: number; // milliseconds
  mobileOnly?: boolean;
  setup: ScenarioSetup;
  actions: ScenarioAction[];
  assertions: ScenarioAssertion[];
}

export interface ScenarioSetup {
  filters?: FilterState;
  articles?: ArticleFixture[];
  scrollPosition?: number;
  sessionStorage?: Record<string, string>;
  viewport?: ViewportConfig;
}

export interface ScenarioAction {
  type:
    | "navigate"
    | "filter"
    | "scroll"
    | "click"
    | "refresh"
    | "storage"
    | "wait";
  target?: string;
  value?: any;
  delay?: number;
}

export interface ScenarioAssertion {
  type: "state" | "ui" | "performance" | "storage" | "styling";
  expected: any;
  tolerance?: number;
}

// Test Data Types
export interface ArticleFixture {
  id: string;
  title: string;
  summary: string;
  feedId: string;
  isRead: boolean;
  isStarred: boolean;
  publishedAt: string;
}

export interface ViewportConfig {
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
}

// Performance Metrics Types
export interface TestMetrics {
  testName: string;
  duration: number;
  memoryDelta: number;
  passed: boolean;
}

export interface MobileMetrics {
  fcp: number; // First Contentful Paint
  tti: number; // Time to Interactive
  cls: number; // Cumulative Layout Shift
  fid: number; // First Input Delay
  passed: boolean;
}

export interface CoverageReport {
  totalTests: number;
  coveredTests: number;
  coverage: number;
  missingTests: string[];
  fileMapping: Map<string, string[]>;
}

// Helper Function Types
export type WaitStrategy = "networkidle" | "domcontentloaded" | "load";

export interface NavigationOptions {
  waitUntil?: WaitStrategy;
  timeout?: number;
}

export interface StateComparisonOptions {
  ignoreScroll?: boolean;
  ignoreTimestamp?: boolean;
  tolerancePixels?: number;
}

// Test Constants
export const TEST_CONSTANTS = {
  RSS_READER_URL: "http://100.96.166.53:3000/reader",
  MOBILE_VIEWPORT: { width: 390, height: 844 },
  DEFAULT_TIMEOUT: 10000,
  SCROLL_TOLERANCE: 10,
  PERFORMANCE_THRESHOLDS: {
    PAGE_LOAD: 3000,
    STATE_OPERATION: 500,
    TOTAL_TEST_SUITE: 20000,
    PER_FILE: 6000,
  },
  SESSION_EXPIRY_MINUTES: 30,
} as const;

// Test Categories mapping from old files to new consolidated structure
export const SCENARIO_CATEGORIES = {
  MECHANICS_PERSISTENCE: [
    "state-preservation.spec.ts",
    "visibility-fix.spec.ts",
    "comprehensive.spec.ts",
  ],
  MECHANICS_CLEARING: ["state-clearing.spec.ts", "second-click-fix.spec.ts"],
  USER_FLOWS: ["complete-user-flows.spec.ts", "real-navigation.spec.ts"],
  REGRESSION_SUITE: [
    "regression-check.spec.ts",
    "comprehensive.spec.ts", // partial overlap
  ],
} as const;
