import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const updates = await request.json();
    
    // Process each update
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'object' && value !== null && 'increment' in value) {
        // Handle increment operations
        const { data: existing } = await supabase
          .from('sync_metadata')
          .select('value')
          .eq('key', key)
          .single();
        
        const currentValue = parseInt(existing?.value || '0');
        const newValue = currentValue + (value as any).increment;
        
        await supabase
          .from('sync_metadata')
          .upsert({
            key,
            value: newValue.toString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      } else {
        // Direct value update
        await supabase
          .from('sync_metadata')
          .upsert({
            key,
            value: String(value),
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update sync metadata:', error);
    return NextResponse.json(
      { error: 'Failed to update sync metadata' },
      { status: 500 }
    );
  }
}