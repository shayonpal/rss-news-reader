'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/reader');
  }, [router]);

  return (
    <AuthGuard>
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Redirecting to reader...</p>
      </div>
    </AuthGuard>
  );
}
