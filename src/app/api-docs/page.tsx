"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, Component, ReactNode } from "react";
import { Moon, Sun } from "lucide-react";

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

// Import CSS (this will be included in the dynamic import)
import "swagger-ui-react/swagger-ui.css";
// Import Material theme
import "swagger-ui-themes/themes/3.x/theme-material.css";

// Error Boundary Component
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("SwaggerUI Error:", error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <h2 className="mb-2 text-lg font-semibold text-red-800">
              SwaggerUI Error
            </h2>
            <p className="text-red-600">
              {this.state.error?.message ||
                "An error occurred while loading the documentation"}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function SwaggerDocsPage() {
  const [spec, setSpec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Load dark mode preference from localStorage
  useEffect(() => {
    const savedDarkMode = localStorage.getItem("swaggerDarkMode");
    if (savedDarkMode === "true") {
      setIsDarkMode(true);
    }
  }, []);

  // Save dark mode preference to localStorage
  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem("swaggerDarkMode", newDarkMode.toString());
  };

  useEffect(() => {
    async function fetchSpec() {
      try {
        const response = await fetch("/reader/api-docs/openapi.json");
        if (!response.ok) {
          throw new Error(`Failed to fetch OpenAPI spec: ${response.status}`);
        }
        const data = await response.json();

        // Dynamically set the server URL to match the current host
        if (data.servers && data.servers.length > 0) {
          const currentUrl = window.location.origin;
          data.servers[0].url = `${currentUrl}/reader`;
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
  }, []);

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
      <div
        className={`border-b ${isDarkMode ? "border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900" : "border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50"} px-6 py-6`}
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1
                className={`mb-2 text-3xl font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}
              >
                📚 RSS News Reader API Documentation
              </h1>
              <p
                className={`mb-1 text-base ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}
              >
                Interactive REST API documentation powered by OpenAPI 3.0 and
                Swagger UI
              </p>
              <div
                className={`mt-3 flex items-center gap-4 text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}
              >
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500"></span>
                  Version 1.0.0
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-500"></span>
                  6 Health Endpoints Available
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-purple-500"></span>
                  {isDarkMode ? "Dark" : "Material"} Theme
                </span>
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`ml-4 flex items-center gap-2 rounded-lg px-4 py-2 transition-all ${
                isDarkMode
                  ? "bg-gray-700 text-yellow-400 hover:bg-gray-600"
                  : "bg-white text-gray-700 shadow-md hover:bg-gray-100"
              }`}
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              <span className="text-sm font-medium">
                {isDarkMode ? "Light" : "Dark"} Mode
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="swagger-ui-container">
        {spec && (
          <ErrorBoundary>
            <SwaggerUI
              spec={spec}
              docExpansion="list"
              defaultModelsExpandDepth={1}
              defaultModelExpandDepth={1}
              tryItOutEnabled={true}
              filter={true}
              requestSnippetsEnabled={true}
              supportedSubmitMethods={["get", "post", "put", "delete", "patch"]}
              deepLinking={true}
              displayOperationId={false}
              persistAuthorization={true}
              showExtensions={false}
              showCommonExtensions={false}
            />
          </ErrorBoundary>
        )}
      </div>

      <style jsx global>{`
        /* Dark mode base styles */
        ${isDarkMode
          ? `
          .swagger-ui {
            background: #1a1a1a !important;
            color: #e5e5e5 !important;
          }

          .swagger-ui .wrapper {
            background: #1a1a1a !important;
          }

          .swagger-ui .info .title,
          .swagger-ui .info .description p,
          .swagger-ui .info .description,
          .swagger-ui .info .version {
            color: white !important;
          }

          .swagger-ui .scheme-container {
            background: #2d2d2d !important;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3) !important;
          }

          .swagger-ui select {
            background: #2d2d2d !important;
            color: #e5e5e5 !important;
            border: 1px solid #444 !important;
          }

          .swagger-ui .opblock-tag {
            background: #2d2d2d !important;
            border-bottom: 1px solid #444 !important;
          }

          .swagger-ui .opblock-tag-section h3,
          .swagger-ui .opblock-tag-section h4 {
            color: #e5e5e5 !important;
          }

          .swagger-ui .opblock {
            background: #2d2d2d !important;
            border: 1px solid #444 !important;
          }

          .swagger-ui .opblock .opblock-summary {
            background: #2d2d2d !important;
            border: 1px solid #444 !important;
          }

          .swagger-ui .opblock .opblock-summary-description {
            color: #bbb !important;
          }

          .swagger-ui .opblock .opblock-section-header {
            background: #262626 !important;
            box-shadow: none !important;
          }

          .swagger-ui .opblock .opblock-section-header h4,
          .swagger-ui .opblock .opblock-section-header label {
            color: #e5e5e5 !important;
          }

          .swagger-ui .opblock.opblock-get .opblock-summary {
            border-color: #10b981 !important;
          }

          .swagger-ui .opblock.opblock-get .opblock-summary-method {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
          }

          .swagger-ui .parameters-col_description,
          .swagger-ui .response-col_description {
            color: #bbb !important;
          }

          .swagger-ui .parameter__name,
          .swagger-ui .parameter__type {
            color: #e5e5e5 !important;
          }

          .swagger-ui table thead tr th,
          .swagger-ui table thead tr td {
            color: #e5e5e5 !important;
            border-color: #444 !important;
          }

          .swagger-ui .model-container {
            background: #262626 !important;
            border-radius: 8px !important;
          }

          .swagger-ui .model {
            color: #e5e5e5 !important;
          }

          .swagger-ui .highlight-code .highlight pre {
            background: #1a1a1a !important;
            color: #e5e5e5 !important;
          }

          .swagger-ui .responses-inner {
            background: #262626 !important;
            padding: 15px !important;
            border-radius: 8px !important;
          }

          .swagger-ui .response-col_status {
            color: #10b981 !important;
          }

          .swagger-ui .btn {
            background: #444 !important;
            color: #e5e5e5 !important;
            border: 1px solid #555 !important;
          }

          .swagger-ui .btn:hover {
            background: #555 !important;
            border-color: #666 !important;
          }

          .swagger-ui .btn.try-out__btn {
            background: #6366f1 !important;
            border-color: #6366f1 !important;
          }

          .swagger-ui .btn.try-out__btn:hover {
            background: #4f46e5 !important;
          }

          .swagger-ui .btn.execute {
            background: #10b981 !important;
            border-color: #10b981 !important;
          }

          .swagger-ui .btn.execute:hover {
            background: #059669 !important;
          }

          .swagger-ui .btn.cancel {
            background: #ef4444 !important;
            border-color: #ef4444 !important;
          }

          .swagger-ui textarea,
          .swagger-ui input[type=text],
          .swagger-ui input[type=password],
          .swagger-ui input[type=email],
          .swagger-ui input[type=url] {
            background: #1a1a1a !important;
            color: #e5e5e5 !important;
            border: 1px solid #444 !important;
          }

          .swagger-ui .filter .operation-filter-input {
            background: #2d2d2d !important;
            color: #e5e5e5 !important;
            border: 1px solid #444 !important;
          }

          .swagger-ui .copy-to-clipboard {
            background: #2d2d2d !important;
          }

          .swagger-ui .copy-to-clipboard button {
            background: #444 !important;
            color: #e5e5e5 !important;
          }
        `
          : ""}

        .swagger-ui-container {
          padding: 0;
        }

        /* Hide redundant topbar since we have custom header */
        .swagger-ui .topbar {
          display: none;
        }

        /* Enhance Material theme with custom touches */
        .swagger-ui .info {
          margin: 24px;
          padding: 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          color: white;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }

        .swagger-ui .info .title {
          color: white;
        }

        .swagger-ui .info .description {
          color: rgba(255, 255, 255, 0.95);
        }

        .swagger-ui .info .version {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.875rem;
        }

        /* Material-style scheme container */
        .swagger-ui .scheme-container {
          background: #f5f5f5;
          padding: 20px 24px;
          margin: 24px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        /* Enhance button styles with Material Design */
        .swagger-ui .btn {
          border-radius: 4px;
          text-transform: uppercase;
          font-weight: 500;
          letter-spacing: 0.5px;
          transition: all 0.3s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .swagger-ui .btn:hover {
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
          transform: translateY(-1px);
        }

        .swagger-ui .btn.try-out__btn {
          background-color: #6366f1;
          color: white;
          border: none;
        }

        .swagger-ui .btn.try-out__btn:hover {
          background-color: #4f46e5;
        }

        .swagger-ui .btn.execute {
          background-color: #10b981;
          color: white;
          border: none;
        }

        .swagger-ui .btn.execute:hover {
          background-color: #059669;
        }

        /* Enhance operation blocks with Material shadows */
        .swagger-ui .opblock {
          margin-bottom: 16px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
          transition: box-shadow 0.3s ease;
        }

        .swagger-ui .opblock:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
        }

        .swagger-ui .opblock.opblock-get {
          border-color: #10b981;
        }

        .swagger-ui .opblock.opblock-get .opblock-summary-method {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          font-weight: 600;
        }

        /* Response section styling */
        .swagger-ui .responses-wrapper {
          margin-top: 24px;
          padding-top: 24px;
          border-top: 2px solid #e5e7eb;
        }

        /* Tags section with Material chips */
        .swagger-ui .opblock-tag {
          margin: 24px;
          padding: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
      `}</style>
    </div>
  );
}
