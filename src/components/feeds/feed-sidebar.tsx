'use client';

import { useState, useEffect } from 'react';
import { FeedList } from './feed-list';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';

interface FeedSidebarProps {
  selectedFeedId: string | null;
  onFeedSelect: (feedId: string | null) => void;
}

export function FeedSidebar({ selectedFeedId, onFeedSelect }: FeedSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle touch events for swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch.clientX < 20) { // Start swipe from edge
      setStartX(touch.clientX);
      setDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    const touch = e.touches[0];
    setCurrentX(touch.clientX);
    
    // Open drawer if swiped right more than 50px
    if (touch.clientX - startX > 50) {
      setIsOpen(true);
      setDragging(false);
    }
  };

  const handleTouchEnd = () => {
    setDragging(false);
    setStartX(0);
    setCurrentX(0);
  };

  // Handle swipe to close
  const handleDrawerTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setStartX(touch.clientX);
    setDragging(true);
  };

  const handleDrawerTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    const touch = e.touches[0];
    setCurrentX(touch.clientX);
    
    // Close drawer if swiped left more than 50px
    if (startX - touch.clientX > 50) {
      setIsOpen(false);
      setDragging(false);
    }
  };

  const handleFeedSelect = (feedId: string | null) => {
    onFeedSelect(feedId);
    if (isMobile) {
      setIsOpen(false);
    }
  };

  if (!isMobile) {
    // Desktop/Tablet: Persistent sidebar
    return (
      <aside className="hidden md:flex w-64 lg:w-80 border-r bg-background">
        <FeedList
          selectedFeedId={selectedFeedId}
          onFeedSelect={handleFeedSelect}
          className="w-full"
        />
      </aside>
    );
  }

  // Mobile: Drawer with swipe gestures
  return (
    <>
      {/* Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden fixed top-4 left-4 z-40"
        onClick={() => setIsOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-background shadow-lg",
          "transform transition-transform duration-300 ease-in-out md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        onTouchStart={handleDrawerTouchStart}
        onTouchMove={handleDrawerTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Close Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4"
          onClick={() => setIsOpen(false)}
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Feed List */}
        <div className="h-full pt-16">
          <FeedList
            selectedFeedId={selectedFeedId}
            onFeedSelect={handleFeedSelect}
            className="h-full"
          />
        </div>
      </div>

      {/* Swipe Area Indicator (for opening drawer) */}
      <div
        className="fixed inset-y-0 left-0 w-5 z-30 md:hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </>
  );
}