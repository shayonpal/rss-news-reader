# Proof of Concepts (POCs) - Developer Guidelines

This directory houses experimental work, prototypes, and decision-making code for the RSS News Reader project. POCs serve as living documentation of design decisions, technical explorations, and feature investigations.

## Why POCs Matter

POCs are **decision-making tools** that help us:

- Validate design patterns before production implementation
- Test user interactions and gather feedback
- Document architectural decisions with working examples
- Reduce implementation risk by exploring unknowns upfront
- Create reference implementations for Linear issues

## POC Structure & Organization

### Directory Structure

```
src/app/pocs/
├── README.md                    # This file
├── feature-name/               # Organized by feature, not technology
│   ├── README.md              # Feature-specific documentation
│   ├── page.tsx               # Next.js page (web-accessible)
│   └── components.tsx         # Supporting components if needed
└── another-feature/
    ├── README.md
    └── page.tsx
```

### Naming Convention

- Use **kebab-case** for directory names
- Name by **feature/business problem**, not technology
- Examples: `mark-all-read-liquid-glass`, `ai-summary-redesign`, `mobile-swipe-navigation`

## Creating a New POC

### 1. Planning Phase

Before writing code:

- **Define the problem**: What specific feature or interaction are you prototyping?
- **Set success criteria**: What decisions need to be made? What questions answered?
- **Choose scope**: Keep focused on the core interaction/pattern to test
- **Create Linear issue**: Link POC to implementation tracking

### 2. Directory Setup

```bash
mkdir src/app/pocs/your-feature-name
touch src/app/pocs/your-feature-name/README.md
touch src/app/pocs/your-feature-name/page.tsx
```

### 3. Implementation Requirements

#### Required: Next.js Page Structure

Every POC must include a `page.tsx` file that exports a React component:

```tsx
"use client";

import React, { useState } from "react";

export default function YourFeaturePOC() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* POC Header */}
      <div className="fixed left-0 right-0 top-0 z-50 bg-gradient-to-b from-blue-600 to-purple-600 p-4 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="text-lg font-bold">🧪 Your Feature POC</div>
        </div>
      </div>

      {/* POC Purpose Section - REQUIRED */}
      <div className="px-4 pb-4 pt-24">
        <div className="mx-auto max-w-6xl">
          <details className="mb-6 rounded-lg bg-white shadow-sm dark:bg-gray-800">
            <summary className="cursor-pointer p-4 font-semibold text-gray-900 dark:text-gray-100">
              📋 POC Purpose & Goals
            </summary>
            <div className="space-y-4 px-4 pb-4">
              {/* Document purpose, goals, and decisions here */}
            </div>
          </details>
        </div>
      </div>

      {/* Your POC implementation */}
    </div>
  );
}
```

#### Required: README.md Documentation

Each POC directory must include comprehensive documentation:

```markdown
# Feature Name POC

**Status:** [In Progress/Complete/Implemented]  
**Linear Issue:** RR-XXX  
**Date:** YYYY-MM-DD

## Purpose

Brief description of what you're prototyping and why.

## Key Decisions Made

- Decision 1: Rationale
- Decision 2: Rationale
- Decision 3: Rationale

## Technical Approach

Implementation details, libraries used, patterns explored.

## Next Steps

What needs to happen for production implementation.
```

### 4. Best Practices

#### Visual Design

- **Use consistent header**: Fixed header with gradient background and clear POC identification
- **Include purpose section**: Collapsible details section explaining goals and decisions
- **Support dark mode**: Test both light and dark themes
- **Mobile-first**: Ensure responsive design for all screen sizes

#### Code Quality

- **TypeScript**: Use strict typing, avoid `any`
- **Clean imports**: Only import what you need
- **Inline styles**: Use `<style jsx global>` for POC-specific CSS to avoid global pollution
- **State management**: Keep state local to POC, don't integrate with global stores

#### Documentation

- **Document decisions**: Capture the "why" behind design choices
- **Include screenshots**: Visual documentation helps communicate decisions
- **Link to issues**: Reference related Linear issues for context
- **Update status**: Keep README.md current with implementation status

## Working with POCs

### Iterative Development

1. **Start simple**: Focus on core interaction first
2. **Gather feedback**: Share POC URL with stakeholders early
3. **Iterate quickly**: POCs should evolve fast based on feedback
4. **Document changes**: Update README.md as decisions are finalized

### Collaboration Workflow

1. **Share early**: POCs are accessible at `http://100.96.166.53:3000/reader/pocs/feature-name`
2. **Collect feedback**: Use POC as discussion tool in meetings
3. **Finalize decisions**: Mark decisions as "FINALIZED" in code comments
4. **Create implementation issues**: Reference POC in Linear issues

### Testing & Validation

- **Cross-device testing**: Test on actual iOS devices, not just desktop
- **Accessibility**: Test with screen readers and keyboard navigation
- **Performance**: Monitor for smooth animations and interactions
- **Edge cases**: Test error states, loading states, empty states

## POC Lifecycle

### 1. Development Phase

- Feature exploration and implementation
- Stakeholder feedback and iteration
- Decision documentation

### 2. Decision Phase

- Finalize all design decisions
- Update documentation with rationale
- Create implementation Linear issue

### 3. Implementation Phase

- Use POC as reference during production development
- Copy patterns and code where appropriate
- Update POC status to "Implemented"

### 4. Archive Phase

- Keep POC accessible for future reference
- Document lessons learned
- Consider removal after 6+ months if no longer relevant

## Current POCs

### [mark-all-read-liquid-glass](./mark-all-read-liquid-glass/)

- **Purpose**: Implement iOS 26 Liquid Glass morphing UI patterns for "Mark All Read" functionality
- **Status**: Complete - decisions finalized for RR-179 implementation
- **Key Decisions**: Purple color scheme, 44px standardized heights, morphing confirmation UI
- **URL**: http://100.96.166.53:3000/reader/pocs/mark-all-read-liquid-glass

## Lessons Learned

### What Works Well

- **Iterative feedback loops**: POCs enable rapid design iteration
- **Visual decision making**: Seeing interactions helps make better choices
- **Reduced implementation risk**: Problems discovered early in POC phase
- **Documentation**: POCs serve as living documentation of design decisions

### Common Pitfalls

- **Scope creep**: Keep POCs focused on specific problems
- **Over-engineering**: POCs should be quick and dirty, not production-ready
- **Missing documentation**: Always capture the "why" behind decisions
- **Forgetting mobile**: Always test touch interactions on actual devices

## Tips for Success

1. **Start with the interaction**: Focus on the core UX problem first
2. **Use real data**: Test with realistic content and edge cases
3. **Think in systems**: Consider how patterns will scale across the application
4. **Document everything**: Future you will thank present you for good documentation
5. **Share early and often**: POCs are collaboration tools, not solo work
6. **Test on target devices**: Desktop approximations aren't enough for mobile POCs

---

**Remember**: POCs are decision-making tools, not production code. Their value is in the decisions they help us make and the patterns they help us validate.
