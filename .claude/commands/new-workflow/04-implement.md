---
description: Step 4 - Implementation with API-first documentation and Test-After-Done methodology
argument_hint: [issued ID or feature description]
---

# Step 4: Implement - API-First Implementation Phase

Complete implementation phase that takes prepared specifications and implements working functionality. Adopts API-first documentation approach and prepares for Test-After-Done methodology.

## Instructions

Always activate Serena MCP at session start:

```bash
# Activate Serena MCP for project context and symbol navigation
mcp__serena__activate_project
```

### Phase 1: Preparation Verification and Setup

1. **Validate Prerequisites**

   ```bash
   # Check if planning/staging was completed
   # Look for strategy in Linear comments or ask user to provide strategy

   # Verify development environment
   npm run type-check && npm run lint
   ```

2. **Implementation Context Setup**

   ```bash
   # Update issue status
   # Use linear-expert to update issue status to "In Progress" if not already

   # Verify baseline tests pass
   npm test
   ```

### Phase 1.5: Implementation Pattern Lookup

Use Serena memories to find proven implementation patterns:

1. **Search for Similar Implementations**:

   ```
   Use mcp__serena__read_memory to access relevant memories:
   - completed_issue_implementations.md (successful patterns)
   - issue_learnings_consolidated.md (gotchas and solutions)
   - code_conventions.md (project standards)

   Search by issue keywords and technical domain:
   - For sync issues: rr256_auto_fetch_implementation_complete.md
   - For UI issues: rr253_violet_button_implementation.md, ui_design_systems_consolidated.md
   - For API issues: rr272_preferences_api_implementation_patterns.md
   - For performance: rr-248-performance-patterns.md
   - For settings: rr274_settings_implementation_complete.md
   - For testing: testing_infrastructure_consolidated.md
   ```

2. **Extract Proven Patterns**:

   ```
   From memory findings, identify:
   - Successful implementation approaches for this type of issue
   - Common gotchas and prevention strategies
   - Performance patterns and optimizations
   - Code conventions and architectural decisions
   - Specific implementation templates that worked
   - Symbol-level patterns and reusable code
   ```

3. **Apply Pattern Guidance**:

   ```
   🎯 Memory-Guided Implementation for RR-XXX:

   Similar Issues Found: [List 2-3 relevant past implementations with effort/success]

   Proven Patterns to Reuse:
   - [Pattern 1]: [specific approach that worked] - from [memory file]
   - [Pattern 2]: [code structure that succeeded] - from [memory file]
   - [Pattern 3]: [performance optimization applied] - from [memory file]

   Known Gotchas to Avoid:
   - [Known failure mode]: [how to prevent] - learned from [issue]
   - [Performance trap]: [optimization approach] - from performance patterns
   - [Integration issue]: [solution strategy] - from past experience

   Reusable Code Templates:
   - [Symbol path]: [what it does and how to adapt] - from [successful issue]
   - [Utility pattern]: [when to use and how] - from conventions

   Estimated Effort: [X hours] (based on similar issues: [reference implementations])
   ```

### Phase 2: API-First Documentation Generation

### 2A. Detect API Work

Check if this implementation involves API endpoints:

```bash
# From Linear issue or planning strategy, identify if:
- New API endpoints need to be created
- Existing API endpoints need modification
- Request/response schemas need changes
```

### 2B. Generate OpenAPI Specifications (If API Work Detected)

**Before writing any route handler code, generate OpenAPI documentation:**

Use Serena MCP to understand existing API patterns:

1. **Analyze Existing API Structure**:
   - `get_symbols_overview` on src/app/api/ to understand route patterns
   - `find_symbol` for existing route handlers to understand request/response patterns
   - `search_for_pattern` for existing Zod schemas in OpenAPI registry

2. **Generate API Contract First**:

   ```typescript
   // Example: Generate this BEFORE implementing the route

   // In src/lib/openapi/registry.ts
   const newEndpointSchema = z.object({
     // Request schema based on requirements
     input: z.object({
       field1: z.string(),
       field2: z.number().optional(),
     }),
     // Response schema based on expected output
     output: z.object({
       success: z.boolean(),
       data: z.object({
         id: z.string(),
         result: z.string(),
       }),
     }),
   });

   // Register endpoint with documentation
   registerApiEndpoint({
     method: "POST",
     path: "/api/new-feature",
     description: "Creates new feature based on requirements",
     requestSchema: newEndpointSchema.shape.input,
     responseSchema: newEndpointSchema.shape.output,
     examples: {
       request: { field1: "example", field2: 123 },
       response: { success: true, data: { id: "uuid", result: "created" } },
     },
   });
   ```

