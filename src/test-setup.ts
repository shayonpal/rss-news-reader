import "fake-indexeddb/auto";
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { vi, expect, beforeEach, afterEach, afterAll } from "vitest";

// Mock environment - ensure NODE_ENV is set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "test";
}

// RR-183: Global test cleanup hooks for resource management
beforeEach(() => {
  // CRITICAL: Clean up DOM before each test to ensure fresh state
  cleanup();

  // Clear all mocks before each test
  vi.clearAllMocks();

  // Reset fetch mock
  if (global.fetch) {
    (global.fetch as any).mockClear();
  }

  // Clear storage mocks
  if (window.localStorage) {
    window.localStorage.clear();
  }
  if (window.sessionStorage) {
    window.sessionStorage.clear();
  }
});

afterEach(() => {
  // CRITICAL: Clean up DOM between tests to prevent component persistence
  cleanup();

  // Restore all mocks after each test
  vi.restoreAllMocks();

  // Clear any pending timers
  vi.clearAllTimers();
});

// Global cleanup after all tests
afterAll(() => {
  // Final cleanup of any resources
  cleanup();
  vi.resetAllMocks();

  // Force DOM cleanup by clearing document body
  if (typeof document !== "undefined" && document.body) {
    document.body.innerHTML = "";
  }
});

// Mock fetch globally
global.fetch = vi.fn();

// Mock window.location
Object.defineProperty(window, "location", {
  value: {
    href: "http://localhost:3000",
    origin: "http://localhost:3000",
    pathname: "/",
    search: "",
    hash: "",
  },
  writable: true,
});

// Mock localStorage and sessionStorage
const createStorage = () => {
  const storage = new Map();
  return {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    get length() {
      return storage.size;
    },
    key: (index: number) => Array.from(storage.keys())[index] || null,
  };
};

// RR-222: Configurability detection to handle jsdom thread pool isolation
// Check if properties can be redefined before attempting defineProperty
const setupStorageMock = (storageName: "localStorage" | "sessionStorage") => {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(window, storageName);
    const isConfigurable = descriptor?.configurable !== false;

    if (!window[storageName] || isConfigurable) {
      // Property doesn't exist or is configurable - safe to defineProperty
      Object.defineProperty(window, storageName, {
        value: createStorage(),
        writable: true,
        configurable: true,
      });
    } else {
      // Property exists and is not configurable - fall back to prototype mocking
      console.warn(
        `[RR-222] ${storageName} not configurable, using prototype fallback`
      );
      const mockStorage = createStorage();
      Object.assign(Storage.prototype, mockStorage);
    }
  } catch (error) {
    // Last resort: directly assign to window if all else fails
    console.warn(
      `[RR-222] Failed to mock ${storageName}, using direct assignment:`,
      error
    );
    (window as any)[storageName] = createStorage();
  }
};

setupStorageMock("localStorage");
setupStorageMock("sessionStorage");

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  root = null;
  rootMargin = "0px";
  thresholds = [0];

  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock lucide-react icons globally for all tests
