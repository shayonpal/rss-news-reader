#!/bin/bash

# Load environment variables
source .env

# Export NEXT_PUBLIC variables for the build
export NEXT_PUBLIC_SUPABASE_URL
export NEXT_PUBLIC_SUPABASE_ANON_KEY
export NEXT_PUBLIC_BASE_URL="http://100.96.166.53"

echo "Building with environment variables..."
npm run build

echo "Build complete. Starting production server..."
pm2 restart rss-reader-prod