---
description: Get intelligent task recommendations with deep code awareness via Serena MCP
argument-hint: [cc, quick, impact, bug, feature, tech-debt]
---

# What Should I Work On Next? (Serena-Enhanced)

## 0. Initialize Context

### Activate Serena First

```bash
mcp__serena__activate_project
```

### Parse Filter (if provided)

Check $ARGUMENTS for preference:

- `cc` or `current-cycle` = Show only issues in current cycle
- `quick` or `quick-win` = Show only quick wins
- `impact` or `impactful` = Show high-impact tasks
- `bug` or `bugs` = Show only bug fixes
- `feature` = Show only features
- `tech-debt` = Show refactoring/cleanup tasks
- No argument = Mixed recommendations

## 1. Gather Multi-Source Intelligence

### A. Check Current Work in Progress (TodoWrite)

```
# Check existing todos first
TodoWrite.get_todos()
```

- Review any in-progress tasks
- Check pending items that might relate
- Warn if >3 tasks already in progress
- Consider completing existing work first

### B. Linear Context (via linear-expert)

If filter is `cc` or `current-cycle`:

```
# First get the current cycle for the team
linear-expert.list_cycles(teamId="RSS Reader Team", type="current")

# Then filter issues to only those in current cycle
linear-expert.list_issues(cycle="[current-cycle-id]")
```

Otherwise:

- Get all incomplete issues, sub-issues, and comments
- Check for duplicates and dependencies
- Note recent completions from comments

### C. Git Context (via git-expert)

- Review last 5 commits for recent work
- Check CHANGELOG.md for completed items
- Identify files with recent changes

### D. Code Context (via Serena MCP)

```
# Check code health indicators
mcp__serena__search_for_pattern("TODO|FIXME|HACK|XXX")
mcp__serena__search_for_pattern("@deprecated")
mcp__serena__list_memories()  # Check for known issues in memories
```

### E. Project Memory Context (via Memory MCP)

```
# Search for RSS News Reader related memories
mcp__memory__search_nodes("RSS News Reader")
mcp__memory__search_nodes("rss-news-reader")
mcp__memory__search_nodes("sync issue")
mcp__memory__search_nodes("bug fix")

# Get recent task memories
mcp__memory__search_nodes("RR-")  # Linear issue references
mcp__memory__search_nodes("fixed")
mcp__memory__search_nodes("TODO")
```

### F. Test Health (if applicable)

```bash
npm run test:unit -- --reporter=silent 2>&1 | grep -c "FAIL"
```

## 2. Enhanced Task Scoring

### Quick Win Criteria (Serena-Enhanced)

- **Code Locality**: Use `find_symbol` to check if changes are isolated
- **Reference Count**: Use `find_referencing_symbols` to assess impact
- **File Size**: Prefer tasks in files < 200 lines
- **Test Coverage**: Check if tests already exist
- **Pattern Match**: Similar fixes done before (check memories)

### Complexity Assessment (via Serena)

For each potential task:

1. **Symbol Count**: `get_symbols_overview` on affected files
2. **Cross-file Impact**: `find_referencing_symbols` for key functions
3. **Pattern Complexity**: `search_for_pattern` for similar implementations
4. **Technical Debt**: Check if area has TODOs/FIXMEs

### Impact Scoring (Enhanced)

1. **User Value**: How many users affected?
2. **Code Health**: Will it reduce technical debt?
3. **Developer Velocity**: Will it speed up future work?
4. **Test Coverage**: Will it improve reliability?
5. **Performance**: Check for performance-related patterns

## 3. Task Recommendations with Code Context

```
📋 Current Status:
- Todos in progress: [X]
- Pending todos: [Y]
- Warning: [if >3 in progress]
- Filter: [Current Cycle Only] (if cc filter active)

🎯 Recommended Tasks (with Code & Memory Intelligence):

1. RR-XXX: [Title] ⚡ Quick Win
   - Why: Isolated to single file (article-store.ts)
   - Code: Only affects 1 symbol, 3 references
   - Memory: Found similar fix in memory graph (RR-102)
   - Pattern: 2 similar patterns already fixed
   - Time: ~30 mins
   - Tests: Existing tests cover this area
   - Confidence: HIGH (done before)

2. RR-YYY: [Title] 🐛 Bug Fix
   - Why: Users experiencing issue in SimpleFeedSidebar
   - Code: Root cause in `loadTags()` function
   - Memory: Related to "iOS PWA cache issues" entity
   - Impact: 5 components reference this
   - Time: ~2 hours
   - Risk: Medium - needs careful testing
   - Past Issues: Check memory "ios_pwa_gotchas"

3. RR-ZZZ: [Title] ♻️ Tech Debt
   - Why: 8 TODOs found in this area
   - Code: Can consolidate 3 similar functions
   - Memory: No prior refactoring in this area
   - Benefit: Reduce 200 lines of duplication
   - Time: ~3 hours
   - Tests: Will need test updates
   - Learning Opportunity: New pattern to document
```

## 4. User Action Options

