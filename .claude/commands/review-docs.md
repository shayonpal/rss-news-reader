---
description: Review and update documentation files against codebase reality
argument_hint: <document1> [document2] [...]
---

# Review Docs - Documentation Consistency Manager

Analyzes the codebase as source of truth and updates documentation files to ensure accuracy, consistency, and completeness.

## Instructions

**Parse and validate document paths:**

```bash
# Parse arguments
ARGS_ARRAY=($ARGUMENTS)
DOC_PATHS=("${ARGS_ARRAY[@]}")

# Validate we have at least 1 document to review
if [ ${#ARGS_ARRAY[@]} -lt 1 ]; then
  echo "❌ Error: No documents provided"
  echo "Usage: review-docs <document1> [document2] [...]"
  exit 1
fi
```

### Step 1: Validate Document Paths

**Check that all document paths exist and are readable:**

```bash
echo "🔍 Validating document paths..."

for doc in "${DOC_PATHS[@]}"; do
  if [ ! -f "$doc" ]; then
    echo "❌ Error: Document not found: $doc"
    exit 1
  fi
done

echo "✅ All document paths validated"
```

### Step 2: Read Documentation First

**Use doc-search to understand what each document claims:**

For each document in the DOC_PATHS array:

**2a. Read Documentation Content:**

```
doc-search, please read and analyze this documentation file:

Document: ${doc}

Extract the following information from the documentation:
1. **API Endpoints Listed**: What endpoints are documented with their methods and purposes
2. **Database References**: What tables, schema, or database operations are described
3. **Infrastructure Details**: Services, configuration, deployment info mentioned
4. **Architecture Claims**: How the system is described to work
5. **Feature Descriptions**: What functionality is documented and how it works
6. **Code Examples**: Any code snippets or implementation details shown
7. **Configuration Requirements**: Environment variables, setup instructions, dependencies
8. **Integration Points**: External services, authentication flows, sync mechanisms mentioned

Provide a structured summary of what this documentation claims exists and how it should work.
```

### Step 3: Analyze Codebase Reality Using Specialized Agents

**Now coordinate multiple specialized agents to understand actual implementation, targeting areas mentioned in documentation:**

**3a. Database Analysis (Based on Documentation Claims):**

```
db-expert-readonly, analyze the current database schema focusing on areas mentioned in the documentation:

Based on the documentation analysis above, please verify:
1. **Tables**: Check if documented tables exist with correct columns and data types
2. **Relationships**: Verify foreign keys, constraints, indexes mentioned in docs
3. **RPC Functions**: Validate any custom functions or stored procedures referenced
4. **Views**: Check for any database views or materialized views mentioned
5. **Migrations**: Review recent schema changes that may affect documented features

Additionally provide:
- Any tables/relationships that exist but weren't documented
- Schema differences from what documentation describes
- Missing or incorrect database references in documentation

Provide the actual database structure as it exists now, highlighting documentation accuracy.
```

**3b. Infrastructure and Configuration Analysis (Based on Documentation Claims):**

```
devops-expert, analyze the deployment and infrastructure setup, focusing on what documentation describes:

Based on the documentation analysis above, please verify:
1. **PM2 Services**: Check if documented services exist (rss-reader-dev, rss-sync-cron, rss-sync-server)
2. **Environment Configuration**: Validate documented environment variables and their purposes
3. **Deployment Setup**: Verify build processes, deployment scripts mentioned in docs
4. **Network Configuration**: Check port mappings, base paths (/reader prefix) as documented
5. **Service Dependencies**: Validate how services interact as described

Additionally provide:
- Infrastructure components that exist but aren't documented
- Configuration differences from documentation
- Missing or incorrect infrastructure details in docs

Provide the actual infrastructure setup as deployed, highlighting documentation gaps.
```

**3c. Technical Architecture Analysis (Based on Documentation Claims):**

```
tech-expert, analyze the codebase implementation focusing on what documentation describes:

Based on the documentation analysis above, please verify:
1. **API Endpoints**: Check if documented routes exist with correct methods, parameters, responses
2. **Core Features**: Validate documented components, services, business logic implementation
3. **Code Architecture**: Verify file structure, module organization mentioned in docs
4. **Integration Points**: Check external APIs, authentication flows, sync mechanisms as documented
5. **Dependencies**: Validate key packages and usage patterns mentioned
6. **OpenAPI Documentation**: Compare documented API coverage with actual implementation

Additionally provide:
- Implementation details that exist but aren't documented
- Code architecture differences from documentation
- Missing or incorrect technical details in docs

Provide comprehensive technical implementation details as they exist in code, highlighting documentation accuracy.
```

**3d. Version Control Context (Based on Documentation Claims):**

