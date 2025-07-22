module.exports = {
  apps: [
    // Production App
    {
      name: 'rss-reader-prod',
      script: 'npm',
      args: 'start',
      cwd: '/Users/shayon/DevProjects/rss-news-reader',
      instances: 1,
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3147,
        // Use existing database vars (same for both environments)
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
        // Shared vars
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        INOREADER_CLIENT_ID: process.env.INOREADER_CLIENT_ID,
        INOREADER_CLIENT_SECRET: process.env.INOREADER_CLIENT_SECRET,
        INOREADER_REDIRECT_URI: process.env.INOREADER_REDIRECT_URI,
        TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
        CLAUDE_SUMMARIZATION_MODEL: process.env.CLAUDE_SUMMARIZATION_MODEL,
        SYNC_MAX_ARTICLES: process.env.SYNC_MAX_ARTICLES,
        ARTICLES_RETENTION_LIMIT: process.env.ARTICLES_RETENTION_LIMIT
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
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        // Use existing database vars (same for both environments)
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
        // Shared vars
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        INOREADER_CLIENT_ID: process.env.INOREADER_CLIENT_ID,
        INOREADER_CLIENT_SECRET: process.env.INOREADER_CLIENT_SECRET,
        INOREADER_REDIRECT_URI: process.env.INOREADER_REDIRECT_URI,
        TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
        CLAUDE_SUMMARIZATION_MODEL: process.env.CLAUDE_SUMMARIZATION_MODEL,
        SYNC_MAX_ARTICLES: process.env.SYNC_MAX_ARTICLES,
        ARTICLES_RETENTION_LIMIT: process.env.ARTICLES_RETENTION_LIMIT
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
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
        // Server URL for API calls
        NEXT_PUBLIC_BASE_URL: 'http://localhost:3147'
      },
      error_file: './logs/cron-error.log',
      out_file: './logs/cron-out.log',
      time: true
    }
  ]
};