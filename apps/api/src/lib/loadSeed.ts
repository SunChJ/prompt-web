import fs from "node:fs/promises";
import { SeedSchema, type Prompt } from "../schema.js";
import { seedPath } from "./paths.js";

export async function loadSeed(): Promise<Prompt[]> {
  const raw = await fs.readFile(seedPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const seed = SeedSchema.parse(parsed);
  return seed.prompts;
}


