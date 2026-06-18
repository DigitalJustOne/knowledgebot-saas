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
    // 1. Find conversations for zoom publicidad
    const { data: convs } = await supabase
      .from('conversations')
      .select('id, bot_active, contact_id, contacts(id, wa_phone, full_name)')
      .or('contact_id.eq.0f3d0f56-81db-44f9-903c-81ec40422a5b,contact_id.eq.953489bc-61e3-48c1-a5d6-270e0201c399');
    
    console.log('--- Zoom Publicidad Conversations ---');
    console.log(JSON.stringify(convs, null, 2));

    if (convs && convs.length > 0) {
      for (const conv of convs) {
        const { data: messages } = await supabase
          .from('messages')
          .select('id, created_at, sender, direction, content')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true });
        console.log(`\n--- Messages for Conv ${conv.id} (bot_active: ${conv.bot_active}) ---`);
        console.log(JSON.stringify(messages, null, 2));
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
