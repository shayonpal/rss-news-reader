/**
 * RR-215: iOS Header Scroll Coordination Service
 * Unified scroll management to prevent conflicts between components
 */

export type ScrollState = "expanded" | "transitioning" | "collapsed";

export interface ScrollPosition {
  scrollY: number;
  scrollState: ScrollState;
  isScrollingUp: boolean;
  contentVisible?: boolean; // New: Content header visibility state
}

export type ScrollListener = (position: ScrollPosition) => void;

export class ScrollCoordinator {
  private subscribers = new Map<string, ScrollListener>();
  private currentScrollY = 0;
  private lastScrollY = 0;
  private scrollListener: ((event: Event) => void) | null = null;
  private ticking = false;
  private animationStates = new Map<string, boolean>();

  constructor() {
    this.handleScroll = this.handleScroll.bind(this);
    this.updateScrollPosition = this.updateScrollPosition.bind(this);
  }

  /**
   * Subscribe a component to scroll updates
   */
  subscribe(id: string, listener: ScrollListener): void {
    this.subscribers.set(id, listener);

    // Add scroll listener if first subscriber
    if (this.subscribers.size === 1) {
      this.addScrollListener();
    }
  }

  /**
   * Unsubscribe a component from scroll updates
   */
  unsubscribe(id: string): void {
    this.subscribers.delete(id);

    // Remove scroll listener if no subscribers
    if (this.subscribers.size === 0) {
      this.removeScrollListener();
    }
  }

  /**
   * Manually update scroll position (for testing)
   */
  updateScrollPosition(scrollY: number): void {
    // Normalize invalid values
    const normalizedScrollY = Math.max(0, isFinite(scrollY) ? scrollY : 0);

    this.lastScrollY = this.currentScrollY;
    this.currentScrollY = normalizedScrollY;

    const scrollState = this.calculateScrollState(normalizedScrollY);
    const isScrollingUp = normalizedScrollY < this.lastScrollY;
    const contentVisible = this.calculateContentVisibility(normalizedScrollY, isScrollingUp);

    const position: ScrollPosition = {
      scrollY: normalizedScrollY,
      scrollState,
      isScrollingUp,
      contentVisible,
    };

    this.notifySubscribers(position);
  }

  /**
   * Get current scroll state
   */
  getScrollState(): ScrollState {
    return this.calculateScrollState(this.currentScrollY);
  }

  /**
   * Check if currently scrolling up
   */
  isScrollingUp(): boolean {
    return this.currentScrollY < this.lastScrollY;
  }

  /**
   * Set animation state for a component (used for throttling during animations)
   */
  setAnimationState(componentId: string, isAnimating: boolean): void {
    this.animationStates.set(componentId, isAnimating);
  }

  /**
   * Get number of active subscribers (for testing)
   */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.removeScrollListener();
    this.subscribers.clear();
    this.animationStates.clear();
  }

  private addScrollListener(): void {
    // Skip adding window scroll listener if we're on article list page
    // since HomePage manually drives scroll updates via article container
    if (typeof window !== "undefined" && window.location.pathname.endsWith("/reader")) {
      console.log('[ScrollCoordinator] Skipping window listener on article list page');
      return;
    }
    
    if (!this.scrollListener) {
      this.scrollListener = this.handleScroll;
      window.addEventListener("scroll", this.scrollListener, { passive: true });
    }
  }

  private removeScrollListener(): void {
    if (this.scrollListener) {
      window.removeEventListener("scroll", this.scrollListener);
      this.scrollListener = null;
    }
  }

  private handleScroll(): void {
    if (!this.ticking) {
      window.requestAnimationFrame(() => {
        this.updateScrollPosition(window.scrollY);
        this.ticking = false;
      });
      this.ticking = true;
    }
  }

  private calculateScrollState(scrollY: number): ScrollState {
    if (scrollY <= 44) {
      return "expanded";
    } else if (scrollY <= 150) {
      return "transitioning";
    } else {
      return "collapsed";
    }
  }

  private calculateContentVisibility(scrollY: number, isScrollingUp: boolean): boolean {
    // Content header visibility logic:
    // - Show when at top (0-50px) OR scrolling up
    // - Hide when scrolling down AND past 50px threshold
    return scrollY < 50 || isScrollingUp;
  }

  private notifySubscribers(position: ScrollPosition): void {
    // Check if any component is animating
    const hasAnimatingComponent = Array.from(
      this.animationStates.values()
    ).some(Boolean);

    this.subscribers.forEach((listener, id) => {
      try {
        // Throttle updates during animations for specific components
        if (hasAnimatingComponent && this.animationStates.get(id)) {
          return; // Skip update for animating component
        }

        listener(position);
      } catch (error) {
        // Silently handle errors to prevent one bad listener from breaking others
        console.error(`ScrollCoordinator: Error in listener ${id}:`, error);
      }
    });
  }
}

// Global singleton instance
let globalCoordinator: ScrollCoordinator | null = null;

/**
 * Get or create the global scroll coordinator instance
 */
export function getScrollCoordinator(): ScrollCoordinator {
  if (!globalCoordinator) {
    globalCoordinator = new ScrollCoordinator();
  }
  return globalCoordinator;
}

/**
 * Reset the global coordinator (for testing)
 */
export function resetScrollCoordinator(): void {
  if (globalCoordinator) {
    globalCoordinator.destroy();
    globalCoordinator = null;
  }
}
