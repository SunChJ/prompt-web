import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');
const seedPath = path.join(root, 'data', 'prompts.seed.json');

async function main() {
  const importFilePath = process.argv[2];
  if (!importFilePath) {
    console.error('Usage: node scripts/bulk_import.mjs <path_to_json>');
    process.exit(1);
  }

  const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const importData = JSON.parse(fs.readFileSync(importFilePath, 'utf8'));

  if (!importData.prompts || !Array.isArray(importData.prompts)) {
    console.error('Invalid import data format. Expected { prompts: [...] }');
    process.exit(1);
  }

  const existingIds = new Set(seedData.prompts.map(p => p.id));
  let count = 0;

  for (const prompt of importData.prompts) {
    if (!existingIds.has(prompt.id)) {
      seedData.prompts.push(prompt);
      existingIds.add(prompt.id);
      count++;
    }
  }

  fs.writeFileSync(seedPath, JSON.stringify(seedData, null, 2), 'utf8');
  console.log(`Successfully imported ${count} new prompts to ${seedPath}`);
}

main();
