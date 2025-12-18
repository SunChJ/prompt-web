import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prompt } from "../schema.js";
import { PromptsQuerySchema } from "../schema.js";
import { splitQueryParam } from "../lib/query.js";
import { matchesAllSelected, scorePrompt } from "../lib/search.js";

function facetCounts(items: Prompt[]) {
  const count = (get: (p: Prompt) => string[]) => {
    const m = new Map<string, number>();
    for (const p of items) {
      for (const v of get(p)) {
        m.set(v, (m.get(v) ?? 0) + 1);
      }
    }
    return Array.from(m.entries())
      .map(([value, n]) => ({ value, count: n }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  };

  return {
    genres: count((p) => p.genres ?? []),
    styles: count((p) => p.styles ?? []),
    moods: count((p) => p.moods ?? [])
  };
}

export async function promptsRoutes(app: FastifyInstance, opts: { prompts: Prompt[] }) {
  const { prompts } = opts;

  app.get("/api/prompts", async (req) => {
    const rawQuery = req.query as Record<string, unknown>;
    const normalized = {
      ...rawQuery,
      genres: splitQueryParam(rawQuery.genres),
      styles: splitQueryParam(rawQuery.styles),
      moods: splitQueryParam(rawQuery.moods)
    };

    const query = PromptsQuerySchema.parse(normalized);
    const q = query.q?.trim() ? query.q.trim() : undefined;
    const sort = query.sort ?? (q ? "relevance" : "newest");
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 24;

    let filtered = prompts;

    if (q) {
      const qn = q.toLowerCase();
      filtered = filtered.filter(
        (p) => p.title.toLowerCase().includes(qn) || p.promptText.toLowerCase().includes(qn)
      );
    }

    if (query.genres?.length) filtered = filtered.filter((p) => matchesAllSelected(p.genres, query.genres));
    if (query.styles?.length) filtered = filtered.filter((p) => matchesAllSelected(p.styles, query.styles));
    if (query.moods?.length) filtered = filtered.filter((p) => matchesAllSelected(p.moods, query.moods));

    const withScores =
      sort === "relevance"
        ? filtered.map((p) => ({ p, s: scorePrompt(p, q) }))
        : filtered.map((p) => ({ p, s: 0 }));

    withScores.sort((a, b) => {
      if (sort === "title") return a.p.title.localeCompare(b.p.title);
      if (sort === "newest") return (b.p.createdAt ?? "").localeCompare(a.p.createdAt ?? "");
      // relevance
      const ds = b.s - a.s;
      if (ds !== 0) return ds;
      return (b.p.createdAt ?? "").localeCompare(a.p.createdAt ?? "");
    });

    const total = withScores.length;
    const start = (page - 1) * pageSize;
    const items = withScores.slice(start, start + pageSize).map((x) => x.p);

    return {
      items,
      page,
      pageSize,
      total,
      facets: facetCounts(filtered)
    };
  });

  app.get("/api/prompts/:id", async (req, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse((req as { params: unknown }).params);
    const found = prompts.find((p) => p.id === params.id);
    if (!found) {
      reply.code(404);
      return { error: "NOT_FOUND" };
    }
    return found;
  });
}


