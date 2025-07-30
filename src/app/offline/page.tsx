"use client";

export default function OfflinePage() {
  const handleTryAgain = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-md">
        <h1 className="mb-4 text-2xl font-bold text-foreground">
          You're Offline
        </h1>
        <p className="mb-6 text-muted-foreground">
          It looks like you've lost your internet connection. Don't worry, you
          can still access your cached articles.
        </p>
        <div className="space-y-4">
          <button
            onClick={handleTryAgain}
            className="w-full rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try Again
          </button>
          <a
            href="/"
            className="block w-full rounded-lg border border-border px-4 py-2 text-foreground transition-colors hover:bg-accent"
          >
            Go to Home
          </a>
        </div>
      </div>
    </div>
  );
}
