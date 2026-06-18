const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).reduce((acc, l) => {
  const [k, ...v] = l.split('=');
  acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabase.from('contacts').select('full_name').eq('wa_phone', '94416349991111').single();
  console.log('Nombre actual en la base de datos para este contacto:', data?.full_name);
}
check();
