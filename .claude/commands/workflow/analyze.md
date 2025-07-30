---
description: Analyze a Linear issue or explore an idea in context of the app
argument-hint: <issue-id or idea-description>
---

# Analyze Linear Issue or Explore Ideas

Analyze the Linear issue or idea provided in $ARGUMENTS and prepare an implementation plan or feasibility assessment.

This is a `read-only` mode discussion session. No files will be written during analysis.

## 1. Parse Input

Check $ARGUMENTS:
- If starts with "RR-" or just a number → Linear issue analysis (continue to step 2A)
- If any other text → Idea exploration (go to step 2B)
- If empty → Error: "Please provide a Linear issue ID (e.g., RR-123) or describe an idea to explore"

## 2A. Linear Issue Analysis

If Linear issue ID provided:

1. **Fetch Issue Details**:
   - Get full issue details using Linear MCP server with ALL comments
   - Extract description, labels, priority, dependencies
   - Remember: Issue + comments = living specification
   - Search comments for:
     - Implementation plan patterns (e.g., "implementation plan", "approach:")
     - Test case documentation (e.g., "test cases", "test scenarios:")

2. **Check Related Context**:
   - Parent/child issues
   - Blocking/blocked by relationships
   - Related completed issues for patterns
   - Use smart filtering to avoid context overflow (limit: 20 items)

3. **Update Status**:
   - Move issue to "In Progress" if needed
   - Add analysis start comment with timestamp
   - Format: "Analysis started at [timestamp]"

Then continue to step 3.

## 2B. Idea Exploration

If idea description provided:

1. **Capture the Idea**:
   - Parse the description for key concepts
   - Identify what problem it might solve
   - Consider how it fits with existing features

2. **Stay Read-Only**:
   - DO NOT create Linear issue yet
   - DO NOT modify any code
   - Focus on feasibility analysis

Then continue to step 3.

## 3. Technical Analysis

Gather comprehensive context through read-only analysis:

### Core Context Gathering:

**Documentation Analysis**:
- Search for project documentation across all docs/ directories
- Find API documentation, architecture guides, deployment docs
- Check for existing implementation patterns in similar features
- Identify environment variables and configuration requirements
- Assess documentation coverage and identify gaps

**Database Schema Analysis**:
- List all tables and their relationships
- Check indexes and performance implications
- Analyze data growth patterns and retention
- Identify foreign key relationships and orphaned records
- Review materialized views (especially feed_stats)
- Check RLS policies and user restrictions

**Infrastructure Context**:
- Check PM2 service configurations and health
- Review deployment scripts and processes
- Analyze memory constraints (<100MB free RAM typical)
- Check sync pipeline health and recent errors
- Review API usage patterns and rate limits

### Pattern Analysis:
- Similar features already implemented
- Established coding patterns
- Performance considerations
- Security requirements

## 3.5 Pragmatic Analysis Approach

**Important**: During analysis, provide honest technical assessment:

- **Challenge assumptions**: Question if the idea truly solves the stated problem
- **Consider alternatives**: "Have you considered X instead?"
- **Identify risks**: "This might cause Y issue because..."
- **Be direct**: "This won't work because..." with clear reasoning
- **Suggest improvements**: "What if we modified it to..."
- **Consider effort vs value**: "Is this worth 3 days for 2% improvement?"

This is a collaborative discussion to find the best solution.

## 4. Implementation Planning

Based on issue type:

### For Bugs:
1. Identify affected components
2. Locate likely source files
3. Suggest debugging approach
4. List test scenarios

### For Features:
1. Break down into sub-tasks
2. Identify dependencies
3. Suggest implementation order
4. Define acceptance criteria

### For Enhancements:
1. Find current implementation
2. Assess impact radius
3. Suggest incremental approach
4. Consider backward compatibility

## 5. Dependency Analysis

Check through read-only analysis:
- **Database changes?** → Analyze schema impact, migration needs, RLS policies
- **Sync logic changes?** → Review sync pipeline, API limits, queue processing
- **Infrastructure changes?** → Check deployment requirements, service configs

## 6. Test Planning

