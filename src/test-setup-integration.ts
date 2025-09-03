// Integration test setup - uses real fetch, not mocks
// Node 18+ has native fetch support

import { vi } from "vitest";
import React from "react";

// Set test environment flag
process.env.IS_TEST_ENVIRONMENT = "true";

// Setup comprehensive environment variables for integration tests
// These mirror production environment variables but use test-safe values
process.env.NODE_ENV = "test";
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-key";
process.env.NEXT_PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
process.env.NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
process.env.NEXT_PUBLIC_INOREADER_CLIENT_ID =
  process.env.NEXT_PUBLIC_INOREADER_CLIENT_ID || "test-client-id";
process.env.NEXT_PUBLIC_INOREADER_REDIRECT_URI =
  process.env.NEXT_PUBLIC_INOREADER_REDIRECT_URI ||
  "http://localhost:8080/auth/callback";
process.env.INOREADER_CLIENT_ID =
  process.env.INOREADER_CLIENT_ID || "test-client-id";
process.env.INOREADER_CLIENT_SECRET =
  process.env.INOREADER_CLIENT_SECRET || "test-client-secret";
process.env.INOREADER_REDIRECT_URI =
  process.env.INOREADER_REDIRECT_URI || "http://localhost:8080/auth/callback";
process.env.ANTHROPIC_API_KEY =
  process.env.ANTHROPIC_API_KEY || "test-anthropic-key";
process.env.TEST_INOREADER_EMAIL =
  process.env.TEST_INOREADER_EMAIL || "test@example.com";
process.env.TEST_INOREADER_PASSWORD =
  process.env.TEST_INOREADER_PASSWORD || "test-password";

// Ensure we're not using mocked fetch from unit tests
if ("vi" in global && (global as any).vi && (global as any).fetch?.mock) {
  delete (global as any).fetch;
}

// Mock browser APIs for integration tests
// IntersectionObserver is used by ArticleList for infinite scroll
Object.defineProperty(global, "IntersectionObserver", {
  value: vi.fn().mockImplementation((callback) => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    root: null,
    rootMargin: "",
    thresholds: [],
  })),
  writable: true,
});

