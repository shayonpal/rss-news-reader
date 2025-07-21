'use client';

import { Button } from '@/components/ui/button';
import { FileQuestion } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <FileQuestion className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Article not found</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          The article you're looking for doesn't exist or has been removed.
        </p>
        <Button onClick={() => router.push('/reader' as any)}>
          Back to Reader
        </Button>
      </div>
    </div>
  );
}