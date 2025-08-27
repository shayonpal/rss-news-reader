# ADR: Event Propagation Handling in Nested Components

**Date:** 2025-08-27
**Status:** Accepted
**Context:** RR-255 Summary Button Click Events

## Decision

We will use explicit `event.stopPropagation()` and `event.preventDefault()` in child component event handlers to prevent event bubbling that causes unintended parent component behaviors.

## Context

Summary buttons in article cards were triggering parent card navigation when clicked. This created a poor user experience where:

- Users clicking on summary buttons would navigate to article details instead of generating summaries
- The intended summary generation action would not occur
- Users had to understand the difference between clicking on the card vs. the button
- The interface appeared broken due to unexpected navigation behavior

This is a common issue in React applications with nested interactive elements where child element events bubble up to parent click handlers.

## Solution Pattern

### 1. Explicit Event Control in Child Handlers

```typescript
const handleSummaryClick = (event: React.MouseEvent) => {
  event.stopPropagation(); // Prevents bubbling to parent
  event.preventDefault();  // Prevents default browser behavior
  
  // Execute intended action
  onGenerateSummary();
};
```

### 2. Clear Event Boundary Definition

Child components that contain interactive elements must explicitly handle their own events and prevent propagation when the action should not trigger parent behaviors.

### 3. Defensive Programming

Parent components should be designed to handle both scenarios:
- Direct clicks on the parent element
- Clicks that may bubble from child elements

## Benefits

- **Better User Experience**: Buttons perform their intended actions without side effects
- **Predictable Behavior**: Clear separation between parent and child interactions
- **Component Isolation**: Child components can control their own event handling
- **Maintainable Code**: Explicit event handling makes intentions clear

## Consequences

### Positive
- Users can confidently click buttons without unexpected navigation
- Component behaviors are more predictable and testable
- Clear separation of concerns between parent and child interactions

### Negative
- **Requires Careful Implementation**: Developers must remember to add event control
- **More Verbose Code**: Each interactive child needs explicit event handling
- **Potential Over-stopping**: May need to be selective about which events to stop

## Implementation Guidelines

When implementing nested interactive components:

1. **Identify Event Conflicts**: Determine if child actions should trigger parent actions
2. **Stop Propagation Selectively**: Use `stopPropagation()` when child action should not trigger parent
3. **Prevent Default When Needed**: Use `preventDefault()` for actions that shouldn't trigger browser defaults
4. **Document Intent**: Comment why event propagation is being controlled
5. **Test Both Scenarios**: Verify both child actions and parent click behaviors work correctly

## Example Implementation

```typescript
// Child Component (Summary Button)
const SummaryButton = ({ onGenerateSummary }: SummaryButtonProps) => {
  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation(); // Don't navigate to article
    event.preventDefault();  // No default button behavior
    onGenerateSummary();
  };
  
  return (
    <button onClick={handleClick}>
      Generate Summary
    </button>
  );
};

// Parent Component (Article Card)
const ArticleCard = ({ article, onNavigate }: ArticleCardProps) => {
  const handleCardClick = () => {
    onNavigate(article.id);
  };
  
  return (
    <div onClick={handleCardClick} className="cursor-pointer">
      <h3>{article.title}</h3>
      <SummaryButton onGenerateSummary={() => generateSummary(article)} />
    </div>
  );
};
```

## Alternatives Considered

1. **Event Delegation**: Using a single parent handler with target checking
   - More complex logic to determine intended target
   - Harder to maintain with nested structures

2. **Conditional Parent Handlers**: Checking event target in parent
   - Couples parent component to child implementation details
   - Fragile when child component structure changes

3. **Pointer Events CSS**: Using `pointer-events: none` on parent
   - Prevents all parent interactions, not just conflicting ones
   - CSS-based solution for JavaScript behavior concern

## References

- Issue RR-255: Summary button click events
- React SyntheticEvent Documentation
- Event Bubbling and Capturing in React