# Development Strategy - Shayon's News RSS Reader

## Overview

This document outlines the development workflow for the RSS Reader PWA using GitHub Issues and Projects for task management. The development will be done by Claude Code with PM oversight, focusing on a streamlined, single-developer workflow.

## Project Structure

### Hierarchy

```
Epic (GitHub Milestone)
├── User Story (GitHub Issue)
    ├── Development Task (GitHub Issue)
    ├── Development Task (GitHub Issue)
    └── Development Task (GitHub Issue)
```

### Key Principles

- **No Sprints**: Continuous development with milestone-based planning
- **No Time Estimates**: Focus on completion rather than time tracking
- **GitHub Native**: Use GitHub's issue numbering system
- **Single Developer**: Streamlined workflow for Claude Code
- **PM Oversight**: Strategic guidance and acceptance criteria validation

---

## GitHub Project Setup

### Project Configuration

**Project Name**: `Shayon's News Development`  
**Project Type**: Team project (for advanced features)  
**Visibility**: Private

### Project Columns

| Column          | Purpose                   | Color                 | Auto-Move Rules                              |
| --------------- | ------------------------- | --------------------- | -------------------------------------------- |
| **Backlog**     | New issues, not yet ready | `#8A90A0` (Gray)      | Default for new issues                       |
| **Ready**       | Issues ready to start     | `#1F883D` (Green)     | Manual move                                  |
| **In Progress** | Currently being worked on | `#FFA500` (Orange)    | Manual move                                  |
| **On Hold**     | Blocked or paused         | `#CF222E` (Red)       | Manual move                                  |
| **Done**        | Completed successfully    | `#8250DF` (Purple)    | Auto-move when closed                        |
| **Won't Do**    | Cancelled or rejected     | `#656D76` (Dark Gray) | Auto-move when closed with "won't fix" label |

### Custom Fields

| Field Name        | Type          | Options                                        | Purpose                       |
| ----------------- | ------------- | ---------------------------------------------- | ----------------------------- |
| **Epic**          | Single Select | Epic 1-7 names                                 | Link tasks to epics           |
| **Priority**      | Single Select | P0, P1, P2, P3                                 | Prioritization                |
| **Component**     | Single Select | Frontend, Backend, API, Documentation, Testing | Technical categorization      |
| **Status Detail** | Text          | -                                              | Additional context for status |

---

## Labels Strategy

### Epic Labels

- `epic-1-foundation` - Foundation & Authentication
- `epic-2-reading` - Core Reading Experience
- `epic-3-sync` - Content Synchronization & Processing
- `epic-4-ai` - AI-Powered Summarization
- `epic-5-offline` - Offline & Performance Optimization
- `epic-6-production` - Production Polish & Deployment
- `epic-7-ux` - User Experience Enhancements

### Issue Type Labels

- `user-story` - User stories from product requirements
- `task` - Development tasks (atomic, 1-3 hour chunks)
- `admin-task` - Infrastructure and project setup tasks
- `bug` - Bug fixes
- `enhancement` - Improvements to existing features
- `maintenance` - Dependencies, security updates, refactoring
- `research` - Technical spikes, proof of concepts
- `documentation` - Documentation updates

### Priority Labels

- `priority-p0` - Critical (blocking issues)
- `priority-p1` - High (important features/bugs)
- `priority-p2` - Medium (desired improvements)
- `priority-p3` - Low (nice-to-have enhancements)

### Component Labels

- `component-frontend` - React/Next.js components
- `component-backend` - API routes and server logic
- `component-api` - External API integrations
- `component-data` - Database and storage
- `component-pwa` - PWA-specific features
- `component-testing` - Test files and testing infrastructure
- `component-docs` - Documentation and guides

### Status Labels

