// Type definitions for Next.js routes

/**
 * Internal types used by the Next.js router and Link component.
 * These types are not meant to be used directly.
 * @internal
 */
declare namespace __next_route_internal_types__ {
  type SearchOrHash = `?${string}` | `#${string}`
  type WithProtocol = `${string}:${string}`

  type Suffix = '' | SearchOrHash

  type SafeSlug<S extends string> = S extends `${string}/${string}`
    ? never
    : S extends `${string}${SearchOrHash}`
    ? never
    : S extends ''
    ? never
    : S

  type CatchAllSlug<S extends string> = S extends `${string}${SearchOrHash}`
    ? never
    : S extends ''
    ? never
    : S

  type OptionalCatchAllSlug<S extends string> =
    S extends `${string}${SearchOrHash}` ? never : S

  type StaticRoutes = 
    | `/api/analytics/fetch-stats`
    | `/api/auth/inoreader/logout`
    | `/api/auth/inoreader/authorize`
    | `/api/auth/callback/inoreader`
    | `/api/health/app`
    | `/api/health`
    | `/api/auth/inoreader/status`
    | `/api/debug/data-cleanup`
    | `/api/auth/inoreader/refresh`
    | `/api/health/claude`
    | `/api/inoreader/debug`
    | `/api/inoreader/edit-tag`
    | `/api/inoreader/stream-contents`
    | `/api/inoreader/subscriptions`
    | `/api/inoreader/unread-counts`
    | `/api/sync/metadata`
    | `/api/sync/bidirectional`
    | `/api/logs/inoreader`
    | `/api/inoreader/user-info`
    | `/api/test-api-endpoints`
    | `/api/sync`
    | `/api/test-prompt-config`
    | `/api/test-refresh-stats`
    | `/offline`
    | `/`
    | `/fetch-stats`
    | `/api/test-supabase`
    | `/test-performance`
    | `/test-article-controls`
    | `/test-server-api`
    | `/test-supabase`
    | `/api/health/db`
    | `/api/health`
    | `/api/health/cron`
    | `/health`
  type DynamicRoutes<T extends string = string> = 
    | `/api/articles/${SafeSlug<T>}/fetch-content`
    | `/api/articles/${SafeSlug<T>}/summarize`
    | `/api/sync/status/${SafeSlug<T>}`
    | `/article/${SafeSlug<T>}`

  type RouteImpl<T> = 
    | StaticRoutes
    | SearchOrHash
    | WithProtocol
    | `${StaticRoutes}${SearchOrHash}`
    | (T extends `${DynamicRoutes<infer _>}${Suffix}` ? T : never)
    
}

declare module 'next' {
  export { default } from 'next/types/index.js'
  export * from 'next/types/index.js'

  export type Route<T extends string = string> =
    __next_route_internal_types__.RouteImpl<T>
}

declare module 'next/link' {
  import type { LinkProps as OriginalLinkProps } from 'next/dist/client/link.js'
  import type { AnchorHTMLAttributes, DetailedHTMLProps } from 'react'
  import type { UrlObject } from 'url'

  type LinkRestProps = Omit<
    Omit<
      DetailedHTMLProps<
        AnchorHTMLAttributes<HTMLAnchorElement>,
        HTMLAnchorElement
      >,
      keyof OriginalLinkProps
    > &
      OriginalLinkProps,
    'href'
  >

  export type LinkProps<RouteInferType> = LinkRestProps & {
    /**
     * The path or URL to navigate to. This is the only required prop. It can also be an object.
     * @see https://nextjs.org/docs/api-reference/next/link
     */
    href: __next_route_internal_types__.RouteImpl<RouteInferType> | UrlObject
  }

  export default function Link<RouteType>(props: LinkProps<RouteType>): JSX.Element
}

declare module 'next/navigation' {
  export * from 'next/dist/client/components/navigation.js'

  import type { NavigateOptions, AppRouterInstance as OriginalAppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime.js'
  interface AppRouterInstance extends OriginalAppRouterInstance {
    /**
     * Navigate to the provided href.
     * Pushes a new history entry.
     */
    push<RouteType>(href: __next_route_internal_types__.RouteImpl<RouteType>, options?: NavigateOptions): void
    /**
     * Navigate to the provided href.
     * Replaces the current history entry.
     */
    replace<RouteType>(href: __next_route_internal_types__.RouteImpl<RouteType>, options?: NavigateOptions): void
    /**
     * Prefetch the provided href.
     */
    prefetch<RouteType>(href: __next_route_internal_types__.RouteImpl<RouteType>): void
  }

  export declare function useRouter(): AppRouterInstance;
}
