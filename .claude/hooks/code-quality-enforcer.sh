#!/bin/bash

# Code Quality Enforcer Hook for RSS Reader
# This hook runs after code edits to ensure quality standards are met
# It runs type-check, lint, and invokes qa-engineer for comprehensive testing

# Get the tool input from stdin
TOOL_INPUT=$(cat)

# Extract relevant information from the JSON input
TOOL_NAME=$(echo "$TOOL_INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

# Function to check if file is TypeScript/JavaScript
is_code_file() {
    local file="$1"
    if [[ "$file" =~ \.(ts|tsx|js|jsx)$ ]]; then
        return 0
    fi
    return 1
}

# Function to check if file is an API route
is_api_route() {
    local file="$1"
    if [[ "$file" =~ src/app/api/.*route\.(ts|js)$ ]]; then
        return 0
    fi
    return 1
}

# Function to check for duplicate API endpoints
check_api_duplicates() {
    local new_route="$1"
    local route_dir=$(dirname "$new_route")
    local route_name=$(basename "$route_dir")
    
    # Search for other routes with similar names
    local duplicates=$(find src/app/api -name "route.ts" -o -name "route.js" | grep -v "$new_route" | xargs grep -l "export.*$route_name" 2>/dev/null || true)
    
    if [ -n "$duplicates" ]; then
        echo "WARNING: Possible duplicate API endpoints found for '$route_name' in: $duplicates"
        return 1
    fi
    return 0
}

# Only process Edit, Write, and MultiEdit operations
if [[ "$TOOL_NAME" =~ ^(Edit|Write|MultiEdit)$ ]]; then
    if [ -n "$FILE_PATH" ]; then
        
        # Check if it's a code file
        if is_code_file "$FILE_PATH"; then
            # Prepare quality check instructions
            QUALITY_CHECKS="QUALITY CHECK REQUIRED: You have just edited a code file ($FILE_PATH)."
            QUALITY_CHECKS="$QUALITY_CHECKS\n\nPlease run the following checks:"
            QUALITY_CHECKS="$QUALITY_CHECKS\n1. Type checking: Run 'npm run type-check'"
            QUALITY_CHECKS="$QUALITY_CHECKS\n2. Linting: Run 'npm run lint'"
            
            # Check if it's an API route
            if is_api_route "$FILE_PATH"; then
                QUALITY_CHECKS="$QUALITY_CHECKS\n3. Check for duplicate endpoints"
                
                # Check for duplicates
                if ! check_api_duplicates "$FILE_PATH"; then
                    QUALITY_CHECKS="$QUALITY_CHECKS\n\nWARNING: Possible duplicate API endpoint detected!"
                fi
            fi
            
            # Add note about qa-engineer for complete features
            QUALITY_CHECKS="$QUALITY_CHECKS\n\nNOTE: When you complete the entire feature/bug fix, invoke the qa-engineer agent:"
            QUALITY_CHECKS="$QUALITY_CHECKS\nTask(subagent_type=\"qa-engineer\", prompt=\"Test the complete implementation of [feature/bug fix description]\")"
            
            echo "{
                \"decision\": \"approve\",
                \"reason\": \"Code file modified - quality checks needed\",
                \"additionalContext\": \"$QUALITY_CHECKS\"
            }"
            exit 0
        fi
        
        # Check if environment variables were mentioned in edits
        if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
            # This is a simple check - in a real implementation, we'd analyze the actual edits
            ENV_CHECK="REMINDER: If you added any new environment variables in this code,"
            ENV_CHECK="$ENV_CHECK make sure to:\n1. Add them to .env.example"
            ENV_CHECK="$ENV_CHECK\n2. Update scripts/validate-env.sh to include the new variables"
            ENV_CHECK="$ENV_CHECK\n3. Use the exact variable names from .env (don't change .env to match your code)"
            
            echo "{
                \"decision\": \"approve\",
                \"reason\": \"Code file modified\",
                \"additionalContext\": \"$ENV_CHECK\"
            }"
            exit 0
        fi
    fi
fi

# Default: approve without additional context
echo '{
    "decision": "approve",
    "reason": "Operation completed"
}'