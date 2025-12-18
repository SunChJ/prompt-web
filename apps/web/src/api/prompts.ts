import { httpGetJson } from "./http";
import type { Prompt, PromptsListResponse } from "./types";

export type PromptsListParams = {
  q?: string;
  genres?: string[];
  styles?: string[];
  moods?: string[];
  sort?: "relevance" | "newest" | "title";
  page?: number;
  pageSize?: number;
};

function setListParam(sp: URLSearchParams, key: string, values?: string[]) {
  sp.delete(key);
  if (!values?.length) return;
  sp.set(key, values.join(","));
}

export function buildPromptsUrl(params: PromptsListParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.sort) sp.set("sort", params.sort);
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  setListParam(sp, "genres", params.genres);
  setListParam(sp, "styles", params.styles);
  setListParam(sp, "moods", params.moods);
  const qs = sp.toString();
  return `/api/prompts${qs ? `?${qs}` : ""}`;
}

export async function fetchPrompts(params: PromptsListParams): Promise<PromptsListResponse> {
  return await httpGetJson<PromptsListResponse>(buildPromptsUrl(params));
}

export async function fetchPromptById(id: string): Promise<Prompt> {
  return await httpGetJson<Prompt>(`/api/prompts/${encodeURIComponent(id)}`);
}


