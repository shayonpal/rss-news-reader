'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Ellipsis,
  Share2,
  ExternalLink,
  BarChart3,
  BookOpen,
  Sparkles,
  Star,
  Copy,
  Flag,
  Archive,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ArticleDropdownLiquidGlassPOC() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [isPartialFeed, setIsPartialFeed] = useState(false);
  const [demoVariant, setDemoVariant] = useState<'default' | 'enhanced'>('enhanced');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleAction = (action: string) => {
    setSelectedAction(action);
    setTimeout(() => {
      setSelectedAction(null);
      setIsOpen(false);
    }, 800);
  };

  const menuItems = [
    {
      id: 'partial-feed',
      type: 'toggle',
      icon: isPartialFeed ? '☑' : '☐',
      label: 'Partial Feed',
      action: () => setIsPartialFeed(!isPartialFeed),
    },
    { type: 'separator' },
    {
      id: 'share',
      icon: Share2,
      label: 'Share',
      action: () => handleAction('share'),
    },
    {
      id: 'open-original',
      icon: ExternalLink,
      label: 'Open Original',
      action: () => handleAction('open-original'),
    },
    {
      id: 'copy-link',
      icon: Copy,
      label: 'Copy Link',
      action: () => handleAction('copy-link'),
    },
    { type: 'separator' },
    {
      id: 'fetch-stats',
      icon: BarChart3,
      label: 'Fetch Stats',
      action: () => handleAction('fetch-stats'),
    },
    {
      id: 'report',
      icon: Flag,
      label: 'Report Issue',
      action: () => handleAction('report'),
    },
    { type: 'separator' },
    {
      id: 'archive',
      icon: Archive,
      label: 'Archive',
      action: () => handleAction('archive'),
      className: 'text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* POC Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-blue-600 to-purple-600 text-white p-4">
        <div className="max-w-6xl mx-auto">
          <div className="font-bold text-lg">🧪 Article Dropdown Liquid Glass POC</div>
          <div className="text-sm opacity-90 mt-1">
            Revamped dropdown with morphing animations and glass materials
          </div>
        </div>
      </div>

      {/* POC Purpose Section */}
      <div className="pt-24 px-4 pb-4">
        <div className="max-w-6xl mx-auto">
          <details className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
            <summary className="p-4 cursor-pointer font-semibold text-gray-900 dark:text-gray-100">
              📋 POC Purpose & Goals
            </summary>
            <div className="px-4 pb-4 space-y-4 text-gray-700 dark:text-gray-300">
              <div>
                <h3 className="font-semibold mb-2">Purpose</h3>
                <p>
                  Demonstrate the Liquid Glass design principles applied to the article detail
                  dropdown menu, showcasing morphing animations, glass materials, and enhanced
                  interaction patterns.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Key Features</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Glass material with 18px blur and 140% saturation</li>
                  <li>Morphing animation emerging from trigger point</li>
                  <li>Transform-origin based on trigger position</li>
                  <li>Enhanced hover states with accent/20 opacity</li>
                  <li>44px minimum touch targets for accessibility</li>
                  <li>Smooth cubic-bezier easing for natural motion</li>
                  <li>Context-aware backdrop adaptation</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Design Decisions</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>18px border radius for modern, soft appearance</li>
                  <li>2px padding for compact but touchable items</li>
                  <li>Subtle scale and translate animation on entry</li>
                  <li>Reduced transparency fallback for accessibility</li>
                  <li>Visual feedback on selection with brief highlight</li>
                </ul>
              </div>
            </div>
          </details>
        </div>
      </div>

      {/* Demo Controls */}
      <div className="max-w-6xl mx-auto px-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">
            Demo Controls
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setDemoVariant('default')}
              className={cn(
                'px-4 py-2 rounded-lg transition-colors',
                demoVariant === 'default'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              )}
            >
              Default Dropdown
            </button>
            <button
              onClick={() => setDemoVariant('enhanced')}
              className={cn(
                'px-4 py-2 rounded-lg transition-colors',
                demoVariant === 'enhanced'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              )}
            >
              Liquid Glass Enhanced
            </button>
          </div>
        </div>
      </div>

      {/* Main Demo Area */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            Article Actions Toolbar Demo
          </h2>
          
          {/* Simulated Article Header */}
          <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">
              Sample Article Title for Testing Dropdown Interaction
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>RSS Feed Name</span>
              <span>•</span>
              <span>5 minutes ago</span>
            </div>
          </div>

          {/* Actions Toolbar */}
          <div className="flex items-center justify-between mb-8">
            {/* Left side actions */}
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <Star className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <Sparkles className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <BookOpen className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Dropdown trigger */}
            <div className="relative">
              <button
                ref={triggerRef}
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                  'p-2 rounded-lg transition-all duration-200',
                  isOpen
                    ? 'bg-gray-100 dark:bg-gray-700'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
                aria-label="More options"
                aria-expanded={isOpen}
                aria-haspopup="menu"
              >
                <Ellipsis className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>

              {/* Dropdown Menu */}
              {isOpen && (
                <div
                  ref={menuRef}
                  className={cn(
                    'absolute right-0 mt-2 min-w-[240px] origin-top-right',
                    demoVariant === 'enhanced'
                      ? 'liquid-glass-dropdown'
                      : 'default-dropdown'
                  )}
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="menu-button"
                >
                  <div className="py-1">
                    {menuItems.map((item, index) => {
                      if (item.type === 'separator') {
                        return (
                          <div
                            key={`separator-${index}`}
                            className="my-1 h-px bg-gray-200 dark:bg-gray-700 opacity-50"
                          />
                        );
                      }

                      const Icon = typeof item.icon === 'string' ? null : item.icon;
                      const isSelected = selectedAction === item.id;

                      return (
                        <button
                          key={item.id}
                          onClick={item.action}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-200',
                            'hover:bg-accent/20 focus:bg-accent/20 focus:outline-none',
                            'min-h-[44px]', // Minimum touch target
                            isSelected && 'bg-green-100 dark:bg-green-900/30',
                            item.className
                          )}
                          role="menuitem"
                        >
                          {typeof item.icon === 'string' ? (
                            <span className="text-base w-5 text-center">{item.icon}</span>
                          ) : Icon ? (
                            <Icon className="h-4 w-4 flex-shrink-0" />
                          ) : null}
                          <span className="flex-1 text-left">{item.label}</span>
                          {isSelected && (
                            <span className="text-xs text-green-600 dark:text-green-400">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status Display */}
          {selectedAction && (
            <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg text-sm text-green-700 dark:text-green-300">
              Action triggered: <strong>{selectedAction}</strong>
            </div>
          )}

          {/* Implementation Notes */}
          <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">
              Implementation Notes
            </h4>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>
                • The enhanced dropdown uses glass morphism with 18px blur radius and 140% saturation
              </p>
              <p>
                • Animation uses scale and translate transforms for smooth morphing effect
              </p>
              <p>
                • Transform-origin is set to top-right to emerge from the trigger button
              </p>
              <p>
                • Each menu item has a 44px minimum height for optimal touch targets
              </p>
              <p>
                • Hover states use accent color at 20% opacity for subtle interaction feedback
              </p>
              <p>
                • The menu includes proper ARIA attributes for accessibility
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Styles */}
      <style jsx global>{`
        /* Liquid Glass Enhanced Dropdown */
        .liquid-glass-dropdown {
          backdrop-filter: blur(18px) saturate(140%);
          -webkit-backdrop-filter: blur(18px) saturate(140%);
          background: rgba(255, 255, 255, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 18px;
          box-shadow: 
            0 10px 40px rgba(0, 0, 0, 0.12),
            0 2px 10px rgba(0, 0, 0, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.5);
          
          /* Morphing animation */
          animation: morphIn 320ms cubic-bezier(0.2, 0, 0.2, 1);
          transform-origin: top right;
          will-change: transform, opacity;
        }

        /* Dark mode adjustments */
        .dark .liquid-glass-dropdown {
          background: rgba(30, 30, 30, 0.75);
          border-color: rgba(255, 255, 255, 0.08);
          box-shadow: 
            0 10px 40px rgba(0, 0, 0, 0.4),
            0 2px 10px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        /* Default dropdown for comparison */
        .default-dropdown {
          background: white;
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          animation: fadeIn 200ms ease-out;
        }

        .dark .default-dropdown {
          background: rgb(31, 41, 55);
          border-color: rgba(255, 255, 255, 0.1);
        }

        /* Morphing animation keyframes */
        @keyframes morphIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        /* Simple fade animation for comparison */
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* Reduced transparency fallback */
        @media (prefers-reduced-transparency: reduce) {
          .liquid-glass-dropdown {
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
            background: rgba(255, 255, 255, 0.98);
          }
          
          .dark .liquid-glass-dropdown {
            background: rgba(30, 30, 30, 0.98);
          }
        }

        /* Reduced motion fallback */
        @media (prefers-reduced-motion: reduce) {
          .liquid-glass-dropdown,
          .default-dropdown {
            animation-duration: 0.01ms !important;
          }
        }

        /* Focus visible styles */
        .liquid-glass-dropdown button:focus-visible,
        .default-dropdown button:focus-visible {
          outline: 2px solid rgb(59, 130, 246);
          outline-offset: -2px;
        }
      `}</style>
    </div>
  );
}