---
description: Get intelligent task recommendations based on current context and priorities
argument-hint: [quick, impact, bug, feature]
---

# What Should I Work On Next?

## 0. Parse Filter (if provided)

Check $ARGUMENTS for mood/preference:

- `quick` or `quick-win` = Show only quick wins
- `impact` or `impactful` = Show high-impact tasks
- `bug` or `bugs` = Show only bug fixes
- `feature` = Show only features
- No argument = Mixed recommendations

Analyze and recommend the best task to work on using data from `linear-expert`.

## 1. Current State Analysis

Use `linear-expert` to get:

- Current "In Progress" items (max 3 allowed)
- If 3 items already in progress, suggest focusing on completing one
- Open items in "Todo" or "Backlog" status
- Recent comments that might indicate priority changes

### Task Selection Criteria

Exclude the following:

- **Exclude personal tracker issues**: Skip issues in project "Quick Ideas" (project ID: quick-ideas-5e31ea73e559)

## 2. Context Considerations

Factor in:

- **Time of day**: Check current time, late night (after 11 PM) = simpler tasks
- **Day of week**: Weekends = lower risk changes
- **Recent activity**: What was just completed?
- **Dependencies**: What's blocking other work?
- **API limits**: Current status from recent sync operations

## 3. Task Categories & Scoring

Categorize and score available tasks:

- **Quick Wins**: < 1 hour, low complexity, immediate impact
- **Bug Fixes**: User-facing issues, sorted by severity
- **Features**: New functionality, sorted by user value
- **Tech Debt**: Refactoring, optimization, cleanup
- **Documentation**: Updates needed after recent changes

### Quick Win Criteria (all must be true):

- Estimated time ≤ 1 hour
- No external dependencies
- Clear implementation path
- Low risk of scope creep
- Can be tested immediately

### High Impact Criteria (scored 1-5):

1. **User Value**: How many users affected? How severely?
2. **Business Value**: Revenue impact? User retention?
3. **Unblocking Power**: Does it unblock other work?
4. **Technical Debt**: Does it prevent future issues?
5. **Visibility**: Will users notice immediately?

Total score 15+ = High Impact

### Time-of-Day Matching:

- Morning (6 AM - 12 PM): Complex features, architecture
- Afternoon (12 PM - 6 PM): Collaborative work, reviews
- Evening (6 PM - 11 PM): Medium tasks, bug fixes
- Late Night (11 PM - 6 AM): UI work, quick wins, isolated tasks

## 4. Recommendation Format

Based on linear-expert data and analysis, present top 3 options:

```
🎯 Recommended Tasks:

1. RR-XXX: [Title] ⚡ Quick Win
   - Why: [Reason this is good now]
   - Time: ~30 mins
   - Impact: [User benefit]

2. RR-YYY: [Title] 🐛 Bug Fix
   - Why: [Urgency reason]
   - Time: ~2 hours
   - Blocked by: Nothing

3. RR-ZZZ: [Title] ✨ Feature
   - Why: [Strategic value]
   - Time: ~4 hours
   - Related: RR-AAA
```

## 5. Selection Actions

When I pick one:

1. Use `linear-expert` to update status to "In Progress"
2. Add comment with start timestamp
3. If it's the 4th item, warn about the 3-item limit
4. Use `doc-search` (read-only) to find relevant documentation

## 6. Special Cases

### If no good tasks available:

- Suggest creating new issues from identified gaps
- Recommend code review of recent changes
- Propose documentation updates

### If everything is blocked:

- List what's causing blocks
- Suggest unblocking actions
- Recommend process improvements

## Important Notes

- 🚫 NO file operations during this command
- Perform all analysis and scoring based on Linear data
- linear-expert provides raw data only
- doc-search provides read-only context
- Consider ADHD patterns - variety helps, but limit WIP