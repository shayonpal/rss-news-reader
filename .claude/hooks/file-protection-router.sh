#!/bin/bash

# Smart File Protection & Agent Router Hook for RSS Reader
# This hook intercepts file operations and routes them to appropriate agents
# It also requires permission for critical files

# Get the tool input from stdin
TOOL_INPUT=$(cat)

# Extract relevant information from the JSON input
TOOL_NAME=$(echo "$TOOL_INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.tool_input.file_path // .tool_input.path // .tool_input.source // empty')
COMMAND=$(echo "$TOOL_INPUT" | jq -r '.tool_input.command // empty')

# Function to check if a file is critical
is_critical_file() {
    local file="$1"
    
    # Critical files that need permission
    if [[ "$file" == *"/.env"* ]] || \
       [[ "$file" == *"/ecosystem.config.js"* ]] || \
       [[ "$file" == *"/LaunchAgents/"* ]] || \
       [[ "$file" == *"/.rss-reader/tokens.json"* ]]; then
        return 0
    fi
    return 1
}

# Function to check if operation is git-related
is_git_operation() {
    local cmd="$1"
    if [[ "$cmd" =~ (git|gh).*(commit|push|merge|rebase|cherry-pick|tag|branch.*-[dD]) ]]; then
        return 0
    fi
    return 1
}

# Function to check if operation is database-related
is_db_operation() {
    local cmd="$1"
    local tool="$2"
    
    # Check for Supabase MCP tools
    if [[ "$tool" =~ mcp__supabase__.* ]]; then
        return 0
    fi
    
    # Check for SQL/migration keywords in bash commands
    if [[ "$cmd" =~ (supabase|migration|migrate|ALTER|CREATE|DROP|TRUNCATE|INSERT|UPDATE|DELETE)\ |psql|pg_dump ]]; then
        return 0
    fi
    
    return 1
}

# Function to check if file is markdown
is_markdown_file() {
    local file="$1"
    if [[ "$file" =~ \.(md|mdx|markdown)$ ]]; then
        return 0
    fi
    return 1
}

# Main routing logic
case "$TOOL_NAME" in
    "Edit"|"Write"|"MultiEdit")
        if [ -n "$FILE_PATH" ]; then
            # Check for markdown files
            if is_markdown_file "$FILE_PATH"; then
                echo '{
                    "decision": "approve",
                    "reason": "Markdown file - should use doc-admin agent",
                    "additionalContext": "IMPORTANT INSTRUCTION: You are about to edit a markdown file ('"$FILE_PATH"'). If you are not the doc-admin agent, you MUST stop this operation and invoke the doc-admin agent instead. Use: Task(subagent_type=\"doc-admin\", prompt=\"Edit the file '"$FILE_PATH"'\")"
                }'
                exit 0
            fi
            
            # Check for critical files
            if is_critical_file "$FILE_PATH"; then
                echo "{
                    \"decision\": \"block\",
                    \"reason\": \"Critical file modification requires explicit permission: $FILE_PATH. Please ask the user before modifying this file.\"
                }"
                exit 0
            fi
            
            # Check for .env variable name mismatches
            if [[ "$FILE_PATH" == *"/.env"* ]]; then
                echo '{
                    "decision": "approve",
                    "reason": "Environment file modification",
                    "additionalContext": "WARNING: You are modifying the .env file. IMPORTANT: Do NOT change variable names to match your code. Instead, fix your code to use the existing variable names in .env. Changing .env variable names breaks the application configuration."
                }'
                exit 0
            fi
        fi
        ;;
        
    "Bash")
        # Check for git operations
        if is_git_operation "$COMMAND"; then
            # Git commits need permission UNLESS we have explicit permission in command
            if [[ "$COMMAND" =~ git.*commit ]]; then
                # Check if command includes explicit permission flag
                if [[ "$COMMAND" == *"EXPLICIT_PERMISSION"* ]] || [[ "$COMMAND" == *"user has explicitly requested"* ]]; then
                    echo '{
                        "decision": "approve",
                        "reason": "Git commit with explicit user permission",
                        "additionalContext": "User has given explicit permission for this git operation."
                    }'
                else
                    echo '{
                        "decision": "block",
                        "reason": "Git commits require explicit user permission. Please ask before committing.",
                        "severity": "high"
                    }'
                fi
                exit 0
            fi
            
            # Other git write operations route to git-expert
            echo '{
                "decision": "approve",
                "reason": "Git operation - should use git-expert agent",
                "additionalContext": "IMPORTANT INSTRUCTION: You are about to perform a git write operation ('"$COMMAND"'). You MUST stop and invoke the git-expert agent with user permission. Use: Task(subagent_type=\"git-expert\", prompt=\"With user permission, execute: '"$COMMAND"'\")"
            }'
            exit 0
        fi
        
        # Check for database operations
        if is_db_operation "$COMMAND" "$TOOL_NAME"; then
            echo '{
                "decision": "approve",
                "reason": "Database operation - should use supabase-dba agent",
                "additionalContext": "IMPORTANT INSTRUCTION: You are about to perform a database operation ('"$COMMAND"'). You MUST stop and invoke the supabase-dba agent. Use: Task(subagent_type=\"supabase-dba\", prompt=\"Execute database operation: '"$COMMAND"'\")"
            }'
            exit 0
        fi
        ;;
        
    mcp__supabase__*)
        # All Supabase MCP operations go to DBA
        echo '{
            "decision": "approve",
            "reason": "Supabase MCP tool - should use supabase-dba agent",
            "additionalContext": "IMPORTANT INSTRUCTION: You are about to use a Supabase MCP tool ('"$TOOL_NAME"'). You MUST stop and invoke the supabase-dba agent. Use: Task(subagent_type=\"supabase-dba\", prompt=\"Handle Supabase operation using '"$TOOL_NAME"'\")"
        }'
        exit 0
        ;;
esac

# Default: approve the operation
echo '{
    "decision": "approve",
    "reason": "Operation permitted"
}'