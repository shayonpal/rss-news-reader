---
description: Analyze a Linear issue or explore an idea in context of the app (Argument: <issue-id> or <idea-description>)
argument-hint: <issue-id or idea-description>
---

# Analyze Linear Issue or Explore Ideas

Analyze the Linear issue or idea provided in $ARGUMENTS and prepare an implementation plan or feasibility assessment.

## 1. Parse Input

Check $ARGUMENTS:
- If starts with "RR-" → Linear issue analysis (continue to step 2A)
- If any other text → Idea exploration (go to step 2B)
- If empty → Error: "Please provide a Linear issue ID (e.g., RR-123) or describe an idea to explore"

## 2A. Linear Issue Analysis

If Linear issue ID provided, invoke the `program-manager` agent to:

1. **Fetch Issue Details**:
   - Get full issue from Linear using ID
   - If not found, check if it's a typo (suggest similar IDs)
   - Extract description, labels, priority, dependencies

2. **Check Related Context**:
   - Parent/child issues
   - Blocking/blocked by relationships
   - Related completed issues for patterns
   - Comments and discussions

3. **Update Status**:
   - If currently "Backlog" or "Todo", move to "In Progress"
   - Add comment: "Starting analysis - [timestamp]"
   - Assign to current user if not assigned

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

3. **Context Gathering**:
   - What existing features might this interact with?
   - Any similar past implementations?
   - Technical constraints to consider?

Then continue to step 3.

## 3. Technical Analysis

Coordinate with `doc-admin` agent to gather comprehensive context:

### Core Documentation:
- Project overview from README.md
- Recent changes from CHANGELOG.md
- Technical architecture from docs/tech/

### Product & Feature Context:
- Product requirements from docs/product/
- Feature specifications and user stories
- UI/UX guidelines and decisions

### Operational Context:
- Deployment configurations from docs/deployment/
- API integration details from docs/api/
- Monitoring setup from docs/monitoring/
- Known issues from docs/server-instability-issues/

### Pattern Analysis:
- Similar features already implemented
- Established coding patterns
- Performance considerations
- Security requirements

Focus on sections most relevant to the issue/idea being analyzed.

## 3.5 Pragmatic Analysis Approach

**Important**: During analysis, treat this as a peer discussion, not an order:

- **Challenge assumptions**: Question if the idea truly solves the stated problem
- **Consider alternatives**: "Have you considered X instead?"
- **Identify risks**: "This might cause Y issue because..."
- **Be direct**: "This won't work because..." with clear reasoning
- **Suggest improvements**: "What if we modified it to..."
- **Consider effort vs value**: "Is this worth 3 days for 2% improvement?"

Remember: 
- You're a technical advisor, not a yes-person
- Bad ideas should be rejected with explanation
- Good ideas can still be improved
- User impact is the ultimate measure

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

## 5. Dependency Check

Ask relevant specialist agents:
- **Database changes?** → Flag for `supabase-dba` review
- **Sync logic changes?** → Flag for `sync-reliability-monitor` review
- **Deployment changes?** → Flag for `devops-expert` review
- **UI/PWA changes?** → Flag for `ux-engineer` review

## 6. Test Planning

Request `qa-engineer` to:
- Draft test scenarios based on requirements
- Identify edge cases
- Suggest test data needs
- Plan integration test approach

## 7. Final Summary

Present findings in PM-friendly language:

```
📋 Analysis for RR-XXX: [Title]

📝 Summary:
[2-3 sentences explaining the task]

🎯 Approach:
1. [Step 1 - what and why]
2. [Step 2 - what and why]
3. [Step 3 - what and why]

⚠️ Considerations:
- [Technical constraint or risk]
- [Dependency or coordination need]

🧪 Test Strategy:
- [Key test scenario]
- [Edge case to verify]

⏱️ Estimate: [X hours/days]

❓ Questions:
- [Any clarification needed]

Ready to proceed? Use /execute to begin implementation.
```

**Note**: Once this plan is documented in Linear, it becomes the contract. No implementation without Linear backing, and no spec changes without updating Linear first.

## 8. Idea Evaluation (for non-issue analysis)

If this was idea exploration (not a Linear issue):

Ask: "This idea looks [promising/challenging/interesting]. Would you like me to create a Linear issue for it?"

If yes:
- Invoke `program-manager` to create issue
- Use the analysis findings for description
- Apply appropriate labels
- Return new issue ID

If no:
- Keep analysis for future reference
- Suggest saving key points

## 9. Update Linear (for issue analysis only)

If this was a Linear issue analysis:

`program-manager` updates the issue:
- Add implementation plan as comment
- Update description with technical details
- Link any discovered related issues
- Set appropriate labels if missing

Remember: Stay in read-only mode. Don't start implementing until user approves the plan.