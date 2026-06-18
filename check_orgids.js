const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).reduce((acc, l) => {
  const [k, ...v] = l.split('=');
  acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Org IDs in agent_configs
  const { data: agentConfigs } = await supabase.from('agent_configs').select('organization_id, business_info');
  console.log('=== agent_configs ===');
  for (const c of agentConfigs || []) {
    const bi = c.business_info || {};
    console.log(`Org: ${c.organization_id} | spreadsheet_id: ${bi.spreadsheet_id || 'NO TIENE'} | range: ${bi.spreadsheet_range || 'NO TIENE'}`);
  }

  // Org IDs in google_calendar_configs
  const { data: googleConfigs } = await supabase.from('google_calendar_configs').select('organization_id');
  console.log('\n=== google_calendar_configs ===');
  for (const g of googleConfigs || []) {
    console.log(`Org: ${g.organization_id}`);
  }

  // Cross-check
  const agentOrgIds = (agentConfigs || []).map(c => c.organization_id);
  const googleOrgIds = (googleConfigs || []).map(g => g.organization_id);
  const match = agentOrgIds.some(id => googleOrgIds.includes(id));
  console.log(`\n=== RESULTADO ===`);
  console.log(match ? '✅ Los org_ids COINCIDEN' : '❌ Los org_ids NO COINCIDEN — ese es el problema');
}
check();
