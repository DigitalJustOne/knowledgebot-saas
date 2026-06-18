const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).reduce((acc, l) => {
  const [k, ...v] = l.split('=');
  acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  // Fix org 6ffc32c8 — the one with Google connected
  const orgId = '6ffc32c8-77c1-4a00-82a0-f81828085aca';

  const { data: config } = await supabase.from('agent_configs').select('business_info').eq('organization_id', orgId).single();
  let businessInfo = config?.business_info || {};

  // Clean spreadsheet_id and fix range
  businessInfo.spreadsheet_id = '1Og4mY0lv_zFu-RFCSvmVFbAOaZ6nPs4wSQRpPjz5IEo';
  businessInfo.spreadsheet_range = 'control_pacientes!A1:Z200';

  const { error } = await supabase.from('agent_configs').update({ business_info: businessInfo }).eq('organization_id', orgId);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ Corregido org', orgId);
    console.log('   spreadsheet_id:', businessInfo.spreadsheet_id);
    console.log('   spreadsheet_range:', businessInfo.spreadsheet_range);
  }
}
fix();
