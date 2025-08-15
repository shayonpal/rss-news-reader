"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, Component, ReactNode } from "react";

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

// Import CSS (this will be included in the dynamic import)
import "swagger-ui-react/swagger-ui.css";

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
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">
          RSS News Reader API Documentation
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Interactive API documentation for health endpoints
        </p>
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
            />
          </ErrorBoundary>
        )}
      </div>

      <style jsx global>{`
        .swagger-ui-container {
          padding: 0;
        }

        .swagger-ui .topbar {
          display: none;
        }

        .swagger-ui .info {
          margin: 20px 0;
        }

        .swagger-ui .scheme-container {
          background: #fafafa;
          padding: 20px;
          margin-bottom: 20px;
        }

        .swagger-ui .btn.try-out__btn {
          background-color: #4f46e5;
          color: white;
          border: none;
        }

        .swagger-ui .btn.try-out__btn:hover {
          background-color: #3730a3;
        }

        .swagger-ui .btn.execute {
          background-color: #10b981;
          color: white;
          border: none;
        }

        .swagger-ui .btn.execute:hover {
          background-color: #059669;
        }

        .swagger-ui .opblock.opblock-get {
          border-color: #10b981;
        }

        .swagger-ui .opblock.opblock-get .opblock-summary-method {
          background: #10b981;
        }
      `}</style>
    </div>
  );
}