- `status-blocked` - Cannot proceed due to dependency
- `status-needs-clarification` - Requires more information
- `status-ready-for-review` - Ready for PM review
- `wontfix` - Will not be implemented (triggers Won't Do column)

---

## Milestones Setup

### Milestone 1: Foundation (Weeks 1-2)

**Due Date**: 2 weeks from start  
**Description**: Basic app structure, authentication, and data storage

### Milestone 2: Core Reading (Weeks 3-4)

**Due Date**: 4 weeks from start  
**Description**: Feed display, article browsing, and reading interface

### Milestone 3: Content Processing (Weeks 5-6)

**Due Date**: 6 weeks from start  
**Description**: Article sync, content fetching, and storage management

### Milestone 4: AI Integration (Weeks 7-8)

**Due Date**: 8 weeks from start  
**Description**: Claude API integration and summary generation

### Milestone 5: Optimization (Weeks 9-10)

**Due Date**: 10 weeks from start  
**Description**: Offline support, performance, and sync optimization

### Milestone 6: Production (Weeks 11-12)

**Due Date**: 12 weeks from start  
**Description**: Production deployment, error handling, and polish

### Future Enhancements

**Due Date**: TBD  
**Description**: Post-v1 improvements and new features

---

## CLI Setup Commands

### 1. Create Repository Project

```bash
# Create the project
gh api graphql -f query='
mutation {
  createProjectV2(input: {
    ownerId: "YOUR_USER_ID"
    title: "Shayon'\''s News Development"
    repositoryId: "YOUR_REPO_ID"
  }) {
    projectV2 {
      id
      number
    }
  }
}'

# Note: Get YOUR_USER_ID and YOUR_REPO_ID first:
gh api user --jq '.id'
gh api repos/:owner/:repo --jq '.id'
```

### 2. Create Milestones

```bash
gh api repos/:owner/:repo/milestones -f title="Milestone 1: Foundation" -f description="Basic app structure, authentication, and data storage" -f due_on="2024-01-15T00:00:00Z"

gh api repos/:owner/:repo/milestones -f title="Milestone 2: Core Reading" -f description="Feed display, article browsing, and reading interface" -f due_on="2024-01-29T00:00:00Z"

gh api repos/:owner/:repo/milestones -f title="Milestone 3: Content Processing" -f description="Article sync, content fetching, and storage management" -f due_on="2024-02-12T00:00:00Z"

gh api repos/:owner/:repo/milestones -f title="Milestone 4: AI Integration" -f description="Claude API integration and summary generation" -f due_on="2024-02-26T00:00:00Z"

gh api repos/:owner/:repo/milestones -f title="Milestone 5: Optimization" -f description="Offline support, performance, and sync optimization" -f due_on="2024-03-11T00:00:00Z"

gh api repos/:owner/:repo/milestones -f title="Milestone 6: Production" -f description="Production deployment, error handling, and polish" -f due_on="2024-03-25T00:00:00Z"

gh api repos/:owner/:repo/milestones -f title="Future Enhancements" -f description="Post-v1 improvements and new features"
```

### 3. Create Labels

```bash
# Epic Labels
gh label create "epic-1-foundation" --description "Foundation & Authentication" --color "0E8A16"
gh label create "epic-2-reading" --description "Core Reading Experience" --color "0E8A16"
gh label create "epic-3-sync" --description "Content Synchronization & Processing" --color "0E8A16"
gh label create "epic-4-ai" --description "AI-Powered Summarization" --color "0E8A16"
gh label create "epic-5-offline" --description "Offline & Performance Optimization" --color "0E8A16"
gh label create "epic-6-production" --description "Production Polish & Deployment" --color "0E8A16"
gh label create "epic-7-ux" --description "User Experience Enhancements" --color "0E8A16"

# Issue Type Labels
gh label create "user-story" --description "User stories from product requirements" --color "1D76DB"
gh label create "task" --description "Development tasks (atomic, 1-3 hour chunks)" --color "1D76DB"
gh label create "admin-task" --description "Infrastructure and project setup tasks" --color "6F42C1"
gh label create "bug" --description "Bug fixes" --color "D73A49"
gh label create "enhancement" --description "Improvements to existing features" --color "A2EEEF"
gh label create "maintenance" --description "Dependencies, security updates, refactoring" --color "EDEDED"
gh label create "research" --description "Technical spikes, proof of concepts" --color "FEF2C0"
gh label create "documentation" --description "Documentation updates" --color "7057FF"

# Priority Labels
gh label create "priority-p0" --description "Critical (blocking issues)" --color "B60205"
gh label create "priority-p1" --description "High (important features/bugs)" --color "FF9500"
gh label create "priority-p2" --description "Medium (desired improvements)" --color "FBCA04"
gh label create "priority-p3" --description "Low (nice-to-have enhancements)" --color "0E8A16"

# Component Labels
gh label create "component-frontend" --description "React/Next.js components" --color "5319E7"
gh label create "component-backend" --description "API routes and server logic" --color "5319E7"
gh label create "component-api" --description "External API integrations" --color "5319E7"
gh label create "component-data" --description "Database and storage" --color "5319E7"
gh label create "component-pwa" --description "PWA-specific features" --color "5319E7"
gh label create "component-testing" --description "Test files and testing infrastructure" --color "5319E7"
gh label create "component-docs" --description "Documentation and guides" --color "5319E7"

# Status Labels
gh label create "status-blocked" --description "Cannot proceed due to dependency" --color "D93F0B"
gh label create "status-needs-clarification" --description "Requires more information" --color "FBCA04"
gh label create "status-ready-for-review" --description "Ready for PM review" --color "0E8A16"
```

### 4. Create Initial Issues (User Stories)

```bash
# Example for first user story
gh issue create \
  --title "Initial App Setup" \
  --body "**As a** tech-savvy news reader
**I want to** install the PWA on my device
**So that** I can access my news reader quickly from my home screen

## Acceptance Criteria
- [ ] PWA manifest is configured with app name, icons, and theme colors
- [ ] App can be installed on iOS and Android devices
- [ ] Service worker provides basic offline capabilities
- [ ] App icon appears on home screen after installation
- [ ] App launches in standalone mode when opened from home screen

## Epic
Foundation & Authentication

## Component
PWA" \
  --label "user-story,epic-1-foundation,priority-p1,component-pwa" \
  --milestone "Milestone 1: Foundation"
```

### 5. Set Up Project Automation Workflows

**IMPORTANT**: Create these workflows immediately after project setup so all future issues are automatically managed.

#### Create `.github/workflows/project-automation.yml`:

```yaml
name: RSS Reader Project Automation

on:
  issues:
    types: [opened, closed, reopened]

jobs:
  add_to_projects:
    runs-on: ubuntu-latest
    if: github.event.action == 'opened'
    steps:
      - name: Add to RSS Reader Project
        uses: actions/add-to-project@main
        with:
          project-url: https://github.com/users/shayonpal/projects/NEW_PROJECT_NUMBER
          github-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Add to Project 5
        uses: actions/add-to-project@main
        with:
          project-url: https://github.com/users/shayonpal/projects/5
          github-token: ${{ secrets.GITHUB_TOKEN }}

  update_status:
    runs-on: ubuntu-latest
    if: github.event.action == 'closed'
    steps:
      - name: Move to Done or Won't Do
        uses: actions/github-script@v6
        with:
          script: |
            const issue = context.payload.issue;
            const labels = issue.labels.map(label => label.name);

            // Determine target column based on labels
            if (labels.includes('wontfix')) {
              console.log('Issue closed as wontfix - should move to Won\'t Do column');
            } else {
              console.log('Issue completed - should move to Done column');
            }

            // Note: Actual project column updates require additional GraphQL mutations
            // This is a placeholder for the logic
```

#### Also leverage existing workflow:

The existing `.github/workflows/add-to-project5-workflow.yml` will handle adding to Project 5 automatically.

---

## Development Workflow

### 1. Starting Development (Claude Code Instructions)

**Current Project State**: Documentation and planning complete, ready for implementation

**Next Steps for Claude Code**:

1. **Set up development environment**:

   ```bash
   npm install
   npm run dev
   ```

2. **Review current project structure**:

   - Read `/docs/product/user-stories.md` for requirements
   - Check `/docs/tech/` for technical architecture
   - Review `CLAUDE.local.md` for project-specific guidelines

3. **Create first milestone issues**:

   - Start with Epic 1: Foundation & Authentication
   - Break down user stories into development tasks
   - Begin with US-001: Initial App Setup

4. **Development process**:
   - Pick next Ready issue from project board
   - Move to "In Progress"
   - Create feature branch: `feature/issue-[NUMBER]-brief-description`
   - Implement according to acceptance criteria
   - Test thoroughly (run `npm run test`, `npm run type-check`, `npm run lint`)
   - Commit with descriptive message referencing issue number
   - Close issue with commit message: "fixes #[NUMBER]"

### 2. Issue Management

**Creating User Stories**:

```bash
# Create parent user story
gh issue create \
  --title "Initial App Setup" \
  --body "**As a** tech-savvy news reader
**I want to** install the PWA on my device
**So that** I can access my news reader quickly from my home screen

## Acceptance Criteria
- [ ] PWA manifest is configured with app name, icons, and theme colors
- [ ] App can be installed on iOS and Android devices
- [ ] Service worker provides basic offline capabilities
- [ ] App icon appears on home screen after installation
- [ ] App launches in standalone mode when opened from home screen

## Epic
Foundation & Authentication" \
  --label "user-story,epic-1-foundation,priority-p1,component-pwa" \
  --milestone "Milestone 1: Foundation"
```

**Breaking Down into Atomic Tasks**:

```bash
# Break down user story into atomic development tasks
gh issue create \
  --title "Configure Next.js 14 project with TypeScript" \
  --body "## Description
Set up the basic Next.js 14 project structure with TypeScript configuration.

## Technical Requirements
- Initialize Next.js 14 with App Router
- Configure TypeScript with strict mode
- Set up proper folder structure (app/, components/, lib/, types/)
- Configure path aliases in tsconfig.json

## Acceptance Criteria
- [ ] Project builds successfully with TypeScript
- [ ] No TypeScript errors in development
- [ ] Proper folder structure in place
- [ ] Path aliases working correctly

## Parent Issue
Part of #[USER_STORY_NUMBER]" \
  --label "task,epic-1-foundation,priority-p1,component-frontend" \
  --milestone "Milestone 1: Foundation"

gh issue create \
  --title "Set up PWA manifest and service worker" \
  --body "## Description
Create PWA manifest.json and basic service worker for app installation.

## Technical Requirements
- Create public/manifest.json with app metadata
- Configure icons array with multiple sizes
- Set up basic service worker with Workbox
- Configure theme colors and display mode

## Acceptance Criteria
- [ ] Manifest validates with PWA tools
- [ ] App can be installed on mobile devices
- [ ] Service worker registers successfully
- [ ] Proper theme colors applied

## Parent Issue
Part of #[USER_STORY_NUMBER]" \
  --label "task,epic-1-foundation,priority-p1,component-pwa" \
  --milestone "Milestone 1: Foundation"
```

**Creating Admin Tasks**:

```bash
# Create infrastructure tasks
gh issue create \
  --title "Set up GitHub project automation workflow" \
  --body "## Description
Configure GitHub Actions to automatically add issues to project boards and update status.

## Technical Requirements
- Create .github/workflows/project-automation.yml
- Configure auto-add to RSS Reader project
- Set up status updates on issue close
- Test workflow with dummy issue

## Acceptance Criteria
- [ ] New issues automatically added to project
- [ ] Closed issues move to Done column
- [ ] Project 5 integration working
- [ ] Workflow runs without errors" \
  --label "admin-task,priority-p1,component-docs"
```

**Updating Issue Status**:

```bash
# Move to different project columns (manual for now)
# Use GitHub web interface or develop GraphQL mutations

# Add comments for progress updates
gh issue comment [NUMBER] --body "✅ PWA manifest created and tested on iOS Safari"

# Close when complete
gh issue close [NUMBER] --comment "Completed: PWA manifest configured and validated"
```

### 3. Branch Strategy

**Simple Feature Branches**:

```bash
# Create branch for issue
git checkout -b feature/issue-123-pwa-manifest

# Work and commit
git commit -m "Add PWA manifest configuration

- Configure app name, icons, and theme colors
- Set up proper display mode and orientation
- Add multiple icon sizes for different devices

Fixes #123"

# Push and auto-close issue
git push origin feature/issue-123-pwa-manifest
# Merge to main (no PR needed for single developer)
git checkout main
git merge feature/issue-123-pwa-manifest
git push origin main
```

### 4. Progress Tracking

**Daily Workflow**:

1. Check project board for Ready issues
2. Move issue to "In Progress"
3. Complete development task
4. Test implementation
5. Close issue and move to Done
6. Update milestone progress

**Weekly Reviews**:

1. Review milestone progress
2. Adjust priorities if needed
3. Plan next week's focus areas
4. Update project documentation

---

## Quality Gates

### Task Completion Checklist

- [ ] All acceptance criteria met
- [ ] Code follows TypeScript standards
- [ ] No console errors in development
- [ ] Component/function works as expected
- [ ] Responsive design verified (if UI component)
- [ ] Accessibility basics covered
- [ ] Related documentation updated

### Milestone Completion Criteria

- [ ] All user stories in milestone completed
- [ ] Core functionality working end-to-end
- [ ] No critical bugs remaining
- [ ] Performance targets met (where applicable)
- [ ] Ready for next milestone dependencies

---

## Integration with Existing Workflow

### Current Repository Setup

- Next.js 14 project structure ✅
- TypeScript configuration ✅
- Tailwind CSS ✅
- Basic development scripts ✅

### Additional Workflow Needed

- Project automation for issue management
- Auto-labeling based on file patterns
- Milestone progress tracking
- Dependency checking between issues

### Recommended GitHub Actions

1. **Auto-label issues based on content**
2. **Add new issues to project automatically**
3. **Update project status on issue close**
4. **Milestone progress tracking**
5. **Performance monitoring integration**

---

## Getting Started Checklist

### For PM (Setup Phase)

- [ ] Create GitHub project with specified columns
- [ ] Set up all milestones with due dates
- [ ] Create all labels with proper colors
- [ ] Create initial user story issues for Epic 1
- [ ] Configure project automation workflow
- [ ] Verify Claude Code has repository access

### For Claude Code (Development Phase)

- [ ] Review this development strategy document
- [ ] Read user stories document thoroughly
- [ ] Understand technical architecture from `/docs/tech/`
- [ ] Set up local development environment
- [ ] Verify all development commands work
- [ ] Start with first Ready issue in Epic 1
- [ ] Follow commit message conventions for auto-closing issues

### Success Metrics

- [ ] Issues are consistently updated and closed
- [ ] Milestone progress is visible and accurate
- [ ] Development velocity is sustainable
- [ ] Quality gates are consistently met
- [ ] Project board reflects actual development status

This strategy provides a complete framework for managing the RSS Reader development using GitHub's native tools while maintaining simplicity for a single-developer, PM-supervised project.
