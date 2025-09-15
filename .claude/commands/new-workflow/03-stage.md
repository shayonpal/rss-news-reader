---
description: Step 3 - Staging phase with Linear updates and preparation for complex implementations
argument_hint: <issue-id>
---

# Step 3: Stage - Implementation Staging Phase

## 1. Parse Input and Validate Prerequisites

Check $ARGUMENTS:

- If starts with "RR-" or just a number → Linear issue ID (continue)
- If Linear URL → Extract project/issue ID and continue
- If empty or other text → Error: "Please provide a Linear issue ID (e.g., RR-123)"

**Note:** This command assumes planning has been completed with an approved strategy that will be recorded in Linear during this stage.

## 2. Mandatory Documentation

**These steps are REQUIRED - do not skip:**

### 2A. Generate Concrete Test Contracts

Based on the approved strategy from planning phase, create explicit contracts:

```
📝 Test Contracts for RR-XXX:

API Contracts:
- Endpoint: [exact path]
- Method: [GET/POST/PUT/DELETE]
- Request Body: [exact JSON structure]
- Success Response: [exact JSON with status code]
- Error Responses:
  - 400: [exact error format]
  - 404: [exact error format]
  - 500: [exact error format]

Database Contracts:
- Table: [table name]
- Operation: [INSERT/UPDATE/DELETE]
- Fields Changed: [field: old_value → new_value]
- Constraints: [any constraints that must be checked]

State Transitions:
- Before: [exact database state]
- Action: [what triggers the change]
- After: [exact expected state]
```

### 2B. Gather Symbol-Level Context for Implementation

Use Serena for precise implementation context:

1. **Symbol Signatures** (via `find_symbol`):
   - Exact function signatures with parameter types
   - Return types and error conditions
   - Class constructors and methods

2. **Implementation Patterns** (via `search_for_pattern`):
   - Find similar implementation files
   - Use `get_symbols_overview` on similar features to understand structure
   - Find utility patterns: `find_symbol` with relevant utility names

3. **Dependency Mapping** (via `find_referencing_symbols`):
   - Trace how similar features are implemented
   - Find integration patterns and dependencies
   - Identify components that will need updates

### 2C. Generate Symbol-Aware Implementation Specs

Provide precise specifications for implementation phase:

```
Implementation Specifications:
- Primary Symbols: [Exact symbol paths to create/modify]
- Dependencies: [List of dependent symbols that need updates]
- Integration Points: [API routes, database operations, UI components]

Symbol Contracts:
- Input: [Exact parameters for new/modified symbols]
- Output: [Return types and expected behavior]
- Side Effects: [State changes, database operations, API calls]

Implementation Requirements:
- Create: [New symbols to implement with signatures]
- Modify: [Existing symbols to enhance with changes needed]
- Update: [Consumer symbols to update with new dependencies]
```

## 3. Update Linear Status

Use `linear-expert` to:

- Move issue to "In Progress"
- Add comprehensive comment with all staging information:

```
**Staging Phase Complete**

**Implementation Strategy (Approved)**
[Full strategy details from planning phase]

**Test Contracts**
[All contracts from 2A]

**Implementation Specifications**
[All specs from 2C]

Timestamp: [current time]
Status: Ready for implementation
```

## 4. Enhanced Synthesis and Final Summary

**Comprehensive synthesis of all analysis components:**

### Integration of All Analysis Components

Combine insights from planning phase:

1. **Technical Expert Review**: Architecture, security, performance feedback
2. **Pattern Recognition**: Historical success patterns and gotchas
3. **Feasibility Validation**: Automated compatibility and constraint checks
4. **Implementation Strategy**: Detailed technical approach

### Comprehensive Recommendations with Confidence Scores

```
🎯 Enhanced Analysis Summary for RR-XXX:

📊 Confidence Scores:
- Technical Feasibility: [85%] - Based on compatibility checks and expert review
- Implementation Success: [92%] - Based on similar pattern success rates
- Performance Impact: [78%] - Based on benchmark analysis
- Resource Requirements: [67%] - Based on complexity and constraint assessment

🔄 Pattern-Based Insights:
- Similar Issues: [List of 3-5 similar completed issues]
- Success Rate: [X/Y similar issues completed successfully]
- Common Gotchas: [List of frequently encountered problems]
- Proven Solutions: [Reusable patterns from successful implementations]

🏗️ Architecture Validation:
- Expert Approval: [APPROVED/CONDITIONAL/REJECTED]
- Security Assessment: [SECURE/NEEDS_REVIEW/VULNERABLE]
- Performance Validation: [OPTIMAL/ACCEPTABLE/CONCERNING]
- Scalability Rating: [EXCELLENT/GOOD/LIMITED]

🚦 Final Recommendation:
[PROCEED/PROCEED_WITH_CAUTION/REDESIGN_REQUIRED/REJECT]

Justification: [Comprehensive reasoning based on all analysis components]
```

## 5. Concise Final Output

```
✅ RR-XXX Staging Complete

Status: Ready for implementation
Strategy: [One sentence summary from planning]
Contracts: [API/DB contracts defined] | Risks: [Main concerns documented]

Documentation: ✅ Linear updated with strategy and contracts
Environment: ✅ Pre-implementation checklist complete

Next: 04-implement RR-XXX
```

## Important Rules

- ✅ ALWAYS update Linear with strategy and test contracts
- ✅ ALWAYS check that planning phase was completed first
- ✅ ALWAYS generate test contracts as specifications
- ✅ ALWAYS provide symbol-level implementation guidance
- ✅ Update Linear issue status to "In Progress"
- ✅ Provide concise, actionable final output
- 🚫 NO file modifications during this phase (staging/documentation only)
- Be pragmatic about risk assessment and mitigation
- This command STAGES for implementation, it doesn't implement
- User decides when to use this phase based on 01-audit recommendations