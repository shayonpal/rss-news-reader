"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, Component, ReactNode } from "react";

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

  useEffect(() => {
    async function fetchSpec() {
      try {
        const response = await fetch("/reader/api-docs/openapi.json");
        if (!response.ok) {
          throw new Error(`Failed to fetch OpenAPI spec: ${response.status}`);
        }
        const data = await response.json();
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
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            📚 RSS News Reader API Documentation
          </h1>
          <p className="mb-1 text-base text-gray-700">
            Interactive REST API documentation powered by OpenAPI 3.0 and
            Swagger UI
          </p>
          <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
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
              Material Theme
            </span>
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
