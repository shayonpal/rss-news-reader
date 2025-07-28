#!/bin/bash

# Feature Completion Detector Hook for RSS Reader
# This hook detects when the user indicates a feature/task is complete
# and reminds Claude to call qa-engineer for comprehensive testing

# Get the user prompt from stdin
USER_INPUT=$(cat)

# Extract the actual prompt text
PROMPT_TEXT=$(echo "$USER_INPUT" | jq -r '.prompt // empty' | tr '[:upper:]' '[:lower:]')

# Function to check if prompt indicates completion
indicates_completion() {
    local prompt="$1"
    
    # Common phrases that indicate completion
    local completion_phrases=(
        "i'm done"
        "i am done"
        "finished implementing"
        "completed the"
        "feature is complete"
        "bug is fixed"
        "task is done"
        "implementation complete"
        "all done"
        "that's it"
        "ready for testing"
        "ready to test"
        "can you test"
        "please test"
        "check if it works"
        "verify this works"
        "ready for review"
        "ready to deploy"
        "ready for production"
    )
    
    # Check each phrase
    for phrase in "${completion_phrases[@]}"; do
        if [[ "$prompt" == *"$phrase"* ]]; then
            return 0
        fi
    done
    
    return 1
}

# Check if the prompt indicates completion
if indicates_completion "$PROMPT_TEXT"; then
    QA_REMINDER="FEATURE COMPLETION DETECTED!\n\n"
    QA_REMINDER="${QA_REMINDER}It sounds like you've completed a feature or bug fix. "
    QA_REMINDER="${QA_REMINDER}Before proceeding, please:\n\n"
    QA_REMINDER="${QA_REMINDER}1. Run final quality checks:\n"
    QA_REMINDER="${QA_REMINDER}   - npm run type-check\n"
    QA_REMINDER="${QA_REMINDER}   - npm run lint\n"
    QA_REMINDER="${QA_REMINDER}   - npm run test (if tests exist)\n\n"
    QA_REMINDER="${QA_REMINDER}2. Then invoke the qa-engineer for comprehensive testing:\n"
    QA_REMINDER="${QA_REMINDER}   Task(subagent_type=\"qa-engineer\", prompt=\"Test the implementation of: [describe what was implemented]\")\n\n"
    QA_REMINDER="${QA_REMINDER}This ensures your implementation is thoroughly tested before deployment."
    
    echo "{
        \"decision\": \"approve\",
        \"reason\": \"Feature completion detected - QA testing recommended\",
        \"additionalContext\": \"$QA_REMINDER\"
    }"
else
    # Not a completion prompt, allow normally
    echo '{
        "decision": "approve",
        "reason": "Prompt processed"
    }'
fi