```
git-expert, provide version control context focusing on documentation relevance:

Based on the documentation analysis above, please check:
1. **Recent Changes**: Last 10 commits and whether they affected documented features
2. **Branch Structure**: Validate current branch, main branch info mentioned in docs
3. **Issue References**: Check if Linear issues mentioned in docs align with recent commits
4. **Release Status**: Verify current version and deployment status vs documentation
5. **File Changes**: Identify recent additions, modifications, deletions affecting documented areas

Additionally provide:
- Recent changes that should be documented but aren't
- Documentation that references outdated or removed features
- Version control patterns not captured in documentation

Provide git context showing how current development state aligns with documentation.
```

### Step 4: Compare Documentation Claims Against Codebase Reality

**Systematically compare each document's claims against specialist findings:**

For each document analyzed:

**4a. Identify Discrepancies:**

```
Now compare the documentation content from Step 2 against the specialist analyses from Step 3:

**Database Discrepancies:**
- Compare documented tables/schema vs db-expert-readonly findings
- Identify missing tables, incorrect column types, outdated relationships
- Note any undocumented database features

**Infrastructure Mismatches:**
- Compare documented services vs devops-expert PM2 service analysis
- Check environment variables, ports, deployment details accuracy
- Identify missing or incorrect infrastructure documentation

**Technical Implementation Gaps:**
- Compare documented APIs vs tech-expert endpoint analysis
- Check feature descriptions vs actual code implementation
- Verify architecture claims vs actual code structure
- Note any undocumented features or endpoints

**Version Control Alignment:**
- Check if documentation reflects recent changes from git-expert analysis
- Identify if recent commits invalidated documented information
- Flag outdated version or release references

For each discrepancy found, provide:
- **Section/Line**: Where in the doc the issue exists
- **Current Content**: What the doc currently says
- **Reality**: What the specialists found in actual implementation
- **Impact**: How significant the discrepancy is
- **Action Needed**: Update, remove, or add content with priority level
```

### Step 5: Compile and Present Change Plan

**Aggregate all findings into a structured plan:**

```
## 📋 Documentation Review Plan

### Source of Truth
**Codebase Analysis:** Current implementation state
**Analysis Date:** $(date)

### Documents Reviewed
$(for doc in "${DOC_PATHS[@]}"; do echo "- $doc"; done)

---
```

**For each document, present findings in this format:**

```
#### Proposed Changes for \`${doc}\`:

**Updates (Inaccurate Content):**
- [Specific issue]: [Proposed fix based on actual code]
- [Line/section]: [Current content] → [Corrected content]

**Removals (No Longer Exists):**
- [Section to remove]: [Reason - not in current codebase]
- [Outdated feature]: [Why it should be removed]

**Additions (Missing Information):**
- [New section needed]: [Content to add from codebase]
- [Missing implementation]: [Details to document]

**Consistency Improvements:**
- [Terminology]: [Current term] → [Actual code term]
- [File paths]: [Update to reflect current structure]

---
```

### Step 6: Request User Approval

**Present the complete plan and await confirmation:**

```
## 🔍 Review Complete

I've analyzed the codebase as source of truth and reviewed ${#DOC_PATHS[@]} document(s).

**Summary:**
- Total issues identified: [count across all categories]
- Documents requiring updates: [count of docs with changes]
- Most common issue type: [updates/removals/additions]

**Review the detailed plan above. Would you like me to proceed with applying these changes?**

**Options:**
- **yes** - Apply all proposed changes
- **selective** - Choose specific changes to apply
- **no** - Cancel without making changes
- **revise** - Request modifications to the plan

Please confirm how you'd like to proceed.
```

### Step 7: Apply Approved Changes

**If user approves, execute changes using doc-admin agent:**

```bash
if [[ "$USER_RESPONSE" == "yes" ]]; then
  echo "✅ Applying all proposed changes..."

  for doc in "${DOC_PATHS[@]}"; do
    echo "📝 Updating $doc..."
    echo "Using doc-admin agent for write operations..."
  done

elif [[ "$USER_RESPONSE" == "selective" ]]; then
  echo "📋 Please specify which changes to apply..."
  # Interactive selection process

else
  echo "❌ Documentation review cancelled"
  exit 0
fi
```

**For each document being updated, use doc-admin agent:**

