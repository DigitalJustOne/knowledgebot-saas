export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('appointments').select('*').order('created_at', { ascending: false }).limit(5);
  return NextResponse.json({ data, error });
}
