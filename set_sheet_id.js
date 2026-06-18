const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).reduce((acc, l) => {
  const [k, ...v] = l.split('=');
  acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
  if (!orgs || orgs.length === 0) {
     console.log('No orgs found');
     return;
  }
  const orgId = orgs[0].id;
  
  const { data: config } = await supabase.from('agent_configs').select('business_info').eq('organization_id', orgId).single();
  let businessInfo = config?.business_info || {};
  businessInfo.spreadsheet_id = '1Og4mY0lv_zFu-RFCSvmVFbAOaZ6nPs4wSQRpPjz5IEo';
  businessInfo.spreadsheet_range = 'Sheet1!A1:Z100'; // Usaremos Sheet1 o un rango amplio

  const { error } = await supabase.from('agent_configs').update({ business_info: businessInfo }).eq('organization_id', orgId);
  if (error) {
     console.error('Error updating:', error);
  } else {
     console.log('Successfully updated agent_configs with spreadsheet_id:', businessInfo.spreadsheet_id);
  }
}
run();
