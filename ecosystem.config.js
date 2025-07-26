require('dotenv').config();

module.exports = {
  apps: [
    // Production App
    {
      name: 'rss-reader-prod',
      script: 'npm',
      args: 'start',
      cwd: '/Users/shayon/DevProjects/rss-news-reader',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      env_file: '.env',
      env: {
        NODE_ENV: 'production',
        PORT: 3147,
        // Use existing database vars (same for both environments)
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        // Shared vars
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        INOREADER_CLIENT_ID: process.env.INOREADER_CLIENT_ID,
        INOREADER_CLIENT_SECRET: process.env.INOREADER_CLIENT_SECRET,
        INOREADER_REDIRECT_URI: process.env.INOREADER_REDIRECT_URI,
        TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
        CLAUDE_SUMMARIZATION_MODEL: process.env.CLAUDE_SUMMARIZATION_MODEL,
        SYNC_MAX_ARTICLES: process.env.SYNC_MAX_ARTICLES,
        ARTICLES_RETENTION_LIMIT: process.env.ARTICLES_RETENTION_LIMIT,
        // AI Summarization Configuration
        SUMMARY_WORD_COUNT: process.env.SUMMARY_WORD_COUNT || '150-175',
        SUMMARY_FOCUS: process.env.SUMMARY_FOCUS || 'key facts, main arguments, and important conclusions',
        SUMMARY_STYLE: process.env.SUMMARY_STYLE || 'objective'
      },
      error_file: './logs/prod-error.log',
      out_file: './logs/prod-out.log',
      time: true
    },
    
    // Development App
    {
      name: 'rss-reader-dev',
      script: 'npm',
      args: 'run dev',
      cwd: '/Users/shayon/DevProjects/rss-news-reader',
      instances: 1,
      exec_mode: 'fork',
      watch: false,  // Disable in PM2, Next.js handles HMR
      env_file: '.env',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        // Use existing database vars (same for both environments)
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        // Shared vars
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        INOREADER_CLIENT_ID: process.env.INOREADER_CLIENT_ID,
        INOREADER_CLIENT_SECRET: process.env.INOREADER_CLIENT_SECRET,
        INOREADER_REDIRECT_URI: process.env.INOREADER_REDIRECT_URI,
        TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
        CLAUDE_SUMMARIZATION_MODEL: process.env.CLAUDE_SUMMARIZATION_MODEL,
        SYNC_MAX_ARTICLES: process.env.SYNC_MAX_ARTICLES,
        ARTICLES_RETENTION_LIMIT: process.env.ARTICLES_RETENTION_LIMIT,
        // AI Summarization Configuration
        SUMMARY_WORD_COUNT: process.env.SUMMARY_WORD_COUNT || '150-175',
        SUMMARY_FOCUS: process.env.SUMMARY_FOCUS || 'key facts, main arguments, and important conclusions',
        SUMMARY_STYLE: process.env.SUMMARY_STYLE || 'objective'
      },
      error_file: './logs/dev-error.log',
      out_file: './logs/dev-out.log',
      time: true
    },
    
    // Sync Cron (always uses production database)
    {
      name: 'rss-sync-cron',
      script: './src/server/cron.js',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '0 0 * * *',  // Daily restart for stability
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        ENABLE_AUTO_SYNC: 'true',
        SYNC_CRON_SCHEDULE: '0 2,14 * * *',
        SYNC_LOG_PATH: './logs/sync-cron.jsonl',
        // Use production database
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        // Server URL for API calls
        NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3147/reader'
      },
      error_file: './logs/cron-error.log',
      out_file: './logs/cron-out.log',
      time: true
    },
    
    // Bi-directional Sync Server
    {
      name: 'rss-sync-server',
      script: './server/server.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        SERVER_PORT: 3001,
        // Sync configuration
        SYNC_INTERVAL_MINUTES: 5,
        SYNC_MIN_CHANGES: 5,
        SYNC_BATCH_SIZE: 100,
        SYNC_MAX_RETRIES: 3,
        SYNC_RETRY_BACKOFF_MINUTES: 10,
        // Database (same as main app)
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        // Inoreader OAuth
        INOREADER_CLIENT_ID: process.env.INOREADER_CLIENT_ID,
        INOREADER_CLIENT_SECRET: process.env.INOREADER_CLIENT_SECRET,
        INOREADER_REDIRECT_URI: process.env.INOREADER_REDIRECT_URI,
        // Token encryption
        TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
        // Token path (expand ~ to full path)
        RSS_READER_TOKENS_PATH: '/Users/shayon/.rss-reader/tokens.json'
      },
      error_file: './logs/sync-server-error.log',
      out_file: './logs/sync-server-out.log',
      time: true
    }
  ]
};