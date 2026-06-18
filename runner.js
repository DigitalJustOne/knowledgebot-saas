const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).reduce((acc, l) => {
  const [k, ...v] = l.split('=');
  acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

// Set env vars
Object.assign(process.env, env);

// We need to use dynamic import or tsx since we're calling a TS file from JS?
// Wait, `query-google-sheet` and `admin.ts` are TS files. We can't easily require them from raw node unless we use tsx.
