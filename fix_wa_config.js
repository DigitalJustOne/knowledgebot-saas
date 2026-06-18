const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fix() {
  const { data: orgs } = await supabase.from('organizations').select('id');
  if (orgs && orgs.length > 0) {
    const orgId = orgs[0].id;
    console.log('Org ID:', orgId);
    
    const { error } = await supabase
      .from('whatsapp_configs')
      .upsert({
        organization_id: orgId,
        provider: 'openwa',
        openwa_api_url: 'http://localhost:2785',
        openwa_session_id: 'default'
      });
      
    if (error) console.error(error);
    else console.log('Config updated successfully to http://localhost:2785');
  }
}
fix();
