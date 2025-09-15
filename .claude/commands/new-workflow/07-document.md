---
description: Step 7 - Documentation updates for complex implementations with API and technical documentation
argument_hint: <issue-id>
---

# Step 7: Document - Comprehensive Documentation Updates

Update all relevant documentation for completed implementation. This phase is typically used for complex implementations that require comprehensive documentation updates.

## Project Activation

```
mcp__serena__activate_project with:
  project_path: /Users/shayon/DevProjects/rss-news-reader
```

## 1. Parse Input & Context Gathering

**Progress: Phase 1 (1/6) - Analyzing changes and scope...**

### 1A. Linear Issue Context

Use `linear-expert` to get implementation details:

- Complete issue with all comments and implementation strategy
- Extract what was actually implemented vs originally planned
- Identify documentation scope based on implementation changes

### 1B. Implementation Analysis

Use Serena MCP to understand changes made:

- Check relevant memories: `mcp__serena__read_memory` for similar documentation patterns
- `get_symbols_overview` on modified files
- `find_symbol` for new/changed functions and classes
- Map implementation to documentation requirements

### 1C. Change Scope Assessment

```bash
# Analyze what changed
git log --oneline -10
git diff --name-only HEAD~5 HEAD

# Check for API changes
git diff --name-only HEAD~5 HEAD | grep -E "src/app/api/"

# Check for new features
git diff --name-only HEAD~5 HEAD | grep -E "src/components/|src/lib/"
```

### 1D. Documentation Mapping

Map changes to appropriate documentation locations:

```
Documentation Structure:
├── docs/api/          → API documentation, endpoint guides, Insomnia setup
├── docs/features/     → User-facing feature descriptions, PRDs
├── docs/tech/         → Technical architecture, implementation details, database
├── docs/testing/      → Test strategies, infrastructure, validation practices
├── docs/operations/   → Deployment, monitoring, service management
├── docs/security/     → Security fixes, encryption, authentication
├── docs/ui-ux/        → Design system, iOS patterns, component guidelines
├── docs/performance/  → Optimization strategies, GPU acceleration
├── docs/adr/          → Architecture Decision Records (timestamped)
├── docs/staging/      → Test design handoffs, work-in-progress docs
├── docs/troubleshooting/ → Issue resolution guides
└── docs/product/      → PRDs, user stories, flow diagrams

Change Type → Documentation Location:
- API endpoints → docs/api/
- User features → docs/features/
- Architecture changes → docs/tech/ + docs/adr/
- Performance optimizations → docs/performance/
- Security fixes → docs/security/
- UI/UX changes → docs/ui-ux/
- Testing infrastructure → docs/testing/
- Deployment changes → docs/operations/
```

### 1E. README Update Assessment

Determine if README.md needs updates:

```
README Update Triggers:
✅ HIGH PRIORITY (Always Update README):
- New environment variables added/changed
- Installation/setup steps modified
- New major features users need to know about
- Changed deployment instructions or requirements
- New configuration options

🟡 MEDIUM PRIORITY (Consider README):
- Significant architectural changes affecting users
- New integrations or dependencies
- Changed performance characteristics
- Security updates affecting setup

❌ LOW PRIORITY (CHANGELOG Only - Do NOT update README):
- Bug fixes that don't affect setup
- Internal code improvements
- Minor UI tweaks
- Documentation-only changes
```

## 2. Documentation Requirements Analysis

**Progress: Phase 2 (2/6) - Determining documentation needs...**

### 2A. API Documentation Updates

If API endpoints were modified/created:

1. **OpenAPI Documentation**:
   - Verify OpenAPI registry is complete
   - Check JSDoc comments on route handlers
   - Validate request/response examples
   - Run coverage validation: `node scripts/validate-openapi-coverage.js`

2. **API Usage Documentation**:
   - Update docs/api/ with new endpoint guides
   - Add authentication/authorization requirements
   - Document rate limits and error handling

### 2B. Technical Documentation Updates

For significant implementation changes:

1. **Architecture Documentation (docs/tech/)**:
   - Update system architecture diagrams
   - Document new design patterns used
   - Update integration flow documentation

2. **Database Documentation (docs/tech/)**:
   - Update schema documentation if database changes
   - Document new tables, columns, or relationships
   - Update migration documentation

3. **Architecture Decision Records (docs/adr/)**:
   - Create timestamped ADR for significant architectural changes
   - Document decision rationale and alternatives considered

### 2C. User Documentation Updates

For user-facing features:

1. **Feature Documentation (docs/features/)**:
   - Document new feature capabilities
   - Add usage examples and best practices
   - Update user workflow documentation

2. **UI/UX Documentation (docs/ui-ux/)**:
   - Update design system documentation for UI changes
   - Document new iOS patterns or components
   - Update component guidelines

