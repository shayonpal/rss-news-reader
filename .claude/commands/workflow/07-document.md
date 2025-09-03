---
description: Comprehensive documentation phase that captures implementation details and validates API documentation
argument_hint: [#issue|"feature description"]
---

# Document - Documentation Generation Phase

Complete documentation generation and validation phase that ensures all implemented changes are properly documented and knowledge is preserved. This command bridges implementation and code review by systematically documenting changes, updating project files, and capturing implementation knowledge.

## Help Mode

If user provides `--help` or `help` parameter, display this usage guide instead of running the command:

```
document - Comprehensive documentation generation and validation

USAGE:
  document RR-123              Document implemented Linear issue
  document "description"       Document feature implementation
  document                     Document current implementation changes
  document help                Show this help

DELIVERABLES:
  ✅ API documentation validated (non-blocking)
  ✅ CHANGELOG.md updated with date/time
  ✅ Technical documentation updated
  ✅ Implementation knowledge captured in Serena MCP
  ✅ Known issues and test failures documented
  ✅ Documentation accessibility verified

EXAMPLES:
  document RR-67
  document "add user preferences API"
  document
```

## Instructions

**CRITICAL: Always activate Serena MCP at session start:**

```bash
# Activate Serena MCP for project context and knowledge storage
mcp__serena__activate_project
```

**First, check if user needs guidance:**

- If no parameters provided, analyze recent changes and ask what to document
- If `help` or `--help` provided, show the help mode above and stop
- Otherwise proceed with mode detection and documentation

**Progress Tracking: Display phase progress throughout execution**

```
📊 Documentation Progress:
- [ ] Phase 1: Change Analysis & Context (0/6)
- [ ] Phase 2: API Documentation Validation (1/6)
- [ ] Phase 3: Project Documentation Updates (2/6)
- [ ] Phase 4: Technical Documentation (3/6)
- [ ] Phase 5: Serena MCP Knowledge Updates (4/6)
- [ ] Phase 6: Verification & Completion (5/6)

Current: Starting documentation workflow...
```

### Phase 1: Change Analysis & Context

**Update Progress: Phase 1 (1/6) - Analyzing changes...**

1. **Git Diff Analysis & Issue Context**

   ```bash
   # Analyze changes and get Linear context in parallel
   git status --porcelain && git diff --cached --name-only
   # If Linear issue provided, use linear-expert for context
   ```

2. **Change Categorization**
   - API endpoints → OpenAPI documentation needed
   - UI changes → Visual documentation needed
   - Architecture changes → ADR creation needed
   - Bug fixes → Issue documentation needed

**✅ Validation Checkpoint 1:** Confirm documentation scope before proceeding to Phase 2

### Phase 2: API Documentation Validation

**Update Progress: Phase 2 (2/6) - Validating API documentation...**

1. **OpenAPI Coverage & Accessibility**

   ```bash
   npm run docs:validate && npm run docs:coverage --report
   curl -s http://100.96.166.53:3000/reader/api-docs > /dev/null
   ```

2. **Generate Recommendations**
   - Document undocumented endpoints (non-blocking)
   - Note missing response examples
   - Log for future sprint improvements

**✅ Validation Checkpoint 2:** API documentation status recorded, proceeding regardless of coverage gaps

### Phase 3: Project Documentation Updates (via doc-admin agent)

**Update Progress: Phase 3 (3/6) - Updating project documentation...**

1. **CHANGELOG.md Updates**

   ```bash
   # Use doc-admin agent: ALWAYS include timestamp
   # Format: "YYYY-MM-DD HH:MM - type: description"
   ```

2. **README.md & Inline Documentation**
   ```bash
   # Use doc-admin for README updates (when needed)
   # Update JSDoc comments and TypeScript interfaces
   ```

**✅ Validation Checkpoint 3:** Project documentation updated with proper timestamps

### Phase 4: Technical Documentation Management

**Update Progress: Phase 4 (4/6) - Managing technical documentation...**

1. **Update Existing Technical Docs**

   ```bash
   # Use doc-admin agent for:
   # - docs/tech/known-issues.md (discovered issues)
   # - record-of-test-failures.md (test failures using existing format)
   ```

2. **Create New Documentation (when appropriate)**
   - **docs/adr/**: YYYYMMDD-brief-description.md (architectural decisions)
   - **docs/features/**: Major feature implementations
   - **docs/issues/**: Complex bugs requiring analysis
   - **docs/security-fixes/**: RR-XXX-brief-description.md format

**✅ Validation Checkpoint 4:** Technical documentation requirements identified and processed

### Phase 5: Serena MCP Knowledge Updates

**Update Progress: Phase 5 (5/6) - Capturing implementation knowledge...**

1. **Store Implementation Patterns**
   ```bash
   mcp__serena__write_memory memory_name:"implementation_patterns_[date]" content:"[details]"
   # Capture architectural decisions, integration patterns, optimizations
   ```

**✅ Validation Checkpoint 5:** Implementation knowledge preserved in Serena MCP

### Phase 6: Verification & Completion

**Update Progress: Phase 6 (6/6) - Finalizing documentation...**

1. **Accessibility Testing & Completion Report**

   ```bash
   # Test documentation accessibility
   npm run docs:serve
   curl -s http://100.96.166.53:3000/reader/api-docs/openapi.json | jq .

   # Generate completion report with:
   # - Updated files (with links)
   # - New documentation created
   # - API coverage status
   # - Recommendations for future sprints
   ```

**✅ Final Validation:** All documentation phases completed successfully

## Documentation Guidelines

### Edit Existing When:

- **CHANGELOG.md**: Always with "YYYY-MM-DD HH:MM - type: description" format
- **README.md**: Core functionality or setup changes
- **docs/tech/known-issues.md**: Implementation issues needing future fixes
- **record-of-test-failures.md**: Test failures using existing format

### Create New When:

- **docs/adr/**: Architectural decisions (YYYYMMDD-brief-description.md)
- **docs/features/**: Major feature implementations
- **docs/issues/**: Complex bugs requiring analysis
- **docs/security-fixes/**: Security fixes (RR-XXX-brief-description.md)

## Agent Integration

### Primary Agent: doc-admin

```bash
# Use doc-admin agent for ALL codebase documentation operations
# File creation, editing, moving, organizing
# CHANGELOG.md and README.md updates
# docs/ folder management
```

### Secondary Integration: Serena MCP

```bash
# Update Serena with implementation knowledge
# Store architectural patterns and decisions
# Capture reusable code solutions
```

### npm Scripts Coordination

```bash
# Coordinate with existing npm scripts:
npm run docs:validate     # OpenAPI coverage validation
npm run docs:coverage     # Generate coverage reports
npm run docs:serve        # Test documentation accessibility
```

## Output Format

```
## 📚 Documentation Phase: [Feature/Issue Title]

### 📊 Documentation Context
**Serena MCP**: ✅ Activated
**Linear Issue**: #[number] ([title])
**Changes Analyzed**: [number] files, [number] API endpoints
**Documentation Scope**: [API/UI/Architecture/Bug Fix]

### 🔍 Change Analysis Results

**Modified Files:**
- `src/[component1].ts` - [type of changes]
- `src/app/api/[endpoint]/route.ts` - [new API endpoint]
- `src/components/[component].tsx` - [UI changes]

**Documentation Requirements Identified:**
- ✅ API endpoints requiring OpenAPI documentation: [count]
- ✅ UI changes requiring visual documentation: [count]
- ✅ Architectural decisions requiring ADR: [count]

### 📋 API Documentation Status (Non-Blocking)

**OpenAPI Coverage Validation:**
```

PASS: 6/6 Health endpoints documented ✅
PASS: 4/7 Sync endpoints documented (3 missing) ⚠️
PASS: 2/4 Articles endpoints documented (2 missing) ⚠️

Coverage: 12/17 endpoints (70.6%)

```

**Missing Documentation:**
- GET /api/sync/bidirectional - Add to openapi/registry.ts
- POST /api/articles/{id}/summarize - Add response examples

**Swagger UI**: ✅ Accessible at http://100.96.166.53:3000/reader/api-docs

### 📝 Project Documentation Updates

**CHANGELOG.md:**
- ✅ Updated with 2025-01-20 14:30 timestamp
- ✅ Added feature description and impact
- ✅ Referenced Linear issue #[number]

**README.md:**
- ✅ Updated installation steps for new dependencies
- ✅ Added new API usage examples

**Inline Documentation:**
- ✅ Added JSDoc comments to [count] functions
- ✅ Updated component prop documentation
- ✅ Added TypeScript interface documentation

### 📂 Technical Documentation

**docs/tech/known-issues.md:**
- ✅ Documented [issue description] for future sprint
- ✅ Added workaround for [limitation]

**docs/adr/:**
- ✅ Created 20250120-[decision-name].md for [architectural choice]

**docs/features/:**
- ✅ Created [feature-name].md implementation guide

**record-of-test-failures.md:**
- ✅ Documented [test suite] failures with resolution steps

### 🧠 Serena MCP Knowledge Updates

**Implementation Patterns Stored:**
- ✅ [Pattern name]: Reusable component pattern for [use case]
- ✅ [Architecture decision]: Integration approach for [system]
- ✅ [Performance optimization]: Solution for [bottleneck]

**Memory Files Created:**
- `implementation_patterns_20250120.md` - [pattern descriptions]
- `architecture_decisions_[feature].md` - [decision rationale]

### ✅ Documentation Verification

**Accessibility Testing:**
- ✅ Documentation server: Accessible
- ✅ Swagger UI: Functional with "Try it out"
- ✅ OpenAPI spec: Valid JSON structure
- ✅ Internal documentation links: Working

### 📊 Completion Report

**Documentation Created/Updated:**
- [📝 CHANGELOG.md](./CHANGELOG.md) - Feature changes with timestamp
- [📖 README.md](./README.md) - Updated setup instructions
- [🏗️ ADR: 20250120-[decision]](./docs/adr/20250120-[decision].md) - Architectural decision
- [⚡ Feature: [name]](./docs/features/[name].md) - Implementation guide
- [⚠️ Known Issues](./docs/tech/known-issues.md) - Updated with [count] new issues

**API Documentation Status:**
- Current Coverage: [percentage]% ([documented]/[total] endpoints)
- Missing: [count] endpoints need OpenAPI documentation
- Recommendations: [specific actions for next sprint]

**Knowledge Preservation:**
- ✅ Serena MCP updated with [count] implementation patterns
- ✅ Architectural decisions documented and stored
- ✅ Reusable solutions captured for future reference

## 🎯 Documentation Phase Complete

All implementation changes have been systematically documented. API coverage has been validated (non-blocking), project documentation is current, and implementation knowledge has been preserved in Serena MCP.

**Ready for Final Commit (08-commit-push):**
- Documentation provides context for commit process
- Known issues are documented for future reference
- Implementation patterns are preserved for team knowledge

**Next Steps:**
- Proceed to `08-commit-push` for final commit and deployment
- Address API documentation gaps in future sprints
- Monitor documentation accessibility
```

## Error Handling

- **If API documentation validation fails**: Report but don't block (non-blocking approach)
- **If Swagger UI is inaccessible**: Document issue and provide troubleshooting steps
- **If doc-admin agent fails**: Fall back to direct file operations with clear error reporting
- **If Serena MCP update fails**: Continue with documentation but report knowledge storage failure

## Tool Usage Best Practices

- **doc-admin Agent**: Primary tool for ALL codebase documentation operations
- **Serena MCP**: Knowledge storage and pattern preservation
- **Linear MCP**: Issue context and requirements extraction
- **Bash**: npm scripts coordination and accessibility testing
- **Direct file operations**: Fallback when agents are unavailable
