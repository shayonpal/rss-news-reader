# Program Manager Agent Integration

## Current Flow (Without Program Manager)
```mermaid
graph LR
    You[You - PM] --> CC[Claude Code]
    CC --> QA[qa-engineer]
    CC --> Git[git-expert]
    CC --> Release[release-manager]
    CC --> DBA[supabase-dba]
    
    Git --> GitHub
    QA --> Tests
    Release --> Deploy
    
    You -.Manual.-> Linear[Linear App]
```

## New Flow (With Program Manager)
```mermaid
graph LR
    You[You - PM] --> CC[Claude Code]
    CC --> PM[program-manager]
    PM --> QA[qa-engineer]
    PM --> Git[git-expert]
    PM --> Release[release-manager]
    PM --> DBA[supabase-dba]
    
    PM <--> Linear[Linear App]
    
    Git --> GitHub
    QA --> Tests
    Release --> Deploy
    
    style PM fill:#f9f,stroke:#333,stroke-width:4px
    style CC fill:#bbf,stroke:#333,stroke-width:2px
```

## Program Manager Tasks
```mermaid
graph TD
    PM[Program Manager] --> T1[Create Linear Issues]
    PM --> T2[Update Issue Status]
    PM --> T3[Track Progress]
    PM --> T4[Link Commits to Issues]
    PM --> T5[Generate Reports]
    PM --> T6[Manage Sprints]
    
    style PM fill:#f9f,stroke:#333,stroke-width:4px
```

## Integration Points (Minimal Enhancement)

### 1. Git Expert Integration
```mermaid
graph LR
    Git[git-expert] -->|Commit with RR-123| PM[program-manager]
    PM -->|Update Linear| Linear[RR-123: Done]
    
    style PM fill:#f9f,stroke:#333,stroke-width:2px
```

### 2. QA Engineer Integration  
```mermaid
graph LR
    QA[qa-engineer] -->|Found bug| PM[program-manager]
    PM -->|Create issue| Linear[RR-124: Bug Report]
    
    style PM fill:#f9f,stroke:#333,stroke-width:2px
```

### 3. Release Manager Integration
```mermaid
graph LR
    Release[release-manager] -->|v0.8.0 released| PM[program-manager]
    PM -->|Close issues| Linear[Close RR-120 to RR-123]
    
    style PM fill:#f9f,stroke:#333,stroke-width:2px
```

## Daily Workflow Example

```mermaid
sequenceDiagram
    participant You as You (PM)
    participant CC as Claude Code
    participant PM as program-manager
    participant Linear
    participant Git as git-expert
    
    You->>PM: What should I work on?
    PM->>Linear: Get open issues
    Linear-->>PM: RR-123, RR-124
    PM-->>You: Focus on RR-123 (high priority)
    
    You->>CC: Please implement RR-123
    CC->>CC: Writes code
    
    CC->>Git: Commit changes
    Git->>PM: Committed with "fix: RR-123"
    PM->>Linear: Update RR-123 to "In Review"
    PM-->>You: Great progress! RR-123 updated
```

## Quick Visual Summary

### Before Program Manager
```
You (PM) → Claude Code → Code gets written → You manually update Linear (often forget)
```

### After Program Manager  
```
You (PM) → Claude Code → program-manager → Linear updates automatically
```

### Key Benefits
- 🤖 **Automatic Linear sync**
- 📊 **Progress tracking**
- 🎯 **Daily focus lists**
- 🔗 **Links commits to issues**
- 📈 **Sprint reports**