3. **README.md Updates (Selective)**:
   Based on README update assessment from 1E:
   - HIGH PRIORITY: Always update
   - MEDIUM PRIORITY: Consider based on user impact
   - LOW PRIORITY: Skip (CHANGELOG only)

## 3. Use doc-admin Agent for File Operations

**Progress: Phase 3 (3/6) - Updating documentation files...**

### 3A. Documentation File Updates

Use `doc-admin` agent for all documentation file operations:

```
Task: Update documentation files for RR-XXX implementation

Implementation Summary:
[Provide summary of what was implemented from Linear and git analysis]

API Changes:
[List any API endpoints created/modified with their purposes]

Technical Changes:
[List significant technical changes that need documentation]

Files Requiring Updates:
- docs/api/ (if API changes)
- docs/features/ (if new features)
- docs/tech/ (if technical architecture changes)
- README.md (if setup/usage changes)
- CHANGELOG.md (always update)

Documentation Requirements:
- Include Linear issue reference (RR-XXX)
- Add implementation date and summary
- Update any affected cross-references
- Ensure all examples are current and accurate
```

### 3B. Documentation Validation

Verify documentation completeness:

1. **Cross-Reference Validation**:
   - Check that all internal links work
   - Verify code examples compile and work
   - Ensure screenshots are current

2. **Consistency Check**:
   - Terminology is consistent across docs
   - Code examples follow current patterns
   - Documentation style matches project standards

## 4. CHANGELOG.md Update

**Progress: Phase 4 (4/6) - Updating CHANGELOG with timestamp...**

Use `doc-admin` to update CHANGELOG.md with implementation details:

```
Task: Update CHANGELOG.md for RR-XXX

Add entry under [Unreleased] section with timestamp:

### Added (if new features)
- [RR-XXX] [Brief description of new functionality] - Sep 13, 2025 - 07:32 AM EDT

### Changed (if modifications)
- [RR-XXX] [Description of changes to existing functionality] - Sep 13, 2025 - 07:32 AM EDT

### Fixed (if bug fixes)
- [RR-XXX] [Description of issues resolved] - Sep 13, 2025 - 07:32 AM EDT

Format Requirements:
- Timestamp format: "Sep 13, 2025 - 07:32 AM EDT" (current date/time)
- Linear issue reference included
- Brief technical description
- User-facing impact (if applicable)
- Breaking changes (if any)
```

## 5. Technical Memory Documentation

**Progress: Phase 5 (5/6) - Storing implementation knowledge...**

### 5A. Serena Memory Update

Use Serena MCP to create/update implementation memory:

```
Use mcp__serena__write_memory to document:

Memory name: issue_RR-XXX_implementation.md

Content:
- Implementation approach and technical decisions
- Challenges encountered and solutions applied
- Performance considerations and optimizations
- Integration patterns and reusable code
- Testing strategy and coverage achieved
- Future improvement opportunities
- Lessons learned for similar future implementations
```

## 6. Documentation Quality Review

**Progress: Phase 6 (6/6) - Final validation and completion...**

### 6A. Technical Accuracy Validation

Use `tech-expert` for documentation review:

```
Task: Review documentation accuracy for RR-XXX

Validate:
- Technical descriptions are accurate
- Code examples work correctly
- Architecture documentation reflects implementation
- Integration guides are complete and current
- Performance claims match actual metrics
```

### 6B. User Experience Validation

For user-facing documentation:

```
Review user documentation for:
- Clear step-by-step instructions
- Accurate screenshots and examples
- Complete troubleshooting information
- Proper cross-references and navigation
```

## 7. Concise Documentation Output

```
✅ RR-XXX Documentation Complete

Documentation Updated:
- CHANGELOG.md: Added [Added/Changed/Fixed] entry for RR-XXX
- docs/api/: [Updated endpoint documentation] (if API changes)
- docs/features/: [New feature documentation] (if applicable)
- docs/tech/: [Technical architecture updates] (if applicable)
- README.md: [Setup/usage updates] (if applicable)

Technical Memory:
- Serena Memory: ✅ Implementation patterns stored
- Lessons Learned: ✅ Challenges and solutions documented
- Future Reference: ✅ Reusable patterns identified

Validation:
- Cross-References: ✅ All links verified
- Code Examples: ✅ Tested and working
- Technical Accuracy: ✅ Expert reviewed
- Consistency: ✅ Style and terminology validated

Status: Documentation complete and validated
Next: Run 08-commit RR-XXX (final commit and push)
```

## Key Rules

- ✅ ALWAYS update CHANGELOG.md with Linear reference
- ✅ ALWAYS use doc-admin for all file operations
- ✅ ALWAYS validate technical accuracy with experts
- ✅ ALWAYS create Serena memory for complex implementations
- ✅ ALWAYS verify cross-references and examples work
- 🚫 NO documentation without implementation validation
- Focus on accuracy and completeness over volume