// ResizeObserver for responsive components
Object.defineProperty(global, "ResizeObserver", {
  value: vi.fn().mockImplementation((callback) => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
  writable: true,
});

// matchMedia for responsive design testing
Object.defineProperty(global, "matchMedia", {
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
  writable: true,
});

// Mock lucide-react icons with a simpler approach for integration tests
// This prevents "No [IconName] export is defined" errors during integration testing
vi.mock("lucide-react", () => {
  // Create a simple mock icon component using React.createElement to avoid JSX parsing issues
  const mockIcon = (name: string) => {
    const MockIconComponent = (props: any) =>
      React.createElement(
        "div",
        {
          className: props.className,
          "data-testid": `${name.toLowerCase()}-icon`,
          "data-icon": name,
          ...props,
        },
        name
      );
    MockIconComponent.displayName = `Mock${name}Icon`;
    return MockIconComponent;
  };

  // Return comprehensive icon exports
  return {
    // All icons used across the application
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
    FileQuestion: mockIcon("FileQuestion"),
    FileText: mockIcon("FileText"),
    File: mockIcon("File"),
    Image: mockIcon("Image"),
    Video: mockIcon("Video"),
    Download: mockIcon("Download"),
    Upload: mockIcon("Upload"),
    Link: mockIcon("Link"),
    ExternalLink: mockIcon("ExternalLink"),
    Star: mockIcon("Star"),
    Heart: mockIcon("Heart"),
    Share: mockIcon("Share"),
    Bookmark: mockIcon("Bookmark"),
    Edit: mockIcon("Edit"),
    Trash: mockIcon("Trash"),
    Copy: mockIcon("Copy"),
    Save: mockIcon("Save"),
    Check: mockIcon("Check"),
    CheckCheck: mockIcon("CheckCheck"),
    AlertCircle: mockIcon("AlertCircle"),
    AlertTriangle: mockIcon("AlertTriangle"),
    Info: mockIcon("Info"),
    Loader: mockIcon("Loader"),
    Loader2: mockIcon("Loader2"),
    CheckCircle: mockIcon("CheckCircle"),
    XCircle: mockIcon("XCircle"),
    Mail: mockIcon("Mail"),
    MailOpen: mockIcon("MailOpen"),
    MessageCircle: mockIcon("MessageCircle"),
    Send: mockIcon("Send"),
    Bell: mockIcon("Bell"),
    BellOff: mockIcon("BellOff"),
    Eye: mockIcon("Eye"),
    EyeOff: mockIcon("EyeOff"),
    Play: mockIcon("Play"),
    Pause: mockIcon("Pause"),
    Volume: mockIcon("Volume"),
    VolumeOff: mockIcon("VolumeOff"),
    Home: mockIcon("Home"),
    Search: mockIcon("Search"),
    Settings: mockIcon("Settings"),
    Filter: mockIcon("Filter"),
    List: mockIcon("List"),
    Grid: mockIcon("Grid"),
    Layout: mockIcon("Layout"),
    LayoutDashboard: mockIcon("LayoutDashboard"),
    Monitor: mockIcon("Monitor"),
    Moon: mockIcon("Moon"),
    Sun: mockIcon("Sun"),
    Smartphone: mockIcon("Smartphone"),
    Tablet: mockIcon("Tablet"),
    Computer: mockIcon("Computer"),
    RefreshCw: mockIcon("RefreshCw"),
    RefreshCcw: mockIcon("RefreshCcw"),
    Sync: mockIcon("Sync"),
    RotateCcw: mockIcon("RotateCcw"),
    Rss: mockIcon("Rss"),
    Newspaper: mockIcon("Newspaper"),
    Globe: mockIcon("Globe"),
    Wifi: mockIcon("Wifi"),
    WifiOff: mockIcon("WifiOff"),
    Folder: mockIcon("Folder"),
    FolderOpen: mockIcon("FolderOpen"),
    Tag: mockIcon("Tag"),
    Tags: mockIcon("Tags"),
    Archive: mockIcon("Archive"),
    User: mockIcon("User"),
    Users: mockIcon("Users"),
    UserPlus: mockIcon("UserPlus"),
    UserMinus: mockIcon("UserMinus"),
    Clock: mockIcon("Clock"),
    Calendar: mockIcon("Calendar"),
    CalendarDays: mockIcon("CalendarDays"),
    Timer: mockIcon("Timer"),
    FoldVertical: mockIcon("FoldVertical"),
    Unfold: mockIcon("Unfold"),
    UnfoldVertical: mockIcon("UnfoldVertical"),
    Maximize: mockIcon("Maximize"),
    Minimize: mockIcon("Minimize"),
    Plus: mockIcon("Plus"),
    Minus: mockIcon("Minus"),
    Equals: mockIcon("Equals"),
    BarChart: mockIcon("BarChart"),
    BarChart3: mockIcon("BarChart3"),
    LineChart: mockIcon("LineChart"),
    PieChart: mockIcon("PieChart"),
    TrendingUp: mockIcon("TrendingUp"),
    TrendingDown: mockIcon("TrendingDown"),
    Lock: mockIcon("Lock"),
    Unlock: mockIcon("Unlock"),
    Shield: mockIcon("Shield"),
    ShieldCheck: mockIcon("ShieldCheck"),
    Key: mockIcon("Key"),
    Code: mockIcon("Code"),
    Terminal: mockIcon("Terminal"),
    Bug: mockIcon("Bug"),
    Zap: mockIcon("Zap"),
    Sparkles: mockIcon("Sparkles"),
    // Additional icons found in codebase analysis (no duplicates)
    CircleCheckBig: mockIcon("CircleCheckBig"),
    Undo2: mockIcon("Undo2"),
    Inbox: mockIcon("Inbox"),
    Hash: mockIcon("Hash"),
    Server: mockIcon("Server"),
    Ellipsis: mockIcon("Ellipsis"),
    Share2: mockIcon("Share2"),
    BookOpen: mockIcon("BookOpen"),
    Database: mockIcon("Database"),
    HardDrive: mockIcon("HardDrive"),
    Trash2: mockIcon("Trash2"),
    Circle: mockIcon("Circle"),
    Palette: mockIcon("Palette"),
    Cog: mockIcon("Cog"),
    Radio: mockIcon("Radio"),
    Book: mockIcon("Book"),
    Activity: mockIcon("Activity"),
    // Catch-all for any missing icons
    default: mockIcon("DefaultIcon"),
  };
});

// Environment variable validation for test robustness
function validateTestEnvironment() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.warn(
      `[Test Setup] Missing environment variables: ${missing.join(", ")}`
    );
    console.warn(`[Test Setup] Using fallback values for testing`);
  }

  if (process.env.NODE_ENV !== "test") {
    console.warn(
      `[Test Setup] NODE_ENV is '${process.env.NODE_ENV}', expected 'test'`
    );
  }
}

// Validate environment on setup
validateTestEnvironment();
