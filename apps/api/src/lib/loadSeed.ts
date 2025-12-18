import seedData from "../../../../data/prompts.seed.json" with { type: "json" };
import { SeedSchema, type Prompt } from "../schema.js";

export async function loadSeed(): Promise<Prompt[]> {
  const seed = SeedSchema.parse(seedData);
  return seed.prompts;
}


