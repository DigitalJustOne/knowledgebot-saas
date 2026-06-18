const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).reduce((acc, l) => {
  const [k, ...v] = l.split('=');
  acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');

// Since we cannot run DDL via supabase-js easily, we can use the REST API 'rpc' 
// if we create a function, but we can't create a function.
// Alternative: Just use the 'agent_configs' jsonb 'business_info' to store the spreadsheet ID!
// 'agent_configs' has a 'business_info' column. We can just add 'spreadsheet_id' and 'sheet_name' to it!
