import { z } from "zod";

export const PromptSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  promptText: z.string().min(1),
  genres: z.array(z.string().min(1)).default([]),
  styles: z.array(z.string().min(1)).default([]),
  moods: z.array(z.string().min(1)).default([]),
  createdAt: z.string().datetime().optional(),
  source: z
    .object({
      name: z.string().min(1).optional(),
      url: z.string().url().optional()
    })
    .optional()
});

export type Prompt = z.infer<typeof PromptSchema>;

export const SeedSchema = z.object({
  prompts: z.array(PromptSchema)
});

export type Seed = z.infer<typeof SeedSchema>;

export const PromptsQuerySchema = z.object({
  q: z.string().optional(),
  genres: z.array(z.string()).optional(),
  styles: z.array(z.string()).optional(),
  moods: z.array(z.string()).optional(),
  sort: z.enum(["relevance", "newest", "title"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional()
});

export type PromptsQuery = z.infer<typeof PromptsQuerySchema>;


