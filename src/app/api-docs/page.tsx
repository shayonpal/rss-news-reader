"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, Component, ReactNode } from "react";
import { Moon, Sun, Download, Filter, Server } from "lucide-react";

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

// Import CSS (this will be included in the dynamic import)
import "swagger-ui-react/swagger-ui.css";

// Add custom styles to hide Swagger's default info section and adjust layout
const customStyles = `
  .swagger-ui .info {
    display: none !important;
  }
  .swagger-ui .scheme-container {
    display: none !important;
  }
  .swagger-ui .topbar {
    display: none !important;
  }
  .swagger-ui {
    padding-top: 0 !important;
  }
  .swagger-ui .wrapper {
    padding-top: 0 !important;
  }
  
  /* Dark mode styles for Swagger UI */
  body.dark {
    background-color: #1f2937 !important;
  }
  
  body.dark .swagger-ui {
    background-color: #1f2937 !important;
  }
  
  body.dark .swagger-ui .opblock-tag {
    color: #e5e7eb !important;
    border-bottom-color: #374151 !important;
  }
  
  body.dark .swagger-ui .opblock {
    background: #374151 !important;
    border-color: #4b5563 !important;
  }
  
  body.dark .swagger-ui .opblock .opblock-summary {
    background: #1f2937 !important;
    border-color: #4b5563 !important;
    color: #e5e7eb !important;
  }
  
  body.dark .swagger-ui .opblock .opblock-summary-method {
    background: #10b981 !important;
    color: white !important;
  }
  
  body.dark .swagger-ui .opblock.opblock-post .opblock-summary-method {
    background: #8b5cf6 !important;
  }
  
  body.dark .swagger-ui .opblock.opblock-put .opblock-summary-method {
    background: #f59e0b !important;
  }
  
  body.dark .swagger-ui .opblock.opblock-delete .opblock-summary-method {
    background: #ef4444 !important;
  }
  
  body.dark .swagger-ui .opblock .opblock-summary-path,
  body.dark .swagger-ui .opblock .opblock-summary-description {
    color: #d1d5db !important;
  }
  
  body.dark .swagger-ui .opblock .opblock-section-header {
    background: #374151 !important;
    color: #e5e7eb !important;
    border-bottom-color: #4b5563 !important;
  }
  
  body.dark .swagger-ui .opblock-body {
    background: #1f2937 !important;
  }
  
  body.dark .swagger-ui .parameter__name,
  body.dark .swagger-ui .parameter__type,
  body.dark .swagger-ui .response-col_status,
  body.dark .swagger-ui .response-col_description {
    color: #d1d5db !important;
  }
  
  body.dark .swagger-ui table thead tr th,
  body.dark .swagger-ui table thead tr td {
    color: #e5e7eb !important;
    border-color: #4b5563 !important;
  }
  
  body.dark .swagger-ui .parameter__in {
    color: #9ca3af !important;
  }
  
  body.dark .swagger-ui .btn {
    background: #4b5563 !important;
    color: #e5e7eb !important;
    border-color: #6b7280 !important;
  }
  
  body.dark .swagger-ui .btn:hover {
    background: #6b7280 !important;
  }
  
  body.dark .swagger-ui .btn.execute {
    background: #3b82f6 !important;
    color: white !important;
    border-color: #2563eb !important;
  }
  
  body.dark .swagger-ui .btn.btn-clear {
    background: #ef4444 !important;
    color: white !important;
  }
  
  body.dark .swagger-ui select,
  body.dark .swagger-ui input[type=text],
  body.dark .swagger-ui textarea {
    background: #374151 !important;
    color: #e5e7eb !important;
    border-color: #4b5563 !important;
  }
  
  body.dark .swagger-ui .model-container {
    background: #1f2937 !important;
    color: #d1d5db !important;
  }
  
  body.dark .swagger-ui .model {
    color: #d1d5db !important;
  }
  
  body.dark .swagger-ui .prop-type {
    color: #60a5fa !important;
  }
  
  body.dark .swagger-ui .prop {
    color: #d1d5db !important;
  }
  
  body.dark .swagger-ui .renderedMarkdown p,
  body.dark .swagger-ui .renderedMarkdown code {
    color: #d1d5db !important;
  }
  
  body.dark .swagger-ui .renderedMarkdown code {
    background: #374151 !important;
    border-color: #4b5563 !important;
  }
  
  body.dark .swagger-ui .model-toggle {
    color: #d1d5db !important;
  }
  
  body.dark .swagger-ui .model-toggle:after {
    background: #374151 !important;
  }
  
  body.dark .swagger-ui section.models {
    border-color: #4b5563 !important;
  }
  
  body.dark .swagger-ui section.models h4 {
    color: #e5e7eb !important;
  }
  
  body.dark .swagger-ui .filter-container input[type=text] {
    background: #374151 !important;
    color: #e5e7eb !important;
    border-color: #4b5563 !important;
  }
  
  body.dark .swagger-ui .copy-to-clipboard {
    background: #374151 !important;
  }
  
  body.dark .swagger-ui .copy-to-clipboard button {
    background: #4b5563 !important;
    color: #e5e7eb !important;
  }
  
  /* Dropdown arrows and expand/collapse indicators */
  body.dark .swagger-ui .arrow,
  body.dark .swagger-ui .expand-operation,
  body.dark .swagger-ui .expand-methods {
    fill: #d1d5db !important;
    color: #d1d5db !important;
  }
  
  body.dark .swagger-ui .opblock .opblock-summary-control .arrow {
    fill: #d1d5db !important;
  }
  
  body.dark .swagger-ui svg {
    fill: #d1d5db !important;
  }
  
  body.dark .swagger-ui .svg-assets {
    filter: invert(1) !important;
  }
  
  body.dark .swagger-ui .arrow:after {
    border-color: #d1d5db !important;
  }
  
  /* Response expand/collapse arrows */
  body.dark .swagger-ui .responses-inner h4:after,
  body.dark .swagger-ui .responses-inner h5:after {
    background: #d1d5db !important;
  }
  
  /* Model expand arrows */
  body.dark .swagger-ui .model-toggle:after {
    background: #d1d5db !important;
  }
  
  body.dark .swagger-ui .model-box {
    background: #374151 !important;
  }
  
  /* Authorization lock icons */
  body.dark .swagger-ui .authorization__btn svg {
    fill: #d1d5db !important;
  }
  
  body.dark .swagger-ui .authorization__btn.locked svg {
    fill: #10b981 !important;
  }
  
  /* Expand/collapse all operations */
  body.dark .swagger-ui .expand-methods svg,
  body.dark .swagger-ui .expand-operation svg {
    fill: #d1d5db !important;
  }
  
  /* Try it out / Cancel button text */
  body.dark .swagger-ui .try-out__btn {
    color: #e5e7eb !important;
    background: #4b5563 !important;
    border-color: #6b7280 !important;
  }
  
  body.dark .swagger-ui .try-out__btn:hover {
    background: #6b7280 !important;
  }
`;

