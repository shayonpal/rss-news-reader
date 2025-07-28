---
description: Quickly capture a new idea or bug report with guided questions (Optional Arguments: <type> <brief-description>)
argument-hint: <type> <brief-description>
---

# Capture New Idea or Bug

I have $ARGUMENTS to capture. Invoke the `program-manager` agent to:

## 1. Parse Arguments

- First argument: Type (idea/feature/bug/enhancement)
- Remaining arguments: Initial description
- If no arguments provided, or `Type` seems to not have been provided, start with type question

## 2. Interactive Interview

Ask these questions ONE AT A TIME, waiting for my response between each:

**Important**: After each question, also mention: "(or type 'done' to skip remaining questions)"

If user types 'done', 'skip', 'quit', or similar:
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
8. When did you first notice this?

### Additional for Features:

6. Success criteria? (How do we know it's done?)
7. Any technical constraints to consider?
8. Priority: Quick win or major feature?

## 3. Duplicate Check

Before creating:

- Search Linear for similar issues by keywords
- Check both open and recently closed issues
- If potential duplicate found, ask: "Found similar issue RR-XXX. Is this the same?"

## 4. Create or Update Issue

If new:

- Create in Linear with "Backlog" status
- Apply appropriate labels based on type
- Use action verb title format
- Include all gathered information

If duplicate:

- Add new information as comment to existing issue
- Update labels if needed

## 5. Confirmation

Return: "Created RR-XXX: [title]" or "Updated RR-XXX with additional context"

Remember: Be conversational and gather context naturally. This helps maintain focus with ADHD.
