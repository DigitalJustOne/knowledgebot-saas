const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let val = match[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.substring(1, val.length - 1);
    }
    envVars[key] = val.trim();
  }
});

const supabase = createClient(
  envVars['NEXT_PUBLIC_SUPABASE_URL'],
  envVars['SUPABASE_SERVICE_ROLE_KEY']
);

async function test() {
  try {
    const { data: messages } = await supabase
      .from('messages')
      .select('id, created_at, sender, direction, content, conversation_id')
      .order('created_at', { ascending: false })
      .limit(20);
    console.log('--- Last 20 messages in database ---');
    console.log(JSON.stringify(messages, null, 2));

    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, wa_phone, full_name, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    console.log('--- Last 10 contacts in database ---');
    console.log(JSON.stringify(contacts, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