After reviewing the recommendations above, you can:

### 🎯 Start Working on a Task

Reply with: `/analyze RR-XXX` to:

- Get deep code analysis for the issue
- Understand implementation approach
- See affected files and dependencies
- Review acceptance criteria
- Begin implementation planning

### 📋 See More Options

Reply with: `/next-task more` to:

- Get the next batch of 6 recommendations
- Excludes already shown tasks
- Uses same filter criteria

### 🔄 Try Different Filters

Reply with any of these to reanalyze:

- `/next-task cc` - Current cycle issues only
- `/next-task quick` - Only quick wins (<1 hour)
- `/next-task impact` - High-impact tasks only
- `/next-task bug` - Bug fixes only
- `/next-task feature` - New features only
- `/next-task tech-debt` - Refactoring tasks

### 💡 Custom Analysis

Reply with: `/next-task [specific-area]` like:

- `/next-task sync` - Tasks related to sync
- `/next-task ui` - Frontend tasks
- `/next-task performance` - Performance improvements

### Example Responses:

```
> /next-task cc          # Show current cycle only
> /analyze RR-123        # Start working on task
> /next-task more        # See more recommendations
> /next-task quick       # Show only quick wins
> /analyze RR-456        # Switch to different task
```

## 5. Pre-Task Preparation (When Using /analyze)

When task is selected via `/analyze RR-XXX`:

### A. Update Task Tracking

```
# Add to TodoWrite
TodoWrite.add_todo({
  content: "RR-XXX: [Issue Title]",
  status: "in_progress"
})

# Mark any related pending todos as completed
TodoWrite.update_todo(related_id, "completed")
```

### B. Deep Code Analysis

```
# Understand the codebase area
mcp__serena__get_symbols_overview("[relevant-file]")
mcp__serena__find_symbol("[main-function]")
mcp__serena__find_referencing_symbols("[main-function]")
```

### C. Check for Patterns

```
# Find similar implementations
mcp__serena__search_for_pattern("[relevant-pattern]")
# Check memories for known gotchas
mcp__serena__read_memory("project_overview")
```

### D. Update Linear

```
1. Use linear-expert to update status to "In Progress"
2. Add comment with:
   - Start timestamp
   - Affected files (from Serena analysis)
   - Estimated complexity
   - Link to implementation approach
   - Note: "Added to TodoWrite for tracking"
```

## 6. Smart Suggestions

### If No Clear Winner

Based on Serena's code analysis:

- "Found 12 TODOs in authentication flow - create cleanup task?"
- "3 deprecated functions still have 8 references - migration needed?"
- "Test coverage gap in sync-store.ts - add tests?"

### If Everything Blocked

Use Serena to find:

- Commented-out code that could be removed
- Unused exports that could be cleaned
- Console.logs that should be removed
- Type improvements (any → specific types)

## Memory Integration

### A. Check Existing Knowledge (Memory MCP)

Before starting any task:

```
# Search for related past work
mcp__memory__search_nodes("[feature-name]")
mcp__memory__search_nodes("[error-message]")
mcp__memory__search_nodes("[component-name]")

# Open specific relevant memories
mcp__memory__open_nodes(["sync-issues", "oauth-problems", "pwa-fixes"])
```

### B. Write Task Memory (Both MCPs)

After selection, if significant:

**Serena Memory** (project-specific):

```
mcp__serena__write_memory("task_RR-XXX_approach", "[implementation strategy]")
mcp__serena__write_memory("gotcha_[component]", "[discovered issue]")
```

**Memory MCP** (cross-project knowledge):

```
# Create entities for significant findings
mcp__memory__create_entities([{
  "name": "RR-XXX Fix",
  "entityType": "Solution",
  "observations": ["Fixed by updating X", "Root cause was Y"]
}])

# Link related concepts
mcp__memory__create_relations([{
  "from": "RSS News Reader",
  "to": "RR-XXX Fix",
  "relationType": "has_solution"
}])
```

### C. Check Past Learnings

```
# Serena memories (project-specific)
mcp__serena__list_memories()
mcp__serena__read_memory("task_completion_checklist")

# Memory MCP (broader context)
mcp__memory__read_graph()  # If small enough
mcp__memory__search_nodes("lesson learned")
```

## Important Rules

- 🚫 NO file modifications during recommendation
- ✅ Use Serena for code intelligence only
- 📊 Combine Linear data with code reality
- 🧠 Consider code complexity
- Ignore existing documented priority in the issues for your analysis

## Example Serena Workflow

```python
# Pseudo-code for task complexity assessment
for task in linear_tasks:
    if task.involves_file:
        symbols = serena.get_symbols_overview(task.file)
        refs = serena.find_referencing_symbols(task.main_function)

        complexity_score = len(symbols) * 0.3 + len(refs) * 0.7

        if complexity_score < 10:
            task.mark_as_quick_win()

        # Check for similar patterns
        patterns = serena.search_for_pattern(task.pattern)
        if len(patterns) > 2:
            task.confidence = "HIGH"  # Done before
```
