"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import type { PublicCategory, PublicListItem, PublicLocation } from "@/lib/serialize/public";
import { FilterIcon, RefreshIcon, SearchIcon, XIcon } from "./icons";
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

function ItemSkeleton() {
  return (
    <div className="item-card skeleton-card" aria-hidden="true">
      <div className="skeleton skeleton-thumb" />
      <div className="skeleton-body">
        <div className="skeleton skeleton-line short" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line tiny" />
        <div className="skeleton skeleton-line tiny" />
      </div>
    </div>
  );
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
  const [local, setLocal] = useState<Omit<BoardFilters, "q">>({ type: "", category: "", location: "" });
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const effective: BoardFilters = {
    ...filters,
    ...Object.fromEntries(Object.entries(local).filter(([, value]) => Boolean(value))),
    ...(debouncedQuery ? { q: debouncedQuery } : {}),
  };

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

  const hasFilters = Boolean(
    local.type || local.category || local.location || query || filters.type || filters.category || filters.location || filters.q,
  );

  function resetFilters() {
    setLocal({ type: "", category: "", location: "" });
    setQuery("");
    setDebouncedQuery("");
  }

  return (
    <div className="board-grid-wrap">
      {showFilters && (
        <div className="filters-card">
          <div className="filter-top">
            <div className="filter-seg" role="group" aria-label="Filter by type">
              {[
                { value: "", label: "All listings" },
                { value: "lost", label: "Lost" },
                { value: "found", label: "Found" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={local.type === option.value ? "active" : ""}
                  aria-pressed={local.type === option.value}
                  onClick={() => setLocal((current) => ({ ...current, type: option.value }))}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="search-field">
              <SearchIcon size={18} />
              <input
                type="search"
                placeholder="Search the board…"
                value={query}
                enterKeyHint="search"
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search listings"
              />
              {query && (
                <button type="button" className="search-clear" onClick={() => setQuery("")} aria-label="Clear search">
                  <XIcon size={15} />
                </button>
              )}
            </div>
          </div>
          <div className="filter-selects">
            <span className="filter-label">
              <FilterIcon size={15} /> Refine
            </span>
            <select
              value={local.category ?? ""}
              onChange={(event) => setLocal((current) => ({ ...current, category: event.target.value }))}
              aria-label="Filter by category"
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
              onChange={(event) => setLocal((current) => ({ ...current, location: event.target.value }))}
              aria-label="Filter by location"
            >
              <option value="">All locations</option>
              {taxonomy?.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.path.join(" › ")}
                </option>
              ))}
            </select>
            {hasFilters && (
              <button type="button" className="btn ghost small clear-filters" onClick={resetFilters}>
                <XIcon size={14} /> Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      <div className="board-status" aria-live="polite">
        <span className="live-dot" aria-hidden="true" />
        {loading && items.length === 0
          ? "Loading listings…"
          : `${items.length} listing${items.length === 1 ? "" : "s"}${hasMore ? " · more below" : ""}`}
      </div>

      {error && (
        <div className="notice error">
          <span>{error}</span>
          <button type="button" className="btn secondary small" onClick={() => void load(true)}>
            <RefreshIcon size={15} /> Try again
          </button>
        </div>
      )}

      <div className="grid three" aria-busy={loading}>
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
        {loading && items.length === 0 && Array.from({ length: limit >= 6 ? 6 : 3 }).map((_, index) => <ItemSkeleton key={index} />)}
      </div>

      {items.length === 0 && !loading && !error && (
        <div className="empty">
          <span className="empty-icon">
            <SearchIcon size={26} />
          </span>
          <h3>{hasFilters ? "No listings match those filters" : "The board is quiet right now"}</h3>
          <p>
            {hasFilters
              ? "Try a broader search, another category, or clear the filters."
              : "Be the first to report something — it only takes a minute."}
          </p>
          <div className="empty-actions">
            {hasFilters ? (
              <button type="button" className="btn secondary" onClick={resetFilters}>
                <XIcon size={16} /> Clear filters
              </button>
            ) : null}
            <a href="/report" className="btn">
              New report
            </a>
          </div>
        </div>
      )}

      <div ref={sentinel} className="sentinel" />
      {hasMore && !loading && items.length > 0 && (
        <div className="center mt">
          <button type="button" className="btn secondary" onClick={() => void load(false)}>
            Load more listings
          </button>
        </div>
      )}
    </div>
  );
}
