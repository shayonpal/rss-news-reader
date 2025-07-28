#!/bin/bash

# Commit & Push Detector Hook for RSS Reader
# This hook detects when the user wants to commit and push
# and routes to git-expert agent with special permission flag

# Get the user prompt from stdin
USER_INPUT=$(cat)

# Extract the actual prompt text
PROMPT_TEXT=$(echo "$USER_INPUT" | jq -r '.prompt // empty' | tr '[:upper:]' '[:lower:]')

# Function to check if prompt indicates commit & push
wants_commit_push() {
    local prompt="$1"
    
    # Common phrases for commit & push
    local commit_phrases=(
        "commit & push"
        "commit and push"
        "c&p"
        "c & p"
        "commit + push"
        "commit then push"
        "commit, push"
        "commit changes and push"
        "git commit and push"
        "please commit and push"
    )
    
    # Check each phrase
    for phrase in "${commit_phrases[@]}"; do
        if [[ "$prompt" == *"$phrase"* ]]; then
            return 0
        fi
    done
    
    # Also check for just "push" after recent commits
    if [[ "$prompt" == *"push"* ]] && [[ "$prompt" == *"changes"* ]]; then
        return 0
    fi
    
    return 1
}

# Check if the prompt indicates commit & push
if wants_commit_push "$PROMPT_TEXT"; then
    GIT_INSTRUCTION="GIT COMMIT & PUSH REQUEST DETECTED!\n\n"
    GIT_INSTRUCTION="${GIT_INSTRUCTION}The user wants to commit and push changes. "
    GIT_INSTRUCTION="${GIT_INSTRUCTION}You MUST invoke the git-expert agent with explicit permission:\n\n"
    GIT_INSTRUCTION="${GIT_INSTRUCTION}Task(subagent_type=\"git-expert\", prompt=\"User has explicitly requested: commit and push all changes. "
    GIT_INSTRUCTION="${GIT_INSTRUCTION}You have FULL PERMISSION to execute git commit and git push. "
    GIT_INSTRUCTION="${GIT_INSTRUCTION}The user said: '${PROMPT_TEXT}'\")\n\n"
    GIT_INSTRUCTION="${GIT_INSTRUCTION}IMPORTANT: The git-expert agent should understand this as explicit permission to commit and push."
    
    echo "{
        \"decision\": \"approve\",
        \"reason\": \"Commit & push request - routing to git-expert\",
        \"additionalContext\": \"$GIT_INSTRUCTION\"
    }"
else
    # Not a commit/push prompt, allow normally
    echo '{
        "decision": "approve",
        "reason": "Prompt processed"
    }'
fi