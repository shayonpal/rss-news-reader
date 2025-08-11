#!/bin/bash
# Run critical path tests with proper isolation
# This script ensures database lifecycle tests run without interference

set -e

echo "Running critical path tests with isolation..."

# Run database lifecycle tests separately with single thread
echo "1. Running database lifecycle tests..."
npx vitest run --no-coverage \
  --pool=forks \
  --poolOptions.forks.singleFork \
  src/lib/stores/__tests__/database-lifecycle.test.ts

# Run data store tests separately to avoid database conflicts
echo "2. Running data store tests..."
npx vitest run --no-coverage \
  --pool=forks \
  --poolOptions.forks.singleFork \
  src/lib/stores/__tests__/data-stores.test.ts

# Run UI store tests separately
echo "3. Running UI store tests..."
npx vitest run --no-coverage \
  --pool=forks \
  --poolOptions.forks.singleFork \
  src/lib/stores/__tests__/ui-store-collapse.test.ts

# Run other store tests
echo "4. Running tag store tests..."
npx vitest run --no-coverage \
  src/lib/stores/__tests__/tag-store.test.ts

# Run remaining critical tests
echo "5. Running remaining critical tests..."
npx vitest run --no-coverage \
  src/__tests__/unit/rr-176-auto-parse-logic.test.ts \
  src/lib/health/__tests__/*.test.ts

echo "All critical tests completed!"
