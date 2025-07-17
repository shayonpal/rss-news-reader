import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

interface LogEntry {
  timestamp: string;
  endpoint: string;
  trigger: string;
  method: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as LogEntry;
    
    // Add timestamp if not provided
    const logEntry: LogEntry = {
      timestamp: body.timestamp || new Date().toISOString(),
      endpoint: body.endpoint,
      trigger: body.trigger,
      method: body.method || 'GET'
    };

    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), 'logs');
    await fs.mkdir(logsDir, { recursive: true });

    // Append to JSONL file
    const logFile = path.join(logsDir, 'inoreader-api-calls.jsonl');
    const logLine = JSON.stringify(logEntry) + '\n';
    
    await fs.appendFile(logFile, logLine, 'utf8');

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Failed to log API call:', error);
    // Don't fail the main app if logging fails
    return NextResponse.json({ success: false }, { status: 200 });
  }
}