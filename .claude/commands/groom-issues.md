---
description: Enhanced Linear Issue Grooming with Symbol-Level Analysis
---

Comprehensive issue grooming methodology that correlates Linear issues with actual codebase symbols and coordinates with domain experts for precision analysis.

# SYSTEMATIC METHODOLOGY

## Phase 1: Codebase Context Establishment

### 1.1 Activate Serena MCP

```
First activate Serena MCP to access project memories:
mcp__serena__activate_project
```

### 1.2 Symbol-Level Codebase Analysis

- Use Serena's `get_symbols_overview` to map current codebase architecture
- Use `find_symbol` to locate specific components mentioned in issues
- Cross-reference issue descriptions with actual symbol names and locations

### 1.3 Recent Development Context

- Analyze last 10 commits for resolved functionality that may close existing issues
- Cross-reference commit messages with Linear issue IDs (RR-XXX patterns)
- Identify code changes that may have invalidated open issues

## Phase 2: Expert Coordination

### 2.1 Domain Expert Consultation

Coordinate with specialized agents based on issue categorization:

**Database Issues** → `db-expert`

- Schema changes, migrations, RLS policies
- Performance optimization, query analysis
- Data integrity and sync-related issues

**Infrastructure Issues** → `infra-expert`

- Deployment, monitoring, environment setup
- PM2 process management, port configurations
- Performance bottlenecks, resource optimization

**Testing Issues** → `test-expert`

- Test coverage gaps, failing tests
- E2E scenarios, integration testing
- Test environment setup and maintenance

**API/Backend Issues** → General analysis

- Route handlers, middleware, error handling
- OAuth flows, external service integrations

**Frontend Issues** → General analysis

- Component architecture, state management
- UI/UX improvements, responsive design

### 2.2 Symbol-Level Correlation

For each issue:

1. Extract mentioned components, functions, or features
2. Use Serena to locate exact symbols in codebase
3. Analyze symbol dependencies and related code
4. Identify if issue affects multiple symbol domains

## Phase 3: Structured Analysis Framework

### 3.1 Issue Classification Matrix

**Validity Assessment**

- ✅ **VALID**: Issue accurately reflects current codebase state
- ⚠️ **OUTDATED**: Issue references code that has changed
- ❌ **RESOLVED**: Issue already addressed in recent commits
- 🔄 **EVOLVED**: Issue needs updating to reflect current architecture

**Technical Precision Scoring** (1-5 scale)

- **5**: Specific symbol references, clear implementation path
- **4**: Clear component identification, some implementation details
- **3**: General feature area identified, moderate clarity
- **2**: Vague references, requires significant investigation
- **1**: Poor technical specification, needs complete rewrite

**Impact Analysis**

- **CRITICAL**: Affects core functionality, user-facing features
- **HIGH**: Important improvements, significant tech debt
- **MEDIUM**: Nice-to-have enhancements, minor optimizations
- **LOW**: Future considerations, non-essential improvements

### 3.2 Duplicate Detection Algorithm

**Symbol-Level Duplicate Detection**

1. Map each issue to affected code symbols
2. Identify issues targeting same symbols or symbol groups
3. Analyze if issues represent different aspects of same problem
4. Flag potential mergers with confidence scores

**Dependency Chain Analysis**

1. Map issue dependencies through symbol relationships
2. Identify blocking relationships not captured in Linear
3. Suggest optimal execution sequences based on code dependencies

## Phase 4: Actionable Recommendations

### 4.1 Structured Output Format

```markdown
# Issue Grooming Analysis Report

## Executive Summary

- Total Issues Analyzed: X
- Valid Issues: X (X%)
- Outdated/Resolved: X (X%)
- Duplicates Identified: X pairs
- Recommended Closures: X
- Recommended Mergers: X

## Issue-by-Issue Analysis

### [Issue ID]: [Title]

**Status**: [VALID/OUTDATED/RESOLVED/EVOLVED]
**Technical Precision**: [1-5]/5
**Impact**: [CRITICAL/HIGH/MEDIUM/LOW]
**Confidence**: [1-5]/5

**Codebase Correlation**:

- Affected Symbols: [list of specific symbols]
- Related Files: [file paths]
- Dependencies: [symbol dependencies]

**Expert Analysis**: [domain expert findings]

**Recommendation**: [specific action with rationale]
**Implementation Notes**: [technical guidance if proceeding]

---

## Systematic Recommendations

### Immediate Actions (High Confidence)

1. **Close as Resolved**: [list with commit references]
2. **Merge Duplicates**: [pairs with rationale]
3. **Update Descriptions**: [issues needing technical clarification]

### Strategic Recommendations

1. **Execution Order**: [dependency-based sequence]
2. **Resource Allocation**: [effort estimates by domain]
3. **Architecture Considerations**: [cross-cutting concerns]

### Quality Improvements

1. **Documentation Gaps**: [areas needing better issue templates]
2. **Symbol Mapping**: [components needing better issue tracking]
3. **Process Improvements**: [workflow recommendations]
```

### 4.2 Cross-Reference Validation

**Recent Commit Analysis**

- Scan commit messages for RR-XXX references
- Identify commits that may have resolved open issues
- Flag issues that should be closed based on implemented functionality

**CHANGELOG Correlation**

- Cross-reference CHANGELOG entries with open issues
- Identify discrepancies between documented changes and issue status
- Suggest CHANGELOG updates if issues resolved without proper tracking

## Phase 5: Implementation Guidelines

### 5.1 Pre-Analysis Checklist

- [ ] Serena MCP activated and responsive
- [ ] Symbol overview generated
- [ ] Recent commits analyzed (last 10)
- [ ] Domain experts available for consultation
- [ ] Linear API access verified

### 5.2 Quality Assurance

- Minimum 3/5 confidence score for all recommendations
- All symbol references verified through Serena
- Expert validation for domain-specific issues
- Cross-validation of duplicate detection through multiple methods

### 5.3 Output Validation

- Structured format consistently applied
- All recommendations include implementation rationale
- Confidence scores justified with technical evidence
- Expert insights properly attributed and verified

# EXECUTION NOTES

1. **Symbol-First Approach**: Always start with codebase reality, then validate against issue descriptions
2. **Expert Coordination**: Don't proceed with domain-specific recommendations without expert consultation
3. **Confidence Scoring**: Be conservative - better to flag for manual review than make incorrect automated decisions
4. **Pragmatic Focus**: Prioritize issues that directly impact current development workflow
5. **Documentation**: Maintain detailed reasoning for all recommendations to enable quality review