vi.mock("lucide-react", () => {
  // Create a mock icon component factory
  const mockIcon = (name: string) => {
    const MockIconComponent = ({ className, ...props }: any) =>
      React.createElement(
        "div",
        {
          className,
          "data-testid": `${name.toLowerCase()}-icon`,
          "data-icon": name,
          ...props,
        },
        name
      );
    MockIconComponent.displayName = `Mock${name}Icon`;
    return MockIconComponent;
  };

  // Create comprehensive icon exports covering all used icons
  return {
    // Navigation and UI icons
    ChevronDown: mockIcon("ChevronDown"),
    ChevronLeft: mockIcon("ChevronLeft"),
    ChevronRight: mockIcon("ChevronRight"),
    ChevronUp: mockIcon("ChevronUp"),
    ArrowLeft: mockIcon("ArrowLeft"),
    ArrowRight: mockIcon("ArrowRight"),
    ArrowUp: mockIcon("ArrowUp"),
    Menu: mockIcon("Menu"),
    X: mockIcon("X"),
    MoreHorizontal: mockIcon("MoreHorizontal"),
    MoreVertical: mockIcon("MoreVertical"),

    // Content and media icons
    FileQuestion: mockIcon("FileQuestion"),
    FileText: mockIcon("FileText"),
    File: mockIcon("File"),
    Image: mockIcon("Image"),
    Video: mockIcon("Video"),
    Download: mockIcon("Download"),
    Upload: mockIcon("Upload"),
    Link: mockIcon("Link"),
    ExternalLink: mockIcon("ExternalLink"),

    // Actions and interactions
    Star: mockIcon("Star"),
    Heart: mockIcon("Heart"),
    Share: mockIcon("Share"),
    Bookmark: mockIcon("Bookmark"),
    Edit: mockIcon("Edit"),
    Trash: mockIcon("Trash"),
    Copy: mockIcon("Copy"),
    Save: mockIcon("Save"),

    // Status and feedback icons
    Check: mockIcon("Check"),
    AlertCircle: mockIcon("AlertCircle"),
    AlertTriangle: mockIcon("AlertTriangle"),
    Info: mockIcon("Info"),
    Loader: mockIcon("Loader"),
    Loader2: mockIcon("Loader2"),
    CheckCircle: mockIcon("CheckCircle"),
    XCircle: mockIcon("XCircle"),

    // Communication icons
    Mail: mockIcon("Mail"),
    MailOpen: mockIcon("MailOpen"),
    MessageCircle: mockIcon("MessageCircle"),
    Send: mockIcon("Send"),
    Bell: mockIcon("Bell"),
    BellOff: mockIcon("BellOff"),

    // Media and display icons
    Eye: mockIcon("Eye"),
    EyeOff: mockIcon("EyeOff"),
    Play: mockIcon("Play"),
    Pause: mockIcon("Pause"),
    Volume: mockIcon("Volume"),
    VolumeOff: mockIcon("VolumeOff"),

    // Navigation and layout icons
    Home: mockIcon("Home"),
    Search: mockIcon("Search"),
    Settings: mockIcon("Settings"),
    Filter: mockIcon("Filter"),
    List: mockIcon("List"),
    Grid: mockIcon("Grid"),
    Layout: mockIcon("Layout"),

    // System and device icons
    Monitor: mockIcon("Monitor"),
    Moon: mockIcon("Moon"),
    Sun: mockIcon("Sun"),
    Smartphone: mockIcon("Smartphone"),
    Tablet: mockIcon("Tablet"),
    Computer: mockIcon("Computer"),

    // Sync and refresh icons
    RefreshCw: mockIcon("RefreshCw"),
    RefreshCcw: mockIcon("RefreshCcw"),
    Sync: mockIcon("Sync"),
    RotateCcw: mockIcon("RotateCcw"),

    // RSS and feed specific icons
    Rss: mockIcon("Rss"),
    Newspaper: mockIcon("Newspaper"),
    Globe: mockIcon("Globe"),
    Wifi: mockIcon("Wifi"),
    WifiOff: mockIcon("WifiOff"),

    // Folder and organization icons
    Folder: mockIcon("Folder"),
    FolderOpen: mockIcon("FolderOpen"),
    Tag: mockIcon("Tag"),
    Tags: mockIcon("Tags"),
    Archive: mockIcon("Archive"),

    // User and profile icons
    User: mockIcon("User"),
    Users: mockIcon("Users"),
    UserPlus: mockIcon("UserPlus"),
    UserMinus: mockIcon("UserMinus"),

    // Time and calendar icons
    Clock: mockIcon("Clock"),
    Calendar: mockIcon("Calendar"),
    CalendarDays: mockIcon("CalendarDays"),
    Timer: mockIcon("Timer"),

    // Specific components that were failing
    FoldVertical: mockIcon("FoldVertical"),
    Unfold: mockIcon("Unfold"),

    // Advanced icons for complex components
    Maximize: mockIcon("Maximize"),
    Minimize: mockIcon("Minimize"),
    Plus: mockIcon("Plus"),
    Minus: mockIcon("Minus"),
    Equals: mockIcon("Equals"),

    // Data and analytics icons
    BarChart: mockIcon("BarChart"),
    LineChart: mockIcon("LineChart"),
    PieChart: mockIcon("PieChart"),
    TrendingUp: mockIcon("TrendingUp"),
    TrendingDown: mockIcon("TrendingDown"),

    // Security and access icons
    Lock: mockIcon("Lock"),
    Unlock: mockIcon("Unlock"),
    Shield: mockIcon("Shield"),
    ShieldCheck: mockIcon("ShieldCheck"),
    Key: mockIcon("Key"),

    // Development and debug icons
    Code: mockIcon("Code"),
    Terminal: mockIcon("Terminal"),
    Bug: mockIcon("Bug"),
    Zap: mockIcon("Zap"),

    // Catch-all for any missing icons - prevents test failures
    default: mockIcon("DefaultIcon"),
  };
});

// Additional handling for the integration test setup
// Add the same lucide-react mock to integration test environment
vi.mock("lucide-react", { hoisted: true });

// Extend Vitest expect with custom matchers
expect.extend({
  /**
   * Custom matcher to check if a value is one of several possible values
   * @param received - The value to test
   * @param expected - Array of possible values
   * @returns AssertionResult
   */
  toBeOneOf(received: any, expected: any[]) {
    if (!Array.isArray(expected)) {
      throw new Error("Expected value must be an array");
    }

    const pass = expected.includes(received);

    if (pass) {
      return {
        message: () =>
          `expected ${this.utils.printReceived(received)} not to be one of ${this.utils.printExpected(expected)}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${this.utils.printReceived(received)} to be one of ${this.utils.printExpected(expected)}`,
        pass: false,
      };
    }
  },
});
