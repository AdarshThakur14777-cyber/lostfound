import type { Metadata } from "next";
import Link from "next/link";
import { BoardGrid } from "@/components/BoardGrid";

export const metadata: Metadata = {
  title: "Public board · Campus Lost & Found",
  robots: { index: true },
};

export default function BoardPage() {
  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Public board</h1>
          <p>
            Every listing is redacted: no contact details, no identifying marks.{" "}
            <Link href="/report?type=found">Found something?</Link>
          </p>
        </div>
        <Link href="/report" className="btn">
          New report
        </Link>
      </div>

      <div className="notice">
        🔒 Secret details (what only the owner would know) are stored encrypted and never appear on this
        board. Claimants answer verification questions instead.
      </div>

      <BoardGrid showFilters limit={12} />
    </div>
  );
}