Generate comprehensive test cases including:
- Unit tests for new functionality
- Integration tests for sync pipeline
- Edge cases based on requirements
- Acceptance criteria verification
- Performance benchmarks
- Security validations

Format test cases as:
```
**Test Cases**

1. Unit Tests:
   - [Component]: Test description
   - Expected: Result
   - Edge case: Handling

2. Integration Tests:
   - Sync pipeline: Test scenario
   - API endpoints: Expected behavior
   
3. Acceptance Tests:
   - [Criteria from Linear]: How to verify
```

## 7. Implementation Strategy Presentation

Present findings in PM-friendly language:

```
📋 Analysis for RR-XXX: [Title]

📝 Summary:
[2-3 sentences explaining the task]

🎯 Implementation Strategy:
1. [Step 1 - what and why]
2. [Step 2 - what and why]
3. [Step 3 - what and why]

⚠️ Considerations:
- [Technical constraint or risk]
- [Dependency or coordination need]

⏱️ Estimate: [X hours/days]

❓ Questions:
- [Any clarification needed]
```

## 8. Interactive Strategy Refinement

After presenting the implementation strategy, ask:

```
Do you:
1. ✅ Agree with this implementation strategy?
2. 🔄 Want to continue evolving it?
3. 🔍 Want a domain expert review?

Please respond with 1, 2, or 3.
```

### If I choose 2 (Continue evolving):
- Ask for specific concerns or areas to refine
- Iterate on the strategy based on feedback
- Present revised strategy
- Return to the options (1, 2, or 3) until I agree

### If I choose 3 (Domain expert review):
- Ask: "Which domain should I focus on? (e.g., database, infrastructure, UI)"
- Based on my response, provide deep technical analysis:
  - **Database**: Schema optimization, query performance, migration strategy
  - **Infrastructure**: Service architecture, deployment strategy, monitoring
  - **UI**: Component design, accessibility, performance optimization
- Present the technical validation and concerns
- Return to the options (1, 2, or 3) with insights incorporated

### If I choose 1 (Agree):
Proceed to step 9 for finalization.

## 9. Finalize Implementation Strategy

Once I agree with the implementation strategy:

### 9A. Update Linear Issue with Implementation Strategy

Use Linear MCP server to:
1. Add the agreed implementation strategy as a comment on the issue
2. Format the comment clearly with:
   - "**Implementation Strategy (Approved)**"
   - The full strategy details
   - Timestamp of approval

### 9B. Generate Comprehensive Test Cases

Based on:
1. The full Linear issue details (title, description, comments)
2. The agreed implementation strategy
3. Create test cases including:
   - Unit tests with specific file paths
   - Integration tests for affected systems
   - Edge cases and error scenarios
   - Acceptance criteria verification
   - Performance benchmarks where applicable

### 9C. Update Linear Issue with Test Cases

Use Linear MCP server to:
1. Add test cases as a separate comment on the issue
2. Format the comment with:
   - "**Test Cases**"
   - Structured list of all test scenarios
   - Clear pass/fail criteria
   - Test file paths where tests should be implemented

## 10. Final Summary Report

Present a summary of what was accomplished:

```
✅ Analysis Complete for RR-XXX

📝 Actions Taken:
1. ✅ Implementation strategy agreed and documented
2. ✅ Test cases generated comprehensively
3. ✅ Linear issue updated with both strategy and test cases

📋 Next Steps:
- Use /execute RR-XXX to begin implementation
- All test cases are documented in the issue
- Implementation strategy is approved and ready

🔗 Linear Issue: [Link to issue]
```

## 11. Idea Evaluation (for non-issue analysis)

If this was idea exploration (not a Linear issue):

"This idea looks [promising/challenging/interesting]. Would you like me to create a Linear issue for it?"

If yes:
- Create issue using Linear MCP server
- Use the analysis findings for description
- Apply appropriate labels
- Return new issue ID

## Important Notes

- 🚫 NO file operations during analysis
- Use read-only operations exclusively
- Synthesize all analysis from gathered data
- No "waiting for approval" - analysis is complete when presented
- Implementation requires explicit /execute command