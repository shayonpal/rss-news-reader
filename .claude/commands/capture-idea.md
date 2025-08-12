---
description: Quickly capture a new idea or bug report with guided questions (Optional Arguments: <type> <brief-description>)
argument-hint: <type> <brief-description>
---

# Capture New Idea or Bug

Capture the idea or bug from $ARGUMENTS through an interactive interview process. Use the `linear-expert` agent for Linear operations.

## 1. Parse Arguments

- First argument: Type (idea/feature/bug/enhancement)
- Remaining arguments: Initial description
- If no arguments provided, or `Type` seems to not have been provided, start with type question

## 2. Interactive Interview

Ask these questions ONE AT A TIME, waiting for my response between each:

**Important**: After each question, also mention: "(or type 'done' to skip remaining questions)"

If I type 'done', 'skip', 'quit', or similar:

- Stop asking questions
- Use the information gathered so far
- Make intelligent assumptions for missing data
- Proceed to duplicate check and issue creation

### For All Types:

1. What type is this? (bug/feature/idea/enhancement) [skip if provided]
2. Brief description? [skip if provided]
3. What problem does this solve or what need does it address?
4. What's the user impact? (1=minor, 5=critical)
5. Any existing features this relates to?

### Additional for Bugs:

6. Steps to reproduce?
7. Expected vs actual behavior?
8. When did I first notice this?

### Additional for Features:

6. Success criteria? (How do we know it's done?)
7. Any technical constraints to consider?
8. Priority: Quick win or major feature?

## 3. Duplicate Check

Before creating:

- Use `linear-expert` to search for similar issues by keywords
- Check both open and recently closed issues
- If duplicates found with >70% similarity, ask: "Found similar issue RR-XXX: [title]. Is this the same?"

## 4. Create or Update Issue

If new:

- Use `linear-expert` to create issue with:
  - Status: "Backlog"
  - Title: Action verb format based on gathered info
  - Description: Structured from interview responses
  - Labels: Based on type and category
  - Team ID: RSS Reader team

If duplicate:

- Use `linear-expert` to add comment to existing issue
- Include any new information gathered

## 5. Confirmation

Return: "Created RR-XXX: [title]" or "Updated RR-XXX with additional context"

## Important Notes

- 🚫 NO file operations during this command
- Handle all my interaction conversationally
- linear-expert returns structured data about operations
- Maintain conversational flow for ADHD-friendly experience
- Skip any questions if I provide 'done' at any point
