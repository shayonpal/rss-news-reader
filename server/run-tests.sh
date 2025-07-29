#\!/bin/bash

# RSS Reader Server Tests Runner
# For testing bidirectional-sync service (RR-66)

echo "🧪 Running RSS Reader Server Tests..."
echo "=================================="

# Check if we're in the server directory
if [ \! -f "package.json" ]; then
    echo "❌ Error: Must run from server directory"
    echo "   cd /Users/shayon/DevProjects/rss-news-reader/server"
    exit 1
fi

# Install dependencies if needed
if [ \! -d "node_modules" ]; then
    echo "📦 Installing test dependencies..."
    npm install
fi

# Run tests based on argument
case "$1" in
    "unit")
        echo "🔬 Running unit tests..."
        npm run test:unit
        ;;
    "integration")
        echo "🔗 Running integration tests..."
        npm run test:integration
        ;;
    "coverage")
        echo "📊 Running tests with coverage..."
        npm run test:coverage
        ;;
    "watch")
        echo "👀 Running tests in watch mode..."
        npm run test:watch
        ;;
    *)
        echo "🚀 Running all tests..."
        npm test
        ;;
esac

echo ""
echo "✅ Test run complete\!"
