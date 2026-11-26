import type { Metadata } from "next";
import Link from "next/link";
import { BoardGrid } from "@/components/BoardGrid";
import { LockIcon, PlusCircleIcon, ShieldCheckIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Public board",
  description:
    "Browse redacted lost and found listings on campus. Search by category, location or keyword and claim what is yours with a private ownership check.",
  robots: { index: true },
};

export default function BoardPage() {
  return (
    <div className="container page board-page">
      <div className="board-hero">
        <div>
          <span className="eyebrow muted">Public board</span>
          <h1>
            Find what you lost.
            <br />
            <span className="grad-text">Return what you found.</span>
          </h1>
          <p>
            Every listing is redacted: no contact details, no identifying marks. Ownership is proven privately,
            then a supervised handover closes the loop.
          </p>
        </div>
        <Link href="/report" className="btn btn-lg">
          <PlusCircleIcon size={18} /> New report
        </Link>
      </div>

      <div className="notice privacy-notice">
        <span className="notice-icon">
          <LockIcon size={20} />
        </span>
        <div>
          <strong>Secret details stay secret.</strong> What only the owner would know is encrypted and never
          appears here. Claimants answer verification questions instead.
          <span className="notice-meta">
            <ShieldCheckIcon size={14} /> Encrypted at rest
          </span>
        </div>
      </div>

      <BoardGrid showFilters limit={12} />
    </div>
  );
}
