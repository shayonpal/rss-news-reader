---
description: Comprehensive idea capture with analysis, validation, relationship detection, and intelligent issue management (Args: <type/RR-XXX> <brief-description>)
argument_hint: <type/RR-XXX> <brief-description>
---

# Capture & Analyze Ideas - 5-Phase Workflow

Comprehensive idea capture system with intelligent similar issue detection, label usage analysis, relationship mapping, and enhanced issue management. Features early duplicate prevention, smart labeling based on project patterns, and automatic relationship linking.

## Help Mode

If user provides `--help` or `help` parameter, display this usage guide:

```
capture-idea - Comprehensive idea capture with intelligent analysis and relationship detection

USAGE:
  capture-idea                           Interactive mode with full analysis
  capture-idea bug "login fails"        Quick capture with similarity detection
  capture-idea RR-123 "add context"     Enhance existing issue (may update title)
  capture-idea help                      Show this help

FEATURES:
  • Early duplicate detection across 90-day history
  • Smart label application based on project usage patterns
  • Automatic issue relationship detection and linking
  • Title evaluation and updating for existing issues
  • Comprehensive feasibility analysis with agent consultation

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

### Step 1.2: Comprehensive Similar Issue Detection

**CRITICAL**: This must be done EARLY in the process for comprehensive evaluation.

Use `linear-expert` to:

1. **Search for similar existing issues** using multiple search strategies:
   - Primary keywords from description
   - Synonym/related term searches
   - Category-based searches (if type is known)
   - Search across ALL issues (open, closed, archived) from last 90 days

2. **Analyze similarity scores** for each found issue:
   - > 85% similarity: "This appears to be a duplicate of RR-XXX. Should we enhance that issue instead?"
   - 70-84% similarity: "Found related issue RR-XXX: [title]. Are these related or blocking each other?"
   - 50-69% similarity: "Found potentially related issue RR-XXX: [title]. Should we link these?"

3. **For enhance-existing mode (RR-XXX)**: Also search for issues that might be related to the existing issue being enhanced

4. **Document findings**: Store similar/related issues for relationship creation in Phase 5

### Step 1.3: Initial Analysis

For new ideas, determine:

- **Urgency Level**: Critical/High/Medium/Low based on description keywords
- **Complexity Estimate**: Simple/Moderate/Complex based on scope indicators
- **Category**: UI/API/Database/Infrastructure/Documentation

Display initial classification and similar issue findings, then ask for confirmation before proceeding.

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

### Step 5.1: Enhanced Label Management with Usage Analysis

Use `linear-expert` to:

1. **Analyze current label usage patterns**:
   - Get all project labels with usage statistics
   - Identify most frequently used labels by category
   - Find label combinations that are commonly used together
   - Note any project-specific labeling conventions

2. **Intelligent label application** based on actual usage patterns:
   - **Primary Labels**: Apply based on discovered usage patterns (not just standard ones)
   - **Secondary Labels**: Use combinations that align with project patterns
   - **Custom Project Labels**: Apply any project-specific labels that match the issue
   - **Avoid Over-labeling**: Don't apply labels that are rarely used in the project

3. **Label recommendation justification**:
   - "Applying [label] because it's used on 80% of similar [type] issues"
   - "Adding [label] based on common pattern with [related-label]"
   - "Skipping [label] because it's rarely used in this project context"

### Step 5.2: Issue Relationship Detection & Linking

**Note**: Primary similar issue detection was done in Phase 1. This step focuses on relationship creation.

Use findings from Phase 1 and `linear-expert` to:

1. **Establish issue relationships** based on similarity analysis:
   - **Duplicate**: >85% similarity → Mark as duplicate and link
   - **Related**: 50-84% similarity → Create "related to" relationship
   - **Blocking/Blocked by**: If current issue depends on or blocks similar issues
   - **Parent/Child**: If current issue is part of a larger effort found in similar issues

2. **Cross-reference with existing issue descriptions** to identify:
   - Issues mentioned in descriptions that should be linked
   - Epic/project relationships that should be established
   - Dependencies that should be documented

3. **Update relationship documentation** in issue description:

   ```markdown
   ## Related Issues

   - Blocks: RR-XXX (reason)
   - Related: RR-XXX (reason)
   - Depends on: RR-XXX (reason)
   ```

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

1. **Evaluate and potentially update issue title**:
   - Assess if current title accurately reflects the scope after analysis
   - Check if title follows project conventions (Action verb format)
   - Consider if analysis revealed the issue is broader/narrower than title suggests
   - If title needs updating: "Current title: '[old title]' → Suggested: '[new title]' because [reason]"
   - Update title if user confirms the change

2. **Enhanced issue updates**:
   - Add comment with new analysis and context
   - Update labels based on actual usage patterns (from Step 5.1)
   - Adjust priority if validation changes assessment
   - Append technical requirements to description
   - Add relationship links to newly discovered related issues
   - Update issue relationships based on new findings

### Step 5.4: Session Summary

Provide comprehensive completion report:

```
## Idea Capture Session Complete

### Created/Updated: RR-XXX - [title]
[Link to Linear issue]

### Session Investigation Summary:
- **Similar Issue Analysis**: [found X similar issues, Y relationships created]
- **Label Pattern Analysis**: [applied labels based on project usage patterns]
- **Issue Relationships**: [related/blocking/duplicate relationships established]
- **Title Updates**: [title changes made and reasoning if applicable]
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
- **Early Intelligence**: Perform comprehensive similar issue analysis before deep investigation
- **Relationship Awareness**: Continuously track and document issue relationships throughout process

### Agent Integration Rules

- **Conditional Usage**: Only consult agents relevant to the specific type/category
- **Parallel Consultation**: When multiple agents needed, batch the consultations
- **Result Integration**: Synthesize agent feedback into coherent recommendations

### Enhanced Intelligence Features

- **Comprehensive Similarity Detection**: Multi-strategy search across 90-day history with weighted scoring
- **Project-Aware Labeling**: Analyze actual label usage patterns instead of applying generic labels
- **Relationship Mapping**: Automatic detection and creation of issue relationships (blocking, related, duplicate)
- **Title Intelligence**: Evaluate and suggest title improvements for existing issues based on analysis
- **Context Integration**: Maintain relationship awareness throughout the entire capture process

### Quality Assurance

- **Validation Gates**: Require explicit confirmation before issue creation
- **Information Completeness**: Intelligent defaults for skipped questions
- **Error Handling**: Graceful degradation if agents unavailable
- **Relationship Validation**: Confirm relationship links before creation
- **Title Change Confirmation**: Always confirm title updates with user before applying

### Session State Management

- **Progress Tracking**: Clear phase indicators throughout process
- **Recovery Capability**: Ability to resume if interrupted
- **Audit Trail**: Complete record of all decisions and consultations

This command transforms simple idea capture into comprehensive product analysis while maintaining conversational, user-friendly interaction patterns.
