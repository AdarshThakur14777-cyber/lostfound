"use client";

import Link from "next/link";
import { timeAgo } from "@/lib/client/api";
import type { PublicListItem } from "@/lib/serialize/public";

const STATUS_LABEL: Record<string, string> = {
  open: "open",
  claim_pending: "claim in review",
  in_custody: "in custody",
  returned: "returned",
  disposal_pending: "awaiting disposal",
  disposed: "disposed",
  expired: "expired",
};

export function ItemCard({ item }: { item: PublicListItem }) {
  return (
    <Link href={`/items/${item.id}`} className="item-card" style={{ color: "inherit" }}>
      <div className="thumb">
        {item.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.images[0]} alt="" loading="lazy" />
        ) : (
          <span>{item.type === "found" ? "📦" : "🔎"}</span>
        )}
      </div>
      <div className="body">
        <span className={`badge ${item.type}`}>{item.type}</span>
        <span className="title">{item.title}</span>
        <span className="path">
          {item.location.path.length > 1 ? `${item.location.path.slice(-2).join(" · ")}` : item.location.name}
        </span>
        <span className="meta">
          {item.category.name} · {timeAgo(item.postedAt)}
        </span>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: "auto" }}>
          {item.status !== "open" && <span className="badge">{STATUS_LABEL[item.status]}</span>}
          {item.claimable && <span className="badge claim">claims open</span>}
        </span>
      </div>
    </Link>
  );
}
