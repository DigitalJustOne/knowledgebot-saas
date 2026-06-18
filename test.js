const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).reduce((acc, l) => {
  const [k, ...v] = l.split('=');
  acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
// Delete ALL messages from this specific conversation ID to clean the state completely
supabase.from('messages').delete().eq('conversation_id', '00bb5e3a-41ad-4229-938c-c3509ca6bc84').then(r => console.log('Deleted all messages for this conversation', r));
