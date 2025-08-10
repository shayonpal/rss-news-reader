'use client';

import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  CircleCheckBig, 
  AlertTriangle, 
  Loader2, 
  ChevronLeft,
  Inbox,
  Eye,
  EyeOff,
  Hash,
  Rss,
  ArrowUp,
  X,
  Sun,
  Moon
} from 'lucide-react';

type PurpleShade = 'light' | 'medium' | 'dark' | 'deep';

const purpleShades: { value: PurpleShade; label: string }[] = [
  { value: 'light', label: 'Light Purple' },
  { value: 'medium', label: 'Medium Purple' },
  { value: 'dark', label: 'Dark Purple' },
  { value: 'deep', label: 'Deep Purple' },
];

export default function LiquidGlassPOC() {
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('unread');
  const [markAllState, setMarkAllState] = useState<'normal' | 'confirming' | 'loading'>('normal');
  const [markAllTopicState, setMarkAllTopicState] = useState<'normal' | 'confirming' | 'loading'>('normal');
  const [scrolled, setScrolled] = useState(false);
  const [selectedPurple, setSelectedPurple] = useState<PurpleShade>('light'); // FINALIZED: Light purple
  const [showMorphingDemo, setShowMorphingDemo] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [feedMarkedAsRead, setFeedMarkedAsRead] = useState(false);
  const [topicMarkedAsRead, setTopicMarkedAsRead] = useState(false);
  const [demoMarkedAsRead, setDemoMarkedAsRead] = useState(false);
  
  // Toggle dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);
  
  // Simulate scroll effect
  React.useEffect(() => {
    const timer = setInterval(() => {
      setScrolled(prev => !prev);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // FINALIZED: Mark all read interaction with toast integration
  const handleMarkAllReadConfirm = (
    setter: React.Dispatch<React.SetStateAction<any>>, 
    markAsReadSetter: React.Dispatch<React.SetStateAction<boolean>>,
    feedName: string
  ) => {
    setter('loading');
    
    // Simulate API call with random success/failure
    setTimeout(() => {
      const isSuccess = Math.random() > 0.2; // 80% success rate for demo
      
      if (isSuccess) {
        // SUCCESS: Show success toast, set to disabled state
        toast.success('All articles have been marked as read', {
          duration: 3500,
          style: { background: '#dcfce7' }
        });
        markAsReadSetter(true);
        setter('normal'); // Button becomes disabled via the markAsReadSetter
      } else {
        // FAILURE: Show error toast, return to normal state
        toast.error('Failed to mark articles as read • Check your connection', {
          duration: 6000,
          style: { background: '#fee2e2' }
        });
        setter('normal'); // Return to normal state so user can retry
      }
    }, 1500);
  };

  // Cancel morphing
  const handleMorphingCancel = (setter: React.Dispatch<React.SetStateAction<any>>) => {
    setter('normal');
  };


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Add custom styles for this POC */}
      <style jsx global>{`
        /* CSS Custom Properties for standardized heights */
        :root {
          --glass-control-height: 44px;
          --glass-control-border-radius: 22px;
          --glass-segment-height: 44px;
          --glass-segment-border-radius: 22px;
          --glass-dropdown-height: 44px;
          --glass-dropdown-border-radius: 12px;
        }

        /* Glass button styles with standardized dimensions */
        .glass-mark-all-read-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          padding: 0 16px;
          height: var(--glass-control-height);
          min-width: var(--glass-control-height);
          border-radius: var(--glass-control-border-radius);
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
          background: transparent;
          cursor: pointer;
          transform: translateZ(0);
          will-change: transform, background-color;
          text-align: center;
          white-space: nowrap;
        }
        
        .glass-mark-all-read-btn:active:not(:disabled) {
          transform: scale(0.95);
        }
        
        /* Fixed width for desktop to prevent jarring */
        @media (min-width: 640px) {
          .glass-mark-all-read-btn {
            min-width: 140px;
          }
        }
        
        /* Purple variations - FINALIZED: Light purple for light mode, muted for dark mode */
        .glass-mark-all-read-btn.purple-light {
          color: ${darkMode ? 'rgb(167, 139, 250)' : 'rgb(139, 92, 246)'};
          border: 1px solid ${darkMode ? 'rgba(167, 139, 250, 0.3)' : 'rgba(139, 92, 246, 0.3)'};
        }
        .glass-mark-all-read-btn.purple-light:hover:not(:disabled) {
          background: ${darkMode ? 'rgba(167, 139, 250, 0.12)' : 'rgba(139, 92, 246, 0.1)'};
          border-color: ${darkMode ? 'rgba(167, 139, 250, 0.5)' : 'rgba(139, 92, 246, 0.4)'};
        }
        
        .glass-mark-all-read-btn.purple-medium {
          color: ${darkMode ? 'rgb(221, 214, 254)' : 'rgb(124, 58, 237)'};
          border: 1px solid ${darkMode ? 'rgba(221, 214, 254, 0.4)' : 'rgba(124, 58, 237, 0.3)'};
        }
        .glass-mark-all-read-btn.purple-medium:hover:not(:disabled) {
          background: ${darkMode ? 'rgba(221, 214, 254, 0.15)' : 'rgba(124, 58, 237, 0.1)'};
          border-color: ${darkMode ? 'rgba(221, 214, 254, 0.6)' : 'rgba(124, 58, 237, 0.4)'};
        }
        
        .glass-mark-all-read-btn.purple-dark {
          color: ${darkMode ? 'rgb(237, 233, 254)' : 'rgb(109, 40, 217)'};
          border: 1px solid ${darkMode ? 'rgba(237, 233, 254, 0.4)' : 'rgba(109, 40, 217, 0.3)'};
        }
        .glass-mark-all-read-btn.purple-dark:hover:not(:disabled) {
          background: ${darkMode ? 'rgba(237, 233, 254, 0.15)' : 'rgba(109, 40, 217, 0.1)'};
          border-color: ${darkMode ? 'rgba(237, 233, 254, 0.6)' : 'rgba(109, 40, 217, 0.4)'};
        }
        
        .glass-mark-all-read-btn.purple-deep {
          color: ${darkMode ? 'rgb(245, 243, 255)' : 'rgb(91, 33, 182)'};
          border: 1px solid ${darkMode ? 'rgba(245, 243, 255, 0.4)' : 'rgba(91, 33, 182, 0.3)'};
        }
        .glass-mark-all-read-btn.purple-deep:hover:not(:disabled) {
          background: ${darkMode ? 'rgba(245, 243, 255, 0.15)' : 'rgba(91, 33, 182, 0.1)'};
          border-color: ${darkMode ? 'rgba(245, 243, 255, 0.6)' : 'rgba(91, 33, 182, 0.4)'};
        }
        
        /* Touch-first interactions - remove hover on touch devices */
        @media (hover: none) and (pointer: coarse) {
          .glass-mark-all-read-btn:hover {
            background: transparent !important;
            border-color: inherit !important;
          }
        }
        
        /* Segmented control using standardized height */
        .glass-segment {
          height: var(--glass-segment-height);
        }
        
        /* Confirmation state - Always muted pastel red regardless of color scheme */
        .glass-mark-all-read-btn.confirming {
          background: rgba(255, 182, 193, 0.2) !important;
          color: rgb(220, 53, 69) !important;
          border: 1px solid rgba(255, 182, 193, 0.5) !important;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        .dark .glass-mark-all-read-btn.confirming {
          background: rgba(255, 182, 193, 0.15) !important;
          color: rgb(255, 123, 123) !important;
          border: 1px solid rgba(255, 182, 193, 0.4) !important;
        }
        
        /* Mobile view - expand to full width when confirming */
        @media (max-width: 639px) {
          .glass-mark-all-read-btn.confirming {
            flex: 1;
            min-width: 100%;
          }
        }
        
        /* Enhanced disabled state with better contrast */
        .glass-mark-all-read-btn:disabled {
          cursor: not-allowed;
          opacity: 0.4;
          filter: grayscale(100%) contrast(1.3);
        }
        
        .dark .glass-mark-all-read-btn:disabled {
          opacity: 0.65;
          filter: grayscale(100%) contrast(1.6);
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }

        /* Enhanced glass nav for POC */
        .glass-nav-poc {
          backdrop-filter: blur(14px) saturate(140%);
          -webkit-backdrop-filter: blur(14px) saturate(140%);
          background: rgba(255, 255, 255, 0.16);
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
          transition: all 200ms ease;
        }
        
        .glass-nav-poc.is-scrolled {
          background: rgba(255, 255, 255, 0.20);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }
        
        .dark .glass-nav-poc {
          background: rgba(0, 0, 0, 0.16);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        
        .dark .glass-nav-poc.is-scrolled {
          background: rgba(0, 0, 0, 0.20);
        }

        /* Segmented control collapse animation */
        .segmented-control-wrapper {
          transition: all 320ms cubic-bezier(0.2, 0, 0.2, 1);
          overflow: hidden;
        }
        
        .segmented-control-wrapper.collapsed {
          width: 0;
          opacity: 0;
          margin-right: 0;
          transform: scale(0.9);
        }
        
      `}</style>

      {/* POC Header with Theme Toggle */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-purple-600 to-blue-600 text-white p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <div className="font-bold text-lg">🎨 Liquid Glass POC - iOS 26 Morphing Pattern</div>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* POC Purpose Section */}
      <div className="pt-24 px-4 pb-4">
        <div className="max-w-6xl mx-auto">
          <details className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
            <summary className="p-4 cursor-pointer font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-lg">
              📋 POC Purpose & Goals
            </summary>
            <div className="px-4 pb-4 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">🎯 Primary Goal</h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Implement "Mark All Read" functionality for topic/tag-filtered article views using iOS 26 Liquid Glass design patterns with morphing UI interactions.
                </p>
              </div>
              
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">✅ Key Decisions Finalized</h3>
                <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
                  <li>• <strong>Design System:</strong> Purple color scheme with proper dark mode contrast</li>
                  <li>• <strong>Standardization:</strong> 44px height for all controls via CSS custom properties</li>
                  <li>• <strong>Interaction Flow:</strong> Morphing UI pattern (no separate modals or popups)</li>
                  <li>• <strong>Success/Failure UX:</strong> Toast notifications with appropriate state handling</li>
                  <li>• <strong>Touch-First:</strong> Optimized for iOS/iPadOS PWA with tap-outside-to-cancel</li>
                </ul>
              </div>
              
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">🔨 Implementation Target</h3>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Linear Issue:</strong> RR-179 - This POC serves as the reference implementation for integrating into the main codebase.
                </p>
              </div>
            </div>
          </details>
        </div>
      </div>

      {/* NEW: Improved Morphing Demo */}
      <div className="px-4 pb-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">
            ✨ iOS 26 Morphing Pattern - Segmented Control Collapse
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Click "Mark All Read" to see the segmented control (All/Unread/Read) collapse while the button morphs. 
            Tap outside to cancel confirmation.
          </p>
          
          {/* Morphing Demo Container */}
          <div className={`glass-nav-poc sticky top-20 z-40 px-4 py-3`} 
               onClick={(e) => {
                 if (showMorphingDemo && !e.currentTarget.querySelector('.glass-mark-all-read-btn')?.contains(e.target as Node)) {
                   setShowMorphingDemo(false);
                 }
               }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Rss className="w-4 h-4" />
                    TechCrunch
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">142 unread articles</p>
                </div>
              </div>
              
              {/* Right side controls */}
              <div className="flex items-center gap-2">
                {/* Segmented Control - Collapses when confirming */}
                <div className={`segmented-control-wrapper ${showMorphingDemo ? 'collapsed' : ''}`}>
                  <div className="glass-segment glass-segment-3" data-value={readFilter}>
                    <div className="glass-segment-indicator" style={{
                      transform: `translateX(${readFilter === 'all' ? '0' : readFilter === 'unread' ? '100%' : '200%'})`
                    }} />
                    <button 
                      className="glass-segment-btn"
                      onClick={() => setReadFilter('all')}
                      data-active={readFilter === 'all'}
                    >
                      <Inbox className="w-3.5 h-3.5 sm:hidden" />
                      <span className="hidden sm:inline-flex items-center gap-1.5">
                        <Inbox className="w-3.5 h-3.5" />
                        All
                      </span>
                    </button>
                    <button 
                      className="glass-segment-btn"
                      onClick={() => setReadFilter('unread')}
                      data-active={readFilter === 'unread'}
                    >
                      <EyeOff className="w-3.5 h-3.5 sm:hidden" />
                      <span className="hidden sm:inline-flex items-center gap-1.5">
                        <EyeOff className="w-3.5 h-3.5" />
                        Unread
                      </span>
                    </button>
                    <button 
                      className="glass-segment-btn"
                      onClick={() => setReadFilter('read')}
                      data-active={readFilter === 'read'}
                    >
                      <Eye className="w-3.5 h-3.5 sm:hidden" />
                      <span className="hidden sm:inline-flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        Read
                      </span>
                    </button>
                  </div>
                </div>
                
                {/* Mark All Read / Confirmation Button */}
                {showMorphingDemo ? (
                  <button
                    className={`glass-mark-all-read-btn confirming`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMorphingDemo(false);
                      // Simulate the same success flow as other examples
                      setTimeout(() => {
                        toast.success('All articles have been marked as read', {
                          duration: 3500,
                          style: { background: '#dcfce7' }
                        });
                        setDemoMarkedAsRead(true);
                      }, 300);
                    }}
                  >
                    <CircleCheckBig className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Confirm?</span>
                    <span className="sm:hidden">Confirm?</span>
                  </button>
                ) : (
                  <button
                    className={`glass-mark-all-read-btn purple-${selectedPurple}`}
                    onClick={() => setShowMorphingDemo(true)}
                    disabled={demoMarkedAsRead}
                  >
                    <CircleCheckBig className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Mark All Read</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-300">
              <strong>iOS 26 Pattern:</strong> Only the segmented control collapses. The button morphs in-place 
              (desktop) or expands to full-width (mobile). No jarring horizontal movement. Tap outside to cancel.
            </p>
          </div>
        </div>
      </div>

      {/* Example 1: Feed-Filtered View */}
      <div className="px-4 pb-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            Example 1: Feed-Filtered Article List
          </h2>
          
          {/* Glass Navigation Header */}
          <div className={`glass-nav-poc ${scrolled ? 'is-scrolled' : ''} sticky top-20 z-40 px-4 py-3`}
               onClick={(e) => {
                 if (markAllState === 'confirming' && !e.currentTarget.querySelector('.glass-mark-all-read-btn')?.contains(e.target as Node)) {
                   setMarkAllState('normal');
                 }
               }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Rss className="w-4 h-4" />
                    The Verge
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">89 unread articles</p>
                </div>
              </div>
              
              {/* Right side controls */}
              <div className="flex items-center gap-2">
                {/* Segmented Control */}
                <div className={`segmented-control-wrapper ${markAllState === 'confirming' ? 'collapsed' : ''}`}>
                  <div className="glass-segment glass-segment-3" data-value={readFilter}>
                    <div className="glass-segment-indicator" style={{
                      transform: `translateX(${readFilter === 'all' ? '0' : readFilter === 'unread' ? '100%' : '200%'})`
                    }} />
                    <button 
                      className="glass-segment-btn"
                      onClick={() => setReadFilter('all')}
                      data-active={readFilter === 'all'}
                    >
                      <Inbox className="w-3.5 h-3.5 sm:hidden" />
                      <span className="hidden sm:inline-flex items-center gap-1.5">
                        <Inbox className="w-3.5 h-3.5" />
                        All
                      </span>
                    </button>
                    <button 
                      className="glass-segment-btn"
                      onClick={() => setReadFilter('unread')}
                      data-active={readFilter === 'unread'}
                    >
                      <EyeOff className="w-3.5 h-3.5 sm:hidden" />
                      <span className="hidden sm:inline-flex items-center gap-1.5">
                        <EyeOff className="w-3.5 h-3.5" />
                        Unread
                      </span>
                    </button>
                    <button 
                      className="glass-segment-btn"
                      onClick={() => setReadFilter('read')}
                      data-active={readFilter === 'read'}
                    >
                      <Eye className="w-3.5 h-3.5 sm:hidden" />
                      <span className="hidden sm:inline-flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        Read
                      </span>
                    </button>
                  </div>
                </div>
                
                {/* Mark All Read Button */}
                {markAllState === 'confirming' ? (
                  <button
                    className={`glass-mark-all-read-btn confirming`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkAllReadConfirm(setMarkAllState, setFeedMarkedAsRead, 'The Verge');
                    }}
                  >
                    <CircleCheckBig className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Confirm?</span>
                    <span className="sm:hidden">Confirm?</span>
                  </button>
                ) : (
                  <button
                    className={`glass-mark-all-read-btn purple-${selectedPurple} ${markAllState}`}
                    onClick={() => setMarkAllState('confirming')}
                    disabled={markAllState === 'loading' || feedMarkedAsRead}
                  >
                    {markAllState === 'loading' ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span className="hidden sm:inline">Marking...</span>
                      </>
                    ) : (
                      <>
                        <CircleCheckBig className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Mark All Read</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Dummy Articles */}
          <div className="mt-4 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                  Sample Article Title {i}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  This is a preview of the article content that would appear here...
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>2 hours ago</span>
                  <span>3 min read</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Example 2: Topic-Filtered View */}
      <div className="px-4 pb-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            Example 2: Topic-Filtered Article List
          </h2>
          
          {/* Glass Navigation Header */}
          <div className={`glass-nav-poc ${!scrolled ? 'is-scrolled' : ''} sticky top-20 z-40 px-4 py-3`}
               onClick={(e) => {
                 if (markAllTopicState === 'confirming' && !e.currentTarget.querySelector('.glass-mark-all-read-btn')?.contains(e.target as Node)) {
                   setMarkAllTopicState('normal');
                 }
               }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    Artificial Intelligence
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">67 unread articles from multiple feeds</p>
                </div>
              </div>
              
              {/* Right side controls */}
              <div className="flex items-center gap-2">
                {/* Segmented Control */}
                <div className={`segmented-control-wrapper ${markAllTopicState === 'confirming' ? 'collapsed' : ''}`}>
                  <div className="glass-segment glass-segment-3" data-value={readFilter}>
                    <div className="glass-segment-indicator" style={{
                      transform: `translateX(${readFilter === 'all' ? '0' : readFilter === 'unread' ? '100%' : '200%'})`
                    }} />
                    <button 
                      className="glass-segment-btn"
                      onClick={() => setReadFilter('all')}
                      data-active={readFilter === 'all'}
                    >
                      <Inbox className="w-3.5 h-3.5 sm:hidden" />
                      <span className="hidden sm:inline-flex items-center gap-1.5">
                        <Inbox className="w-3.5 h-3.5" />
                        All
                      </span>
                    </button>
                    <button 
                      className="glass-segment-btn"
                      onClick={() => setReadFilter('unread')}
                      data-active={readFilter === 'unread'}
                    >
                      <EyeOff className="w-3.5 h-3.5 sm:hidden" />
                      <span className="hidden sm:inline-flex items-center gap-1.5">
                        <EyeOff className="w-3.5 h-3.5" />
                        Unread
                      </span>
                    </button>
                    <button 
                      className="glass-segment-btn"
                      onClick={() => setReadFilter('read')}
                      data-active={readFilter === 'read'}
                    >
                      <Eye className="w-3.5 h-3.5 sm:hidden" />
                      <span className="hidden sm:inline-flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        Read
                      </span>
                    </button>
                  </div>
                </div>
                
                {/* Mark All Read Button for Topic */}
                {markAllTopicState === 'confirming' ? (
                  <button
                    className={`glass-mark-all-read-btn confirming`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkAllReadConfirm(setMarkAllTopicState, setTopicMarkedAsRead, 'Artificial Intelligence');
                    }}
                  >
                    <CircleCheckBig className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Confirm?</span>
                    <span className="sm:hidden">Confirm?</span>
                  </button>
                ) : (
                  <button
                    className={`glass-mark-all-read-btn purple-${selectedPurple} ${markAllTopicState}`}
                    onClick={() => setMarkAllTopicState('confirming')}
                    disabled={markAllTopicState === 'loading' || topicMarkedAsRead}
                  >
                    {markAllTopicState === 'loading' ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span className="hidden sm:inline">Marking...</span>
                      </>
                    ) : (
                      <>
                        <CircleCheckBig className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Mark All Read</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Dummy Articles from different feeds */}
          <div className="mt-4 space-y-3">
            {[
              { feed: 'The Verge', time: '1 hour ago' },
              { feed: 'Ars Technica', time: '3 hours ago' },
              { feed: 'Wired', time: '5 hours ago' }
            ].map((item, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <Rss className="w-3 h-3" />
                  <span>{item.feed}</span>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                  AI Article from {item.feed}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Content about artificial intelligence and machine learning...
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>{item.time}</span>
                  <span>5 min read</span>
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                    #AI
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* Purple Shades Demo */}
      <div className="px-4 pb-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            Purple Variations (Currently using: <span className="capitalize">{selectedPurple}</span>)
          </h2>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {purpleShades.map((shade) => (
                  <button
                    key={shade.value}
                    onClick={() => setSelectedPurple(shade.value)}
                    className={`px-4 py-3 rounded-lg border-2 transition-all ${
                      selectedPurple === shade.value 
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                    }`}
                  >
                    <div className="space-y-2">
                      <span className="block font-medium text-sm">{shade.label}</span>
                      <div className={`glass-mark-all-read-btn purple-${shade.value} pointer-events-none text-xs`}>
                        <CircleCheckBig className="h-3 w-3" />
                        <span>Preview</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              
              <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  <strong>Enhanced for Dark Mode:</strong> Purple shades automatically adjust with better contrast 
                  for dark backgrounds. The confirmation state always uses muted pastel red regardless of theme.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Button States Demo */}
      <div className="px-4 pb-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            Button States Demo - Touch-First Design
          </h2>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Normal State (44px height)</h3>
                <button className={`glass-mark-all-read-btn purple-${selectedPurple}`}>
                  <CircleCheckBig className="h-3.5 w-3.5" />
                  <span>Mark All Read</span>
                </button>
              </div>
              
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Touch Feedback (tap to see immediate scale effect before morphing)
                </h3>
                <button className={`glass-mark-all-read-btn purple-${selectedPurple}`}>
                  <CircleCheckBig className="h-3.5 w-3.5" />
                  <span>Mark All Read</span>
                </button>
              </div>
              
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Confirming State</h3>
                <button className={`glass-mark-all-read-btn confirming`}>
                  <CircleCheckBig className="h-3.5 w-3.5" />
                  <span>Confirm?</span>
                </button>
              </div>
              
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Loading State</h3>
                <button className={`glass-mark-all-read-btn purple-${selectedPurple}`} disabled>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Marking...</span>
                </button>
              </div>
              
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Enhanced Disabled State (Better contrast)
                </h3>
                <button className={`glass-mark-all-read-btn purple-${selectedPurple}`} disabled>
                  <CircleCheckBig className="h-3.5 w-3.5" />
                  <span>Mark All Read</span>
                </button>
              </div>
              
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Mobile Confirmation (full width, resize window)
                </h3>
                <div className="flex gap-2 max-w-xs">
                  <button className={`glass-mark-all-read-btn confirming`}>
                    <CircleCheckBig className="h-3.5 w-3.5" />
                    <span>Confirm?</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-300">
                  <strong>Key Updates:</strong> 44px height matches segmented control, enhanced disabled contrast, 
                  simplified confirmation text ("Confirm?" only), removed cancel button (tap outside to cancel), 
                  and proper touch-first interactions.
                </p>
              </div>
              
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  ✅ FINALIZED: Mark All Read Interaction Flow
                </h4>
                <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                  <p><strong>Success:</strong> Button → disabled state + success toast "All articles have been marked as read"</p>
                  <p><strong>Failure:</strong> Button → returns to normal state + error toast "Failed to mark articles as read • Check your connection" (allows retry)</p>
                  <p><strong>UX Rationale:</strong> Failures return to normal state so users can retry immediately. Success disables the button since action is completed.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pb-16"></div>
    </div>
  );
}