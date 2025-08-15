---
description: Comprehensive idea capture with analysis, validation, and structured issue creation (Args: <type/RR-XXX> <brief-description>)
argument_hint: <type/RR-XXX> <brief-description>
---

# Capture & Analyze Ideas - 5-Phase Workflow

Comprehensive idea capture system with medium automation, context gathering, feasibility validation, and agent integration. Handles both new ideas and existing Linear issue enhancement.

## Help Mode

If user provides `--help` or `help` parameter, display this usage guide:

```
capture-idea - Comprehensive idea capture with analysis and validation

USAGE:
  capture-idea                           Interactive mode - start from scratch
  capture-idea bug "login fails"        Quick capture with type and description
  capture-idea RR-123 "add context"     Add context to existing issue
  capture-idea help                      Show this help

TYPES:
  bug          Bug report with reproduction steps
  feature      New feature or enhancement
  idea         Exploratory concept requiring validation
  enhancement  Improvement to existing functionality

EXAMPLES:
  capture-idea
  capture-idea feature "dark mode toggle"
  capture-idea RR-206 "responsive layout feedback"
  capture-idea bug "articles not syncing"
```

## Phase 1: Input Analysis & Classification

### Step 1.1: Parse Input

- Check if first argument is existing issue reference (RR-XXX pattern)
- If RR-XXX found: Set mode to "enhance-existing"
- Otherwise: Set mode to "create-new"
- Extract type and description from remaining arguments

### Step 1.2: Initial Analysis

For new ideas, determine:

- **Urgency Level**: Critical/High/Medium/Low based on description keywords
- **Complexity Estimate**: Simple/Moderate/Complex based on scope indicators
- **Category**: UI/API/Database/Infrastructure/Documentation

Display initial classification and ask for confirmation before proceeding.

## Phase 2: Context Gathering & Agent Integration

### Step 2.1: Interactive Interview

Ask questions ONE AT A TIME with escape option:
"(type 'done' to skip remaining questions and proceed with analysis)"

#### Core Questions (All Types):

1. **Type Confirmation**: What type is this? (bug/feature/idea/enhancement) [skip if provided]
2. **Problem Statement**: What problem does this solve? Provide 3 potential choices based on context
3. **User Impact**: Rate impact (1=minor, 5=critical) and explain why
4. **Related Features**: Which existing features does this connect to? List 3 relevant current features
5. **Breakdown Potential**: Can this be vertically sliced into smaller deliverables?

#### Bug-Specific Questions:

6. **Reproduction Steps**: How can this be reproduced consistently?
7. **Expected vs Actual**: What should happen vs what actually happens?
8. **Timeline**: When was this first noticed?
9. **Frequency**: How often does this occur?

#### Feature-Specific Questions:

6. **Success Criteria**: How do we know this feature is complete and successful?
7. **Technical Constraints**: Any known limitations or requirements?
8. **Priority Classification**: Quick win or major feature?
9. **User Value**: What specific value does this provide to users?

### Step 2.2: Agent Consultation

Based on classification, consult relevant agents:

**For Database-related items:**

- Use `db-expert` to assess database impact and requirements
- Get schema change recommendations if applicable

**For UI/UX items:**

- Use `ui-expert` to evaluate design implications
- Get component and accessibility recommendations

**For Infrastructure items:**

- Use `infra-expert` to assess deployment and performance impact
- Get scalability and monitoring recommendations

**For All Items:**

- Use `test-expert` to determine testing strategy and requirements
- Get test coverage and automation recommendations

### Step 2.3: Project Context Analysis

- Review current project state and active priorities
- Identify potential conflicts with ongoing work
- Assess resource requirements and timeline implications

## Phase 3: Validation & Feasibility Assessment

### Step 3.1: Technical Feasibility

Using best judgment criteria:

- **Implementation Complexity**: Rate 1-5 based on technical requirements
- **Resource Requirements**: Estimate effort (hours/days/weeks)
- **Risk Assessment**: Identify potential blockers and dependencies
- **Integration Impact**: How does this affect existing systems?

### Step 3.2: Business Value Validation

- **User Benefit**: Clear value proposition assessment
- **Priority Alignment**: Fits with current project goals
- **ROI Estimate**: Effort vs benefit analysis
- **Opportunity Cost**: What else could be done with these resources?

### Step 3.3: Validation Summary

Present comprehensive analysis:

