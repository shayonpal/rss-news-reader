"use client";

import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md text-center">
        <FileQuestion className="mx-auto mb-4 h-12 w-12 text-gray-400" />
        <h2 className="mb-2 text-2xl font-semibold">Page not found</h2>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          The page you're looking for doesn't exist or has been removed.
        </p>
        <Button onClick={() => router.push("/reader")}>Back to Reader</Button>
      </div>
    </div>
  );
}
