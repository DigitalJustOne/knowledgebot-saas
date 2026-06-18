const { generateText } = require('ai');
const { createOpenAICompatible } = require('@ai-sdk/openai-compatible');
const fs = require('fs');
const path = require('path');

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
    process.env[key] = val.trim();
  }
});

const openrouter = createOpenAICompatible({
  name: 'openrouter',
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

const model = openrouter.chatModel('deepseek/deepseek-chat');

async function test() {
  try {
    const result = await generateText({
      model,
      prompt: 'Hello world',
    });
    console.log(result.text);
  } catch (err) {
    console.error('Error generating text:', err);
  }
}

test();
