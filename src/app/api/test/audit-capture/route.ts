import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/db/supabase-admin";
// @ts-ignore
import TokenManager from "../../../../../server/lib/token-manager.js";

/**
 * Comprehensive audit endpoint to prove header capture works correctly
 * This will:
 * 1. Show what's currently in DB
 * 2. Make an API call to Inoreader
 * 3. Show what headers Inoreader returned
 * 4. Capture those headers
 * 5. Show what's in DB after capture
 * 6. Verify the values match
 */
export async function GET() {
  const supabase = getAdminClient();
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Step 1: Get current DB state BEFORE
    const { data: beforeData } = await supabase
      .from('api_usage')
      .select('*')
      .eq('service', 'inoreader')
      .eq('date', today)
      .single();
    
    // Step 2: Make a real API call to Inoreader
    const tokenManager = new TokenManager();
    const response = await tokenManager.makeAuthenticatedRequest(
      "https://www.inoreader.com/reader/api/0/user-info"
    );
    
    // Step 3: Extract what Inoreader ACTUALLY sent
    const inoreaderHeaders = {
      'X-Reader-Zone1-Usage': response.headers.get('X-Reader-Zone1-Usage'),
      'X-Reader-Zone1-Limit': response.headers.get('X-Reader-Zone1-Limit'),
      'X-Reader-Zone2-Usage': response.headers.get('X-Reader-Zone2-Usage'),
      'X-Reader-Zone2-Limit': response.headers.get('X-Reader-Zone2-Limit'),
      'X-Reader-Limits-Reset-After': response.headers.get('X-Reader-Limits-Reset-After'),
    };
    
    // Step 4: Call our capture function
    const { captureRateLimitHeaders } = await import("@/lib/api/capture-rate-limit-headers");
    await captureRateLimitHeaders(response.headers);
    
    // Step 5: Get DB state AFTER capture
    const { data: afterData } = await supabase
      .from('api_usage')
      .select('*')
      .eq('service', 'inoreader')
      .eq('date', today)
      .single();
    
    // Step 6: Analyze and verify
    const analysis = {
      timestamp: new Date().toISOString(),
      
      before_capture: {
        zone1_usage: beforeData?.zone1_usage || null,
        zone2_usage: beforeData?.zone2_usage || null,
        updated_at: beforeData?.updated_at || null,
      },
      
      inoreader_reported: {
        zone1_usage: inoreaderHeaders['X-Reader-Zone1-Usage'],
        zone2_usage: inoreaderHeaders['X-Reader-Zone2-Usage'],
        zone1_limit: inoreaderHeaders['X-Reader-Zone1-Limit'],
        zone2_limit: inoreaderHeaders['X-Reader-Zone2-Limit'],
      },
      
      after_capture: {
        zone1_usage: afterData?.zone1_usage || null,
        zone2_usage: afterData?.zone2_usage || null,
        updated_at: afterData?.updated_at || null,
      },
      
      verification: {
        zone1_matches: parseInt(inoreaderHeaders['X-Reader-Zone1-Usage'] || '0') === afterData?.zone1_usage,
        zone2_matches: parseInt(inoreaderHeaders['X-Reader-Zone2-Usage'] || '0') === afterData?.zone2_usage,
        db_was_updated: beforeData?.updated_at !== afterData?.updated_at,
        
        expected_zone1: parseInt(inoreaderHeaders['X-Reader-Zone1-Usage'] || '0'),
        actual_zone1: afterData?.zone1_usage,
        
        expected_zone2: parseInt(inoreaderHeaders['X-Reader-Zone2-Usage'] || '0'),
        actual_zone2: afterData?.zone2_usage,
      },
      
      conclusion: null as string | null,
    };
    
    // Determine conclusion
    if (analysis.verification.zone1_matches && analysis.verification.zone2_matches) {
      analysis.conclusion = "✅ WORKING CORRECTLY: Database accurately stores what Inoreader reports";
    } else {
      analysis.conclusion = "❌ PROBLEM DETECTED: Database does not match Inoreader headers";
    }
    
    return NextResponse.json(analysis, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
    
  } catch (error) {
    console.error("[Audit] Error:", error);
    return NextResponse.json(
      {
        error: "audit_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}