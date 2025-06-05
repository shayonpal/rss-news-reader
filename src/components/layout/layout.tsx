'use client';

import { Header } from './header';
import { Navigation } from './navigation';
import { NetworkStatus } from '../network-status';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Navigation />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <NetworkStatus />
    </div>
  );
}