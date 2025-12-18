import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// apps/api/src/lib -> apps/api -> apps -> repoRoot
export const repoRoot = path.resolve(__dirname, "../../../..");

export const seedPath = path.join(repoRoot, "data", "prompts.seed.json");


