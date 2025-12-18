import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { fetchPromptById, fetchPrompts } from "../api/prompts";
import type { FacetItem, Prompt } from "../api/types";
import { parseCsvParam, setCsvParam, toggleInList } from "../lib/urlState";
import { TopNav } from "../components/TopNav";
import { Chip } from "../components/Chip";
import { BookmarkIcon, ChevronDownIcon, CopyIcon, ImageIcon, SearchIcon } from "../components/Icons";

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-lg font-semibold text-banana-fg">{children}</div>;
}

function Collapsible({
  title,
  open,
  onToggle,
  children
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-banana-border py-5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="text-base font-semibold text-banana-fg">{title}</div>
        <ChevronDownIcon className={["text-banana-muted transition", open ? "rotate-180" : ""].join(" ")} />
      </button>
      {open ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

function ChipFacet({
  title,
  items,
  selected,
  onToggle
}: {
  title: string;
  items: FacetItem[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="text-sm font-semibold text-banana-fg">{title}</div>
      <div className="flex flex-wrap gap-3">
        {items.length === 0 ? (
          <div className="text-sm text-banana-muted">No options</div>
        ) : (
          items.map((it) => (
            <Chip key={it.value} active={selected.includes(it.value)} onClick={() => onToggle(it.value)}>
              <span className="inline-flex items-center gap-2">
                <span>{it.value}</span>
                <span className="text-xs text-banana-muted">{it.count}</span>
              </span>
            </Chip>
          ))
        )}
      </div>
    </section>
  );
}

function PromptCard({ prompt, onOpen }: { prompt: Prompt; onOpen: () => void }) {
  const excerpt = prompt.promptText.length > 140 ? `${prompt.promptText.slice(0, 140)}…` : prompt.promptText;
  const [copied, setCopied] = React.useState(false);

  const onCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await copyToClipboard(prompt.promptText);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 900);
  };

  const onImageToImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Placeholder: wire to your model flow later
  };

  return (
    <div className="banana-surface overflow-hidden">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative h-56">
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/70" />
          <div className="absolute -inset-10 bg-[radial-gradient(circle_at_30%_30%,rgba(255,219,117,0.08),transparent_55%)]" />
          <div className="absolute -inset-10 bg-[radial-gradient(circle_at_70%_50%,rgba(255,219,117,0.06),transparent_55%)]" />
        </div>
        <div className="px-6">
          <div className="mt-6 text-2xl font-semibold tracking-tight text-banana-fg">{prompt.title}</div>
          <div className="mt-3 max-w-[46ch] text-base leading-relaxed text-banana-muted">{excerpt}</div>
        </div>
      </button>

      <div className="px-6 pb-6 pt-5">
        <div className="flex flex-wrap gap-3">
          <button type="button" className="banana-btn" onClick={onCopy}>
            <CopyIcon className="text-banana-fg/80" />
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" className="banana-btn" onClick={onImageToImage}>
            <ImageIcon className="text-banana-fg/80" />
            Image-to-Image
          </button>
        </div>
      </div>
    </div>
  );
}

function Modal({
  open,
  onClose,
  title,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 flex items-start justify-center overflow-auto p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="banana-surface w-full max-w-3xl"
        >
          <div className="flex items-center justify-between gap-4 border-b border-banana-border px-6 py-5">
            <div className="text-xl font-semibold tracking-tight text-banana-fg">{title}</div>
            <button
              type="button"
              onClick={onClose}
              className="banana-btn"
            >
              Close
            </button>
          </div>
          <div className="px-6 py-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function ExplorePage() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get("q") ?? "";
  const genres = parseCsvParam(sp.get("genres"));
  const styles = parseCsvParam(sp.get("styles"));
  const moods = parseCsvParam(sp.get("moods"));
  const sort = (sp.get("sort") as "relevance" | "newest" | "title" | null) ?? null;
  const page = Number(sp.get("page") ?? "1") || 1;
  const pageSize = Number(sp.get("pageSize") ?? "24") || 24;

  const [openId, setOpenId] = React.useState<string | null>(null);
  const [qInput, setQInput] = React.useState(q);
  const qDebounceRef = React.useRef<number | undefined>(undefined);
  const [openGenre, setOpenGenre] = React.useState(true);
  const [openStyles, setOpenStyles] = React.useState(false);
  const [openMood, setOpenMood] = React.useState(false);
  const [bookmarks, setBookmarks] = React.useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem("banana.bookmarks");
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  React.useEffect(() => {
    setQInput(q);
  }, [q]);

  React.useEffect(() => {
    try {
      localStorage.setItem("banana.bookmarks", JSON.stringify(bookmarks));
    } catch {
      // ignore
    }
  }, [bookmarks]);

  const listQuery = useQuery({
    queryKey: ["prompts", { q, genres, styles, moods, sort, page, pageSize }],
    queryFn: () =>
      fetchPrompts({
        q: q.trim() ? q.trim() : undefined,
        genres: genres.length ? genres : undefined,
        styles: styles.length ? styles : undefined,
        moods: moods.length ? moods : undefined,
        sort: sort ?? undefined,
        page,
        pageSize
      }),
    staleTime: 10_000
  });

  const detailQuery = useQuery({
    queryKey: ["prompt", openId],
    queryFn: () => fetchPromptById(openId!),
    enabled: !!openId
  });

  const total = listQuery.data?.total ?? 0;
  const showingAll = !q.trim() && genres.length === 0 && styles.length === 0 && moods.length === 0;

  const setFilters = (next: {
    q?: string;
    genres?: string[];
    styles?: string[];
    moods?: string[];
    sort?: string | null;
    page?: number;
    pageSize?: number;
  }) => {
    const nextSp = new URLSearchParams(sp);
    if (typeof next.q === "string") {
      if (!next.q.trim()) nextSp.delete("q");
      else nextSp.set("q", next.q);
      nextSp.set("page", "1");
    }
    if (next.genres) {
      setCsvParam(nextSp, "genres", next.genres);
      nextSp.set("page", "1");
    }
    if (next.styles) {
      setCsvParam(nextSp, "styles", next.styles);
      nextSp.set("page", "1");
    }
    if (next.moods) {
      setCsvParam(nextSp, "moods", next.moods);
      nextSp.set("page", "1");
    }
    if (typeof next.sort !== "undefined") {
      if (!next.sort) nextSp.delete("sort");
      else nextSp.set("sort", next.sort);
      nextSp.set("page", "1");
    }
    if (typeof next.page === "number") nextSp.set("page", String(next.page));
    if (typeof next.pageSize === "number") nextSp.set("pageSize", String(next.pageSize));
    setSp(nextSp, { replace: true });
  };

  const canPrev = page > 1;
  const canNext = listQuery.data ? page * pageSize < listQuery.data.total : false;

  return (
    <div className="min-h-screen">
      <TopNav />

      <div className="mx-auto max-w-6xl px-4 pb-12 pt-10">
        <h1 className="text-6xl font-semibold tracking-tight text-banana-fg">Explore Prompts</h1>
        <div className="mt-5 text-2xl text-banana-muted">
          Browse and filter our collection of {total} curated prompts
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[360px_1fr]">
          <aside>
            <div className="relative">
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-banana-muted">
                <SearchIcon />
              </div>
              <input
                value={qInput}
                onChange={(e) => {
                  const next = e.target.value;
                  setQInput(next);
                  if (qDebounceRef.current) window.clearTimeout(qDebounceRef.current);
                  qDebounceRef.current = window.setTimeout(() => setFilters({ q: next }), 250);
                }}
                placeholder="Search by title or content..."
                className="banana-input pl-12"
              />
            </div>

            <div className="mt-8">
              <div className="text-2xl font-semibold text-banana-fg">Filters</div>

              <Collapsible title="Genre & Subject" open={openGenre} onToggle={() => setOpenGenre((v) => !v)}>
                <ChipFacet
                  title=""
                  items={listQuery.data?.facets.genres ?? []}
                  selected={genres}
                  onToggle={(v) => setFilters({ genres: toggleInList(genres, v) })}
                />
              </Collapsible>

              <Collapsible title="Artistic Styles" open={openStyles} onToggle={() => setOpenStyles((v) => !v)}>
                <ChipFacet
                  title=""
                  items={listQuery.data?.facets.styles ?? []}
                  selected={styles}
                  onToggle={(v) => setFilters({ styles: toggleInList(styles, v) })}
                />
              </Collapsible>

              <Collapsible title="Mood & Tone" open={openMood} onToggle={() => setOpenMood((v) => !v)}>
                <ChipFacet
                  title=""
                  items={listQuery.data?.facets.moods ?? []}
                  selected={moods}
                  onToggle={(v) => setFilters({ moods: toggleInList(moods, v) })}
                />
              </Collapsible>

              <div className="pt-6">
                <button
                  type="button"
                  onClick={() => setSp(new URLSearchParams(), { replace: true })}
                  className="banana-btn w-full justify-center"
                >
                  Clear all
                </button>
              </div>
            </div>
          </aside>

          <section>
            <div className="mb-6 mt-3 text-xl text-banana-muted">
              {showingAll ? `Showing all ${total} prompts` : `Showing ${total} prompts`}
            </div>

            {listQuery.isLoading ? (
              <div className="banana-surface p-6 text-banana-muted">Loading…</div>
            ) : listQuery.isError ? (
              <div className="banana-surface border-red-500/30 p-6 text-red-200">
                {(listQuery.error as Error).message}
              </div>
            ) : listQuery.data && listQuery.data.items.length === 0 ? (
              <div className="banana-surface p-6 text-banana-muted">No prompts match your filters.</div>
            ) : (
              <div className="grid gap-8 xl:grid-cols-2">
                {listQuery.data?.items.map((p) => (
                  <div key={p.id} className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setBookmarks((prev) => ({
                          ...prev,
                          [p.id]: !prev[p.id]
                        }))
                      }
                      className="absolute right-6 top-6 z-10 rounded-xl border border-banana-borderStrong bg-black/35 p-2 text-banana-fg/80 hover:text-banana-fg"
                      aria-label="Bookmark"
                    >
                      <BookmarkIcon filled={!!bookmarks[p.id]} />
                    </button>
                    <PromptCard prompt={p} onOpen={() => setOpenId(p.id)} />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-10 flex items-center justify-between border-t border-banana-border pt-6">
              <div className="text-sm text-banana-muted">
                Page {page} · {pageSize} per page
              </div>
              <div className="flex gap-3">
                <button type="button" disabled={!canPrev} onClick={() => setFilters({ page: Math.max(1, page - 1) })} className="banana-btn">
                  Prev
                </button>
                <button type="button" disabled={!canNext} onClick={() => setFilters({ page: page + 1 })} className="banana-btn">
                  Next
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Modal open={!!openId} onClose={() => setOpenId(null)} title={detailQuery.data?.title ?? "Prompt"}>
        {detailQuery.isLoading ? (
          <div className="text-banana-muted">Loading…</div>
        ) : detailQuery.isError ? (
          <div className="text-red-200">{(detailQuery.error as Error).message}</div>
        ) : detailQuery.data ? (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              {[...detailQuery.data.genres, ...detailQuery.data.styles, ...detailQuery.data.moods].map((t) => (
                <span key={t} className="banana-chip text-sm" data-active="false">
                  {t}
                </span>
              ))}
            </div>

            <div className="banana-surface p-5">
              <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-banana-fg/90">
                {detailQuery.data.promptText}
              </pre>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="banana-btn"
                onClick={async () => {
                  await copyToClipboard(detailQuery.data.promptText);
                }}
              >
                <CopyIcon className="text-banana-fg/80" />
                Copy
              </button>
              <button type="button" className="banana-btn" onClick={() => {}}>
                <ImageIcon className="text-banana-fg/80" />
                Image-to-Image
              </button>
              <button
                type="button"
                className="banana-btn"
                onClick={() =>
                  setBookmarks((prev) => ({
                    ...prev,
                    [detailQuery.data.id]: !prev[detailQuery.data.id]
                  }))
                }
              >
                <BookmarkIcon className="text-banana-fg/80" filled={!!bookmarks[detailQuery.data.id]} />
                Bookmark
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}


