"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Article page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
        <h2 className="mb-2 text-2xl font-semibold">Unable to load article</h2>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          {error.message || "Something went wrong while loading the article."}
        </p>
        <div className="flex justify-center gap-4">
          <Button
            onClick={() => (window.location.href = "/reader")}
            variant="outline"
          >
            Back to Reader
          </Button>
          <Button onClick={reset}>Try Again</Button>
        </div>
      </div>
    </div>
  );
}
