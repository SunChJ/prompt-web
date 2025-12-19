import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');
const seedPath = path.join(root, 'data', 'prompts.seed.json');

async function main() {
  const data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

  console.log('--- Quick Prompt Importer ---');
  
  // In a real CLI we might use 'inquirer', but for simplicity here 
  // we'll assume the user might want to pipe text or we focus on the structure.
  
  const newPrompt = {
    id: `p_${Date.now()}`,
    title: process.argv[2] || 'New Prompt',
    promptText: process.argv[3] || '',
    genres: (process.argv[4] || '').split(',').filter(Boolean),
    styles: (process.argv[5] || '').split(',').filter(Boolean),
    moods: (process.argv[6] || '').split(',').filter(Boolean),
    imageUrl: process.argv[7] || '',
    createdAt: new Date().toISOString(),
    source: { name: 'Gemini' }
  };

  if (!newPrompt.promptText) {
    console.error('Error: Prompt text is required.');
    console.log('Usage: node scripts/import.mjs "Title" "Prompt Text" "Genre1,Genre2" "Style1" "Mood1" "ImageUrl"');
    process.exit(1);
  }

  data.prompts.push(newPrompt);
  fs.writeFileSync(seedPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Successfully added: ${newPrompt.title} (ID: ${newPrompt.id})`);
}

main();
