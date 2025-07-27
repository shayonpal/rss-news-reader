# Prepare for the next git release

I am looking to prepare for the next git release. Bring in each of these agents, one-by-one, and get them to review the entire codebase and look for potential errors, bugs and issues:

- `qa-engineer`
- `supabase-dba`
- `sync-reliability-monitor`

They should not be fixing anything. It will be a `read-only` review for them. Depending on their report, I want you also to review and then give me a final but concise report.

On the basis of that report, we'll decide whether to proceed with the release or not.

Once we're ready to release, ask `dev-ops-expert` to finally make the git release to main branch.

Remember, `dev` branch is our staging environment, and we deploy to production from the `main` branch.