// Error boundary to catch and handle SwaggerUI errors
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("SwaggerUI Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <h2 className="mb-2 text-xl font-semibold text-red-600">
            Error Loading Swagger UI
          </h2>
          <p className="text-gray-600">Please refresh the page to try again.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function SwaggerDocsPage() {
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedServer, setSelectedServer] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");

  // Load preferences from localStorage
  useEffect(() => {
    const savedDarkMode = localStorage.getItem("swaggerDarkMode");
    const savedServer = localStorage.getItem("swaggerSelectedServer");

    if (savedDarkMode === "true") {
      setIsDarkMode(true);
      document.body.classList.add("dark");
    }

    if (savedServer) {
      setSelectedServer(savedServer);
    }
  }, []);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem("swaggerDarkMode", newDarkMode.toString());

    if (newDarkMode) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  };

  // Handle server selection
  const handleServerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const server = e.target.value;
    setSelectedServer(server);
    localStorage.setItem("swaggerSelectedServer", server);

    // Update spec with new server
    if (spec) {
      const updatedSpec = {
        ...spec,
        servers: [{ url: server, description: getServerDescription(server) }],
      };
      setSpec(updatedSpec);
    }
  };

  // Get server description based on URL
  const getServerDescription = (url: string): string => {
    if (url.includes("localhost")) return "Local Development";
    if (url.includes("127.0.0.1")) return "Local Development (IP)";
    if (url.includes("100.96.166.53")) return "Tailscale Network";
    return "Production";
  };

  // Available servers
  const availableServers = [
    { url: "http://localhost:3000/reader", label: "Local Development" },
    { url: "http://127.0.0.1:3000/reader", label: "Local (127.0.0.1)" },
    { url: "http://100.96.166.53:3000/reader", label: "Tailscale Network" },
  ];

  useEffect(() => {
    async function fetchSpec() {
      try {
        const response = await fetch("/reader/api-docs/openapi.json");
        if (!response.ok) {
          throw new Error(`Failed to fetch OpenAPI spec: ${response.status}`);
        }
        const data = await response.json();

        // Set initial server
        const currentUrl = window.location.origin;
        const defaultServer = selectedServer || `${currentUrl}/reader`;

        if (data.servers && data.servers.length > 0) {
          data.servers[0].url = defaultServer;
          data.servers[0].description = getServerDescription(defaultServer);
        }

        if (!selectedServer) {
          setSelectedServer(defaultServer);
        }

        setSpec(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load OpenAPI specification"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchSpec();
  }, [selectedServer]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-gray-600">Loading API Documentation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold text-red-800">
            Error Loading Documentation
          </h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? "bg-gray-900" : "bg-white"}`}>
      {/* Inject custom styles */}
      <style jsx global>
        {customStyles}
      </style>

      {/* Compact Custom Header */}
      <div
        className={`sticky top-0 z-50 border-b ${
          isDarkMode
            ? "border-gray-700 bg-gray-800"
            : "border-gray-200 bg-white shadow-sm"
        }`}
      >
        <div className="mx-auto max-w-full px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left side: Title and badges */}
            <div className="flex items-center gap-4">
              <h1
                className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}
              >
                📰 RSS Reader API
              </h1>
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                  v{spec?.info?.version || "1.0.0"}
                </span>
                <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                  OAS 3.0
                </span>
              </div>
            </div>

            {/* Right side: Controls */}
            <div className="flex items-center gap-3">
              {/* Server Dropdown */}
              <div className="flex items-center gap-2">
                <Server
                  size={16}
                  className={isDarkMode ? "text-gray-400" : "text-gray-600"}
                />
                <select
                  value={selectedServer}
                  onChange={handleServerChange}
                  className={`rounded border px-2 py-1 text-sm ${
                    isDarkMode
                      ? "border-gray-600 bg-gray-700 text-white"
                      : "border-gray-300 bg-white text-gray-900"
                  }`}
                >
                  {availableServers.map((server) => (
                    <option key={server.url} value={server.url}>
                      {server.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tag Filter */}
              <div className="flex items-center gap-2">
                <Filter
                  size={16}
                  className={isDarkMode ? "text-gray-400" : "text-gray-600"}
                />
                <input
                  type="text"
                  placeholder="Filter by tag..."
                  value={tagFilter}
                  onChange={(e) => {
                    setTagFilter(e.target.value);
                    // SwaggerUI's filter is applied via the filter prop
                  }}
                  className={`w-32 rounded border px-2 py-1 text-sm ${
                    isDarkMode
                      ? "border-gray-600 bg-gray-700 text-white placeholder-gray-400"
                      : "border-gray-300 bg-white text-gray-900 placeholder-gray-500"
                  }`}
                />
              </div>

              {/* Export to Insomnia */}
              <a
                href="/reader/api/insomnia.json"
                download="rss-reader-insomnia.json"
                className="flex items-center gap-1.5 rounded bg-purple-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-purple-700"
              >
                <Download size={14} />
                <span>Export</span>
              </a>

              {/* Dark Mode Toggle */}
              <button
                onClick={toggleDarkMode}
                className={`flex items-center gap-1.5 rounded px-3 py-1 text-sm font-medium transition-colors ${
                  isDarkMode
                    ? "bg-gray-700 text-yellow-400 hover:bg-gray-600"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                aria-label="Toggle dark mode"
              >
                {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                <span>{isDarkMode ? "Light" : "Dark"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Swagger UI Container */}
      <div className="swagger-ui-container">
        {spec && (
          <ErrorBoundary>
            <SwaggerUI
              spec={spec}
              docExpansion="list"
              defaultModelsExpandDepth={1}
              defaultModelExpandDepth={1}
              tryItOutEnabled={true}
              filter={tagFilter || true}
              requestSnippetsEnabled={true}
              supportedSubmitMethods={["get", "post", "put", "delete", "patch"]}
              deepLinking={true}
              displayOperationId={false}
              persistAuthorization={true}
              showExtensions={false}
              showCommonExtensions={false}
              presets={undefined}
              onComplete={(system: any) => {
                // Store reference for potential future use
                if (system) {
                  (window as any).swaggerUISystem = system;
                }
              }}
            />
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