```
doc-admin, please update the following documentation file based on our comprehensive codebase analysis:

**Document:** ${doc}

**Changes to Apply:**
[Pass the specific changes identified for this document organized by type:]

**Database Updates:**
- [Specific schema corrections based on db-expert-readonly analysis]

**Infrastructure Updates:**
- [Service configuration corrections based on devops-expert analysis]

**Technical Implementation Updates:**
- [API endpoint corrections based on tech-expert analysis]
- [Architecture updates based on actual code structure]

**Content to Remove:**
- [Outdated sections that no longer exist in codebase]

**Content to Add:**
- [Missing implementations found by specialists but not documented]

**Requirements:**
1. Make changes incrementally and verify each one
2. Preserve existing formatting and markdown structure
3. Maintain proper syntax and readability
4. Cross-reference changes with specialist findings
5. Ensure accuracy against actual implementation
6. Provide detailed summary of changes made

Please confirm each change category before applying and summarize what was updated.
```

### Step 8: Validation and Summary

**Verify changes and provide completion report:**

```bash
echo "🔄 Validating updated documents..."

# Check that all files are still valid
for doc in "${DOC_PATHS[@]}"; do
  if [ ! -f "$doc" ]; then
    echo "⚠️  Warning: $doc may have been corrupted"
  else
    echo "✅ $doc updated successfully"
  fi
done
```

## Output Format

```
## 📚 Documentation Review Complete

### 📊 Summary
- **Source of Truth:** Current codebase implementation
- **Documents Reviewed:** ${#DOC_PATHS[@]}
- **Total Changes Applied:** [count]
- **Update Types:**
  - Content Updates: [count]
  - Content Removals: [count]
  - Content Additions: [count]
  - Consistency Fixes: [count]

### 📝 Changes Applied
$(for doc in "${DOC_PATHS[@]}"; do
  echo "#### $doc"
  echo "- [Summary of changes made]"
  echo ""
done)

### 💡 Next Steps
- Review updated documents for accuracy
- Update any cross-references in related files
- Consider running documentation validation tools
- Commit changes with descriptive message

### 🔗 Quick Access
$(for doc in "${DOC_PATHS[@]}"; do echo "- [$doc]($doc)"; done)
```

## Error Handling

**File Access Errors:**

```bash
if [ ! -r "$doc" ]; then
  echo "❌ Error: Cannot read document: $doc"
  echo "Check file permissions and path accuracy"
  exit 1
fi
```

**Agent Availability:**

```bash
# If required agents are not available
echo "❌ Error: Required specialized agents not available"
echo "This command requires multiple agents:"
echo "  - doc-search: For reading markdown documentation files"
echo "  - doc-admin: For writing/updating markdown documentation files"
echo "  - tech-expert: For analyzing codebase implementation and APIs"
echo "  - db-expert-readonly: For analyzing database schema and structure"
echo "  - devops-expert: For infrastructure, deployment, PM2 services"
echo "  - git-expert: For version control information and recent changes"
echo "Please ensure all agents are properly configured"
exit 1
```

**Validation Failures:**

```bash
# If updated documents have issues
echo "⚠️  Warning: Some documents may need manual review"
echo "Please verify that all changes were applied correctly"
echo "Run validation tools if available"
```

## Integration Notes

### Agent Coordination Strategy

**Phase 1 - Documentation Analysis (Read-Only):**

- **doc-search**: Read markdown documentation files and extract structured content
- Understand what the documentation claims before analyzing reality

**Phase 2 - Targeted Reality Analysis (Read-Only Specialists):**

- **db-expert-readonly**: Database schema analysis focusing on documented claims
- **devops-expert**: Infrastructure analysis targeting documented services/config
- **tech-expert**: Code implementation analysis verifying documented APIs/features
- **git-expert**: Version control context checking documentation relevance

**Phase 3 - Comparison and Discrepancy Identification:**

- Compare documentation claims vs specialist findings from Phase 2
- Identify gaps, inaccuracies, and missing documentation
- Categorize discrepancies by impact and priority

**Phase 4 - Planning and Approval:**

- Generate comprehensive change plans with specific section/line references
- Present structured plan for user approval with priority levels

**Phase 5 - Implementation (Write Operations):**

- **doc-admin**: Apply approved changes to markdown documentation files only
- Incremental updates with validation at each step

### Key Features

- **Documentation-first analysis**: Reads documentation claims before analyzing implementation
- **Targeted codebase analysis**: Specialists focus on areas mentioned in documentation
- **Multi-specialist approach**: Leverages domain expertise for comprehensive verification
- **Efficient workflow**: Targeted analysis is more efficient than broad codebase review
- **Structured comparison**: Systematic comparison of documented claims vs actual reality
- **Priority-based planning**: Discrepancies categorized by impact and significance
- **Interactive approval**: User controls what changes are applied
- **Detailed change tracking**: Specific references to sections, lines, and discrepancies
- **Safe write operations**: Only doc-admin modifies files, only markdown docs
- **Error recovery**: Graceful handling of agent availability and validation failures
