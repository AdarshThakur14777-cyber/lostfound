"use client";

import Link from "next/link";
import { timeAgo } from "@/lib/client/api";
import type { PublicListItem } from "@/lib/serialize/public";
import { categoryArtwork } from "@/lib/category-art";
import { ArrowRightIcon, BoxIcon, CheckCircleIcon, ClockIcon, MapPinIcon, SearchIcon } from "./icons";

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  claim_pending: "Claim in review",
  in_custody: "In custody",
  returned: "Returned",
  disposal_pending: "Awaiting disposal",
  disposed: "Disposed",
  expired: "Expired",
};

const STATUS_TONE: Record<string, string> = {
  open: "status-open",
  claim_pending: "status-claim",
  in_custody: "status-custody",
  returned: "status-returned",
  disposal_pending: "status-expired",
  disposed: "status-expired",
  expired: "status-expired",
};

export function ItemCard({ item }: { item: PublicListItem }) {
  const statusLabel = STATUS_LABEL[item.status] ?? item.status.replace(/_/g, " ");
  const statusTone = STATUS_TONE[item.status] ?? "status-open";
  const location =
    item.location.path.length > 1 ? item.location.path.slice(-2).join(" · ") : item.location.name;
  const photo = item.images[0];
  const artwork = photo ? null : categoryArtwork(item.category.id);
  const image = photo ?? artwork?.src;

  return (
    <Link href={`/items/${item.id}`} className="item-card">
      <div className="thumb">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="thumb-placeholder">
            {item.type === "found" ? <BoxIcon size={34} /> : <SearchIcon size={34} />}
            <small>No photo yet</small>
          </span>
        )}
        {artwork && !photo && <span className="thumb-fallback">Illustration · no photo</span>}
        <span className={`badge card-type ${item.type}`}>
          <span className="badge-dot" aria-hidden="true" />
          {item.type === "found" ? "Found" : "Lost"}
        </span>
        {item.status === "returned" && (
          <span className="thumb-stamp">
            <CheckCircleIcon size={14} /> Reunited
          </span>
        )}
      </div>
      <div className="body">
        <span className="title">{item.title}</span>
        <span className="path">
          <MapPinIcon size={14} /> {location}
        </span>
        <span className="meta">
          {item.category.name}
          <span className="meta-sep" aria-hidden="true" />
          <ClockIcon size={13} /> {timeAgo(item.postedAt)}
        </span>
        <div className="card-foot">
          <span className={`status-pill ${statusTone}`}>
            <span className="status-dot" aria-hidden="true" />
            {statusLabel}
          </span>
          {item.claimable && item.status !== "returned" && <span className="badge claim">Claims open</span>}
          <span className="card-arrow" aria-hidden="true">
            <ArrowRightIcon size={16} />
          </span>
        </div>
      </div>
    </Link>
  );
}
