import { NextResponse } from 'next/server';

// TODO: This endpoint is a placeholder for bidirectional sync functionality
// The actual implementation runs as a separate Node.js server on port 3001
// See TODO-037 in docs/TODOs.md for implementation details

export async function POST() {
  return NextResponse.json(
    { 
      error: 'Bidirectional sync not yet implemented',
      message: 'This feature is planned for future development. See TODO-037.'
    },
    { status: 501 } // Not Implemented
  );
}