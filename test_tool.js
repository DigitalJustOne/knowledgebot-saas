const { tool } = require('ai');
const z = require('zod');

const myTool = tool({
  description: 'Busca horarios.',
  parameters: z.object({
    date: z.string().describe('Fecha'),
    serviceName: z.string().describe('Nombre del servicio')
  }),
  execute: async (args) => {
    return {};
  }
});

console.log('--- TOOL OBJECT ---');
console.log(myTool);
console.log('--- PARAMETERS ---');
console.log(myTool.parameters);
console.log('--- SERIALIZED SCHEMA ---');
// Vercel AI SDK stores the schema conversion or processes it during call.
// Let's see if we can see how the schema looks.
