import Link from "next/link";
import { getDb } from "@/lib/db";
import { items } from "@/models/collections";
import { BoardGrid } from "@/components/BoardGrid";

export const dynamic = "force-dynamic";

async function stats() {
  try {
    const db = await getDb();
    const rows = await items(db)
      .aggregate<{ _id: { type: string; status: string }; count: number }>([
        { $group: { _id: { type: "$type", status: "$status" }, count: { $sum: 1 } } },
      ])
      .toArray();
    let reported = 0;
    let returned = 0;
    let active = 0;
    for (const row of rows) {
      reported += row.count;
      if (row._id.status === "returned") returned += row.count;
      if (["open", "claim_pending", "in_custody"].includes(row._id.status)) active += row.count;
    }
    return { reported, returned, active, rate: reported === 0 ? 0 : Math.round((returned / reported) * 100) };
  } catch {
    return { reported: 0, returned: 0, active: 0, rate: 0 };
  }
}

export default async function HomePage() {
  const s = await stats();
  return (
    <div className="container page">
      <section className="hero">
        <h1>Lost something on campus? Found something? Start here.</h1>
        <p>
          Report in under a minute, get matched automatically, prove ownership with a private verification
          challenge, and collect your item through a supervised handover - every step recorded in a custody
          chain.
        </p>
        <div className="actions">
          <Link href="/report?type=lost" className="btn">
            I lost something
          </Link>
          <Link href="/report?type=found" className="btn success">
            I found something
          </Link>
          <Link href="/board" className="btn secondary">
            Browse the board
          </Link>
        </div>
      </section>

      <section className="stats">
        <div className="stat">
          <div className="value">{s.reported}</div>
          <div className="label">Reports filed</div>
        </div>
        <div className="stat">
          <div className="value">{s.returned}</div>
          <div className="label">Items returned</div>
        </div>
        <div className="stat">
          <div className="value">{s.rate}%</div>
          <div className="label">Return rate</div>
        </div>
        <div className="stat">
          <div className="value">{s.active}</div>
          <div className="label">Active listings</div>
        </div>
      </section>

      <section className="steps">
        <div className="step">
          <div className="num">1</div>
          <h3>Report with a photo</h3>
          <p>
            Category, campus location and time. For found items you also record <strong>secret
            details</strong> that are never shown in public.
          </p>
        </div>
        <div className="step">
          <div className="num">2</div>
          <h3>Automatic matching</h3>
          <p>
            Lost and found reports are compared on wording, category, location and time proximity, and you
            are notified when something looks like a match.
          </p>
        </div>
        <div className="step">
          <div className="num">3</div>
          <h3>Verify, then hand over</h3>
          <p>
            Claimants answer questions drawn from the secret details. Security completes a supervised
            handover with an OTP or signature and a proof photo.
          </p>
        </div>
      </section>

      <section>
        <div className="page-head">
          <div>
            <h2>On the board right now</h2>
            <p>Public listings - identifying details are redacted.</p>
          </div>
          <Link href="/board" className="btn secondary">
            See all
          </Link>
        </div>
        <BoardGrid limit={6} />
      </section>
    </div>
  );
}