3. **Validate API Design**:

   ```bash
   # Run OpenAPI validation to ensure spec is correct
   npm run docs:validate

   # Check coverage increases
   node scripts/validate-openapi-coverage.js
   ```

### 2C. Implementation Contract

The generated OpenAPI spec now serves as the **implementation contract**:

- Route handler MUST match the schema exactly
- Request validation uses the Zod schema
- Response format follows the documented structure
- Error handling matches documented error responses

### Phase 3: Implementation Against Contracts

1. **Contract-Driven Implementation**

   ```bash
   # For API endpoints: Implement to match pre-defined OpenAPI specs
   # For other features: Implement according to planning strategy

   # Use Serena MCP for targeted code modifications
   mcp__serena__replace_symbol_body symbol:"[component-name]" new_body:"[implementation]"

   # For APIs: Ensure implementation matches OpenAPI schema exactly
   ```

2. **Implementation Pattern** (Simplified from TDD)
   - **Plan**: Use approved strategy from planning phase
   - **Implement**: Build working functionality
   - **Validate**: Quick manual testing and quality checks
   - **Prepare**: Ready for testing phase

3. **Basic Quality Checks**

   ```bash
   # Quick quality checks during implementation
   npm run lint
   npm run type-check
   npm run build

   # API validation if APIs were modified
   npm run docs:validate
   ```

### Phase 4: Implementation Verification

1. **Feature Functionality Test**

   ```bash
   # Manual testing to verify feature works
   # For APIs: Test endpoints manually or with curl
   # For UI: Verify components render and function
   # For backend: Verify logic executes correctly
   ```

2. **API Documentation Validation** (if applicable)

   ```bash
   # Validate OpenAPI coverage increased
   ./scripts/validate-openapi-coverage.js

   # Check that new/modified endpoints are properly documented
   npm run docs:validate
   ```

3. **Basic Integration Check**
   - Verify feature works with existing functionality
   - Test critical user workflows
   - Check for obvious regressions

### Phase 5: Implementation Complete

1. **Implementation Verification**

   ```bash
   # Verify all changes are ready (but do not commit)
   git status
   git diff

   # Implementation complete and ready for review
   ```

2. **Prepare for Review**

   ```bash
   # Do NOT update Linear yet - manual verification needed first
   # Implementation ready for code review and manual testing
   ```

## Output Format

```
✅ RR-XXX Implementation Complete

Implementation: [One sentence summary of what was built]

Files Modified:
- src/[file1].ts: [What was changed and why]
- src/[file2].tsx: [What was changed and why]
- src/lib/openapi/registry.ts: [OpenAPI specs added/modified]

Symbols Modified:
- [ComponentName/methodName]: [What changed in this function/class]
- [StoreName/actionName]: [State management changes]
- [ServiceName/functionName]: [Business logic changes]

APIs: [New/Modified endpoints with OpenAPI coverage] | Total Files: [X modified]

Quality Checks:
- TypeScript: ✅ No errors
- Linting: ✅ All rules passed
- Build: ✅ Successful
- API Docs: ✅ Coverage validated (if applicable)

Status: Ready for manual verification
Next:
1. Manually test the implementation
2. If good: Update Linear with implementation details, then run 05-review RR-XXX
3. If needs fixes: Re-run 04-implement RR-XXX with specific fixes needed
```

## Error Handling

- **If planning not found**: Request strategy from user or reference Linear comments
- **If API validation fails**: Fix OpenAPI documentation before proceeding
- **If quality checks fail**: Address issues before marking complete
- **If implementation incomplete**: Continue iteration until working

## Implementation Philosophy

- **API-First**: Generate OpenAPI specs before implementation to prevent documentation gaps
- **Test-After-Done**: No dependency on pre-written tests - implement working functionality first
- **Contract-Driven**: Use OpenAPI specs as implementation contracts for APIs
- **Memory-Guided**: Leverage proven patterns from Serena memories
- **Quality-Gated**: Basic validation without comprehensive testing (that comes in 06-test)
- **Manual Verification**: Verify functionality works before proceeding to review

## Key Rules

- ✅ ALWAYS generate OpenAPI specs BEFORE implementing API endpoints
- ✅ ALWAYS validate API documentation coverage if APIs modified
- ✅ ALWAYS run basic quality checks (type-check, lint, build)
- ✅ ALWAYS prepare implementation for manual verification
- ✅ ALWAYS implement working functionality first
- ✅ ALWAYS provide concise, actionable output
- 🚫 NO comprehensive testing in this phase (that's 06-test)
- 🚫 NO test generation in this phase
- Focus on working implementation with quality gates
