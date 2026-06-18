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
  const orgId = orgs[0].id;

  const { data: config } = await supabase.from('agent_configs').select('business_info').eq('organization_id', orgId).single();
  let businessInfo = config?.business_info || {};

  console.log('Config actual:', JSON.stringify(businessInfo, null, 2));

  // Corregir el nombre de la pestaña: "control_pacientes" en lugar de "Sheet1"
  businessInfo.spreadsheet_id = '1Og4mY0lv_zFu-RFCSvmVFbAOaZ6nPs4wSQRpPjz5IEo';
  businessInfo.spreadsheet_range = 'control_pacientes!A1:Z200';

  const { error } = await supabase.from('agent_configs').update({ business_info: businessInfo }).eq('organization_id', orgId);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ Rango actualizado a: control_pacientes!A1:Z200');
    console.log('Spreadsheet ID:', businessInfo.spreadsheet_id);
  }
}
run();
