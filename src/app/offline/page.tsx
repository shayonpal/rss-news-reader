'use client';

export default function OfflinePage() {
  const handleTryAgain = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-md">
        <h1 className="text-2xl font-bold text-foreground mb-4">
          You're Offline
        </h1>
        <p className="text-muted-foreground mb-6">
          It looks like you've lost your internet connection. Don't worry, you can still access your cached articles.
        </p>
        <div className="space-y-4">
          <button
            onClick={handleTryAgain}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
          <a
            href="/"
            className="block w-full px-4 py-2 border border-border text-foreground rounded-lg hover:bg-accent transition-colors"
          >
            Go to Home
          </a>
        </div>
      </div>
    </div>
  );
}