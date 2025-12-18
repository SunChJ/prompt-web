import type { Prompt } from "../schema.js";

export function normalizeText(s: string): string {
  return s.trim().toLowerCase();
}

export function matchesAllSelected(values: string[], selected?: string[]): boolean {
  if (!selected?.length) return true;
  if (!values.length) return false;
  const set = new Set(values.map((v) => normalizeText(v)));
  // within same facet: OR
  return selected.some((s) => set.has(normalizeText(s)));
}

export function scorePrompt(prompt: Prompt, q?: string): number {
  const query = q ? normalizeText(q) : "";
  if (!query) return 0;
  const title = normalizeText(prompt.title);
  const body = normalizeText(prompt.promptText);

  // Very simple scoring: title hits > body hits
  let score = 0;
  if (title.includes(query)) score += 10;
  if (body.includes(query)) score += 3;
  return score;
}


