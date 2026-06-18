const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).reduce((acc, l) => {
  const [k, ...v] = l.split('=');
  acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('google_calendar_configs')
    .select('organization_id, token_expires_at, refresh_token_encrypted, access_token_encrypted');
  
  if (error) { console.error('DB error:', error); return; }
  
  if (!data || data.length === 0) {
    console.log('❌ NO HAY NINGUNA CONFIG DE GOOGLE. El usuario NUNCA ha conectado Google.');
    return;
  }
  
  for (const row of data) {
    const hasRefresh = !!row.refresh_token_encrypted;
    const hasAccess = !!row.access_token_encrypted;
    const expires = row.token_expires_at ? new Date(row.token_expires_at) : null;
    console.log(`Org: ${row.organization_id}`);
    console.log(`  refresh_token: ${hasRefresh ? '✅ presente' : '❌ FALTA'}`);
    console.log(`  access_token:  ${hasAccess ? '✅ presente' : '❌ FALTA'}`);
    console.log(`  expires_at:    ${expires ? expires.toISOString() : 'N/A'}`);
  }
}
check();
