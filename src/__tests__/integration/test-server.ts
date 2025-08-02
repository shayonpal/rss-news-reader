import { createServer } from 'http';
import next from 'next';
import { parse } from 'url';
import { loadEnvConfig } from '@next/env';
import type { Server } from 'http';

export async function setupTestServer(port: number): Promise<{ server: Server; app: any }> {
  // Load environment variables from .env.test (or .env as fallback)
  // Set NODE_ENV before loading config (Next.js uses this to determine which .env file to load)
  const originalNodeEnv = process.env.NODE_ENV;
  Object.defineProperty(process.env, 'NODE_ENV', {
    value: 'test',
    writable: true,
    enumerable: true,
    configurable: true
  });
  
  loadEnvConfig(process.cwd());
  
  // Additional test-specific overrides
  process.env.NEXT_BUILD_DIR = '.next-test';
  process.env.NEXT_TELEMETRY_DISABLED = '1';
  
  // Create Next.js app with proper configuration
  const app = next({ 
    dev: true, 
    dir: process.cwd(),
    conf: { 
      basePath: '/reader' 
    }
  });
  
  // Prepare the app (this compiles pages, etc.)
  await app.prepare();
  
  // Create HTTP server with proper request handling
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    const handle = app.getRequestHandler();
    handle(req, res, parsedUrl);
  });
  
  return { server, app };
}