```
## Feasibility Assessment
Technical Complexity: [1-5] - [reasoning]
Business Value: [1-5] - [reasoning]
Implementation Risk: [Low/Medium/High] - [key risks]
Recommended Priority: [Critical/High/Medium/Low]
Estimated Effort: [time estimate]
```

Ask for user confirmation: "Should we proceed with creating/updating this issue?"

## Phase 4: Specification Creation

### Step 4.1: User Story Generation

Create structured user stories:

**For Features:**

```
As a [user type]
I want [functionality]
So that [benefit/outcome]

Acceptance Criteria:
- [ ] [specific requirement 1]
- [ ] [specific requirement 2]
- [ ] [specific requirement 3]
```

**For Bugs:**

```
## Bug Report
Problem: [clear problem statement]
Impact: [who is affected and how]
Reproduction: [step-by-step instructions]
Expected: [what should happen]
Actual: [what actually happens]
```

### Step 4.2: Technical Requirements Documentation

Include all investigation outcomes:

**Agent Consultation Results:**

- Database Expert Findings: [db-expert recommendations]
- UI Expert Analysis: [ui-expert suggestions]
- Infrastructure Assessment: [infra-expert evaluation]
- Testing Strategy: [test-expert recommendations]

**Implementation Notes:**

- Technical approach recommendations
- Dependency requirements
- Performance considerations
- Security implications

### Step 4.3: Breakdown Planning

If vertical slicing is possible:

- Create logical milestone breakdown
- Identify minimum viable implementation
- Plan incremental delivery phases

## Phase 5: Issue Creation/Update & Label Management

### Step 5.1: Label Management

Use `linear-expert` to:

- Get current project labels list
- Auto-apply relevant labels based on:
  - Type: bug/feature/enhancement/idea
  - Category: ui/api/database/infrastructure/documentation
  - Priority: critical/high/medium/low
  - Complexity: simple/moderate/complex
  - Area: sync/reader/auth/performance

### Step 5.2: Duplicate Prevention

Before creating new issues:

- Use `linear-expert` to search for similar issues by keywords
- Check both open and closed issues from last 30 days
- If >70% similarity found: "Found similar issue RR-XXX: [title]. Is this the same or different?"

### Step 5.3: Issue Creation/Update

**For New Issues:**
Use `linear-expert` to create with:

- **Status**: "Backlog" (unless critical, then "Todo")
- **Title**: Action verb format: "Add/Fix/Improve/Update [specific item]"
- **Description**: Complete specification from Phase 4
- **Labels**: Auto-applied relevant labels
- **Priority**: Based on validation assessment
- **Team**: RSS Reader team

**For Existing Issues (RR-XXX mode):**
Use `linear-expert` to:

- Add comment with new analysis and context
- Update labels if new categories identified
- Adjust priority if validation changes assessment
- Append technical requirements to description

### Step 5.4: Session Summary

Provide comprehensive completion report:

```
## Idea Capture Session Complete

### Created/Updated: RR-XXX - [title]
[Link to Linear issue]

### Session Investigation Summary:
- **Agent Consultations**: [list of agents used and key findings]
- **Technical Assessment**: [complexity, risks, requirements]
- **Business Value**: [priority, user impact, ROI]
- **Implementation Strategy**: [approach, timeline, dependencies]

### Key Decisions Made:
- [decision 1 with reasoning]
- [decision 2 with reasoning]

### Next Steps:
- [immediate action items]
- [follow-up investigations needed]
- [stakeholder reviews required]
```

## Important Implementation Notes

### Conversation Flow Management

- **User-Friendly**: Clear progress indicators, step numbering, escape options
- **Flexible Pacing**: Allow "done" at any question to proceed with available information
- **Context Preservation**: Maintain conversation state throughout all phases

### Agent Integration Rules

- **Conditional Usage**: Only consult agents relevant to the specific type/category
- **Parallel Consultation**: When multiple agents needed, batch the consultations
- **Result Integration**: Synthesize agent feedback into coherent recommendations

### Quality Assurance

- **Validation Gates**: Require explicit confirmation before issue creation
- **Information Completeness**: Intelligent defaults for skipped questions
- **Error Handling**: Graceful degradation if agents unavailable

### Session State Management

- **Progress Tracking**: Clear phase indicators throughout process
- **Recovery Capability**: Ability to resume if interrupted
- **Audit Trail**: Complete record of all decisions and consultations

This command transforms simple idea capture into comprehensive product analysis while maintaining conversational, user-friendly interaction patterns.
