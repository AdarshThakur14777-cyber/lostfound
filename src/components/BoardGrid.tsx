"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import type { PublicCategory, PublicListItem, PublicLocation } from "@/lib/serialize/public";
import { ItemCard } from "./ItemCard";

interface BoardResponse {
  items: PublicListItem[];
  nextCursor: string | null;
}

interface TaxonomyResponse {
  categories: PublicCategory[];
  locations: PublicLocation[];
}

export interface BoardFilters {
  type?: string;
  category?: string;
  location?: string;
  q?: string;
}

export function BoardGrid({
  filters = {},
  showFilters = false,
  limit = 12,
}: {
  filters?: BoardFilters;
  showFilters?: boolean;
  limit?: number;
}) {
  const [items, setItems] = useState<PublicListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taxonomy, setTaxonomy] = useState<TaxonomyResponse | null>(null);
  const [local, setLocal] = useState<BoardFilters>({ type: "", category: "", location: "", q: "" });
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const effective: BoardFilters = { ...filters, ...Object.fromEntries(
    Object.entries(local).filter(([, value]) => Boolean(value)),
  ) };

  const load = useCallback(
    async (reset: boolean) => {
      if (busy.current) return;
      busy.current = true;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: String(limit) });
        if (effective.type) params.set("type", effective.type);
        if (effective.category) params.set("category", effective.category);
        if (effective.location) params.set("location", effective.location);
        if (effective.q) params.set("q", effective.q);
        if (!reset && cursor) params.set("before", cursor);

        const data = await api<BoardResponse>(`/api/board?${params.toString()}`);
        setItems((current) => (reset ? data.items : [...current, ...data.items]));
        setCursor(data.nextCursor);
        setHasMore(Boolean(data.nextCursor));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load the board");
      } finally {
        setLoading(false);
        busy.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(effective), cursor, limit],
  );

  // Reset whenever the filters change.
  useEffect(() => {
    setCursor(null);
    setHasMore(true);
    setItems([]);
    void (async () => {
      busy.current = false;
      await load(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(effective)]);

  useEffect(() => {
    if (!showFilters) return;
    api<TaxonomyResponse>("/api/taxonomy")
      .then(setTaxonomy)
      .catch(() => undefined);
  }, [showFilters]);

  // Infinite scroll.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void load(false);
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, load]);

  return (
    <div>
      {showFilters && (
        <div className="filters">
          <select
            value={local.type ?? ""}
            onChange={(event) => setLocal((f) => ({ ...f, type: event.target.value }))}
            aria-label="Type"
          >
            <option value="">Lost &amp; found</option>
            <option value="lost">Lost only</option>
            <option value="found">Found only</option>
          </select>
          <select
            value={local.category ?? ""}
            onChange={(event) => setLocal((f) => ({ ...f, category: event.target.value }))}
            aria-label="Category"
          >
            <option value="">All categories</option>
            {taxonomy?.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={local.location ?? ""}
            onChange={(event) => setLocal((f) => ({ ...f, location: event.target.value }))}
            aria-label="Location"
          >
            <option value="">All locations</option>
            {taxonomy?.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.path.join(" › ")}
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder="Search…"
            value={local.q ?? ""}
            onChange={(event) => setLocal((f) => ({ ...f, q: event.target.value }))}
            aria-label="Search"
          />
        </div>
      )}

      {error && <div className="notice error">{error}</div>}

      {items.length === 0 && !loading ? (
        <div className="empty">No items match these filters yet.</div>
      ) : (
        <div className="grid three">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
          {loading &&
            Array.from({ length: 3 }).map((_, index) => <div key={index} className="skeleton" />)}
        </div>
      )}

      <div ref={sentinel} className="sentinel" />
      {hasMore && !loading && (
        <div className="center mt">
          <button type="button" className="btn secondary" onClick={() => void load(false)}>
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
