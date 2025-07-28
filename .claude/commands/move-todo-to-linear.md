---
name: Move tasks from codebase to Linear as Issues
---

I am looking to move my task tracker from docs/TODOs.md & docs/shipped-todos.md to Linear.

# Linear Details

**Team Name:** RSS Reader
**Team ID:** `11b90e55-2b59-40d3-a5d3-9e609a89a4f8`
**Organisation:** AgileCode Studio

Search for the TODO mentioned below in either docs/TODOs.md (if it's incomplete) or docs/shipped-todos.md (if it's complete) by using the `doc-admin` agent, and get details about it from each of these sources:

- `docs/TODOs.md`
- `docs/shipped-todos.md`
- `CHANGELOG.md`
- Possible Implementation strategy for the task in `docs/tech/implementation-strategy.md`
- Other implementation related docs in the dir and sub-directories of `docs/`. Logically figure out which docs to look into.

Next:

- Query the MCP server and look for existing issues (any status) and confirm the task has not been added to Linear already. Move on to the next step only when you've confirmed it's not added yet. Else, just mark it as moved to Linear using the format below and  respond with the Linear issue that, you think, duplicates this task.
- Query the MCP server for issue labels set up for the organisation. Out of those, choose appropriate labels for this issue.
- Copy the task (mentioned below) as an issue to the Linear app using the Linear MCP server.
- In the todo doc, mark it as moved to Linear using this format - "- **Linear Issue**: [RR-6](https://linear.app/agilecode-studio/issue/RR-6/fix-favicon-not-loading-on-ipad-in-production)"

If it is a completed task:

- Ask `doc-admin` to research existing documentation and `git-expert` to research past git commits to understand how it was implemented, and add the implementation details as comments in the same issue.
- Also mark the issue as `Done`.

Follow the above mentioned pattern exactly. Once done, report your outcome in this format:

```
Copied this new issue and added a comment about it's implementation details:
**RR-13 - Environment Variable Management**
  - Status: Done ✅
  - Priority: Urgent
  - Project: Server Stability & Monitoring Infrastructure
  - Labels: Infrastructure, Backend, Technical Debt
  - URL: https://linear.app/agilecode-studio/issue/RR-13/environment-variable-management
```

Once all of this is done, suggest 3 more tasks to move, that haven't yet been marked as moved to Linear.

---

$ARGUMENTS
