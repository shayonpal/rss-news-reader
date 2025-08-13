# Code Style and Conventions

## TypeScript Conventions
- **Strict Mode**: Enabled in tsconfig.json
- **No Any Types**: Avoid `any`, use proper types
- **Type Imports**: Use `import type` for type-only imports
- **Interfaces**: Prefer interfaces over type aliases for objects
- **Naming**: PascalCase for types/interfaces, camelCase for variables

## File Organization
```
src/
├── app/          # Next.js App Router pages and API routes
├── components/   # React components (UI primitives in ui/)
├── lib/         # Business logic, utilities, stores
├── types/       # TypeScript type definitions
├── hooks/       # Custom React hooks
└── constants/   # Application constants
```

## Import Aliases
- `@/*` → `./src/*`
- `@/components/*` → Components
- `@/lib/*` → Libraries
- `@/stores/*` → Zustand stores

## React/Next.js Patterns
- **Client Components**: Use `"use client"` directive
- **Server Components**: Default (no directive needed)
- **Hooks**: Custom hooks in `src/hooks/`
- **State**: Zustand for global state
- **Effects**: Proper cleanup in useEffect

## API Routes
- RESTful conventions
- Base path: `/reader/api/*`
- Error handling with proper status codes
- Type-safe responses

## Styling
- **Tailwind CSS**: Utility-first approach
- **Component Classes**: Use cn() helper for conditional classes
- **Theme**: Support light/dark/system modes
- **Responsive**: Mobile-first design

## Testing
- **Test Files**: `*.test.ts` or `*.spec.ts`
- **Mocks**: In `__tests__/helpers/`
- **Coverage**: Aim for critical paths
- **E2E**: Real user workflows

## Comments & Documentation
- **No Comments**: Unless explicitly needed
- **JSDoc**: For complex functions
- **README**: For POCs and features
- **CHANGELOG**: Keep updated

## Git Commit Messages
- **Format**: `type(scope): message`
- **Types**: feat, fix, chore, docs, test
- **Scope**: Component or feature area
- **Message**: Present tense, lowercase

## Security
- **No Secrets**: Never commit API keys
- **Environment**: Use .env files
- **Validation**: Always validate user input
- **XSS**: React handles, but be careful with dangerouslySetInnerHTML