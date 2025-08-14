# Task Completion Checklist

## Before Declaring Any Task Complete

### 1. Code Quality Checks

```bash
npm run type-check              # Must pass with no errors
npm run lint                    # Must pass with no errors
npm run format:check            # Must be properly formatted
```

### 2. Run Tests

```bash
npm run test                    # Run appropriate test suite
# Or specific tests:
npm run test:unit              # For logic changes
npm run test:integration       # For API changes
npm run test:e2e               # For UI changes
```

### 3. Pre-Commit Validation

```bash
npm run pre-commit             # Must pass all checks
```

### 4. Manual Testing

- Test in development environment (http://100.96.166.53:3000/reader)
- Verify feature works as expected
- Check for console errors
- Test on mobile viewport if UI changes

### 5. Update Documentation

- Update CHANGELOG.md if significant change
- Update relevant docs in `docs/` folder
- Update Linear issue status if applicable

### 6. Service Health

```bash
pm2 status                     # All services should be online
pm2 logs --lines 50           # Check for recent errors
```

### 7. Database Checks (if applicable)

- Verify migrations applied correctly
- Check RLS policies still work
- Refresh materialized views if needed

## Critical Rules

1. **NEVER** commit without explicit permission
2. **NEVER** modify test files to make them pass
3. **NEVER** modify .env files
4. **ALWAYS** fix the code when tests fail
5. **ALWAYS** search for existing endpoints before creating new ones
6. **ALWAYS** maintain the `/reader` base path

## Final Verification

- [ ] All automated checks pass
- [ ] Manual testing completed
- [ ] No console errors
- [ ] Documentation updated if needed
- [ ] Services healthy
- [ ] Ready for review

## Common Issues to Check

- OAuth tokens valid (`~/.rss-reader/tokens.json`)
- Bi-directional sync server running (port 3001)
- Database connection working
- Tailscale VPN connected
- PM2 services not in error state
