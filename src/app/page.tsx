import Link from "next/link";
import { getDb } from "@/lib/db";
import { items } from "@/models/collections";
import { BoardGrid } from "@/components/BoardGrid";
import {
  ArrowRightIcon,
  BoxIcon,
  CameraIcon,
  CheckCircleIcon,
  ClockIcon,
  FileTextIcon,
  LockIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrendUpIcon,
} from "@/components/icons";

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

const STEPS = [
  {
    icon: CameraIcon,
    title: "Report with a photo",
    body: "Add a photo, category, campus location and time. For found items you also record secret details that are never shown in public.",
  },
  {
    icon: SparklesIcon,
    title: "Let matching do the work",
    body: "Lost and found reports are compared on wording, category, location and time proximity. You are notified the moment something looks like a match.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Verify, then hand over",
    body: "Claimants answer questions drawn from the finder's secret details. Security completes a supervised handover with a code or signature and a proof photo.",
  },
];

export default async function HomePage() {
  const s = await stats();
  const statCards = [
    { label: "Reports filed", value: s.reported, icon: FileTextIcon, tone: "brand", hint: "All time" },
    { label: "Items returned", value: s.returned, icon: CheckCircleIcon, tone: "green", hint: "Reunited" },
    { label: "Return rate", value: `${s.rate}%`, icon: TrendUpIcon, tone: "violet", hint: "Resolved share" },
    { label: "Active listings", value: s.active, icon: BoxIcon, tone: "amber", hint: "On the board" },
  ] as const;

  return (
    <div className="home">
      <section className="hero-shell">
        <div className="hero-orb hero-orb-one" aria-hidden="true" />
        <div className="hero-orb hero-orb-two" aria-hidden="true" />
        <div className="container hero">
          <span className="eyebrow">
            <SparklesIcon size={15} />
            Privacy-first campus lost &amp; found
          </span>
          <h1>
            Lost something? <span className="grad-text">Found something?</span>
            <br />
            Start here.
          </h1>
          <p className="hero-lead">
            Report in under a minute, get matched automatically, prove ownership with a private verification
            challenge, and collect your item through a supervised handover — every step recorded in a custody
            chain.
          </p>
          <div className="actions">
            <Link href="/report?type=lost" className="btn btn-lg">
              <SearchIcon size={18} /> I lost something
            </Link>
            <Link href="/report?type=found" className="btn success btn-lg">
              <BoxIcon size={18} /> I found something
            </Link>
            <Link href="/board" className="btn secondary btn-lg">
              Browse the board <ArrowRightIcon size={17} />
            </Link>
          </div>
          <div className="trust-row" aria-label="Platform guarantees">
            <span>
              <LockIcon size={16} /> Secret details encrypted
            </span>
            <span>
              <ShieldCheckIcon size={16} /> Supervised handovers
            </span>
            <span>
              <ClockIcon size={16} /> Automatic match alerts
            </span>
          </div>
        </div>
      </section>

      <div className="container home-body">
        <section className="stats" aria-label="Lost and found statistics">
          {statCards.map((card) => (
            <div className={`stat tone-${card.tone}`} key={card.label}>
              <span className="stat-icon">
                <card.icon size={19} />
              </span>
              <div>
                <div className="value">{card.value}</div>
                <div className="label">{card.label}</div>
                <div className="stat-hint">{card.hint}</div>
              </div>
            </div>
          ))}
        </section>

        <section className="steps-section" id="how-it-works">
          <div className="section-head">
            <div>
              <span className="eyebrow muted">How it works</span>
              <h2>From report to reunion in three steps</h2>
            </div>
            <p>
              Designed so that the finder never has to publish identifying details — and the owner still gets
              their item back.
            </p>
          </div>
          <div className="steps">
            {STEPS.map((step, index) => (
              <div className="step" key={step.title}>
                <div className="step-top">
                  <span className="step-icon">
                    <step.icon size={21} />
                  </span>
                  <span className="step-num">Step {index + 1}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="board-preview">
          <div className="page-head">
            <div>
              <span className="eyebrow live">
                <span className="live-dot" aria-hidden="true" /> Live board
              </span>
              <h2>On the board right now</h2>
              <p>Public listings — identifying details are redacted.</p>
            </div>
            <Link href="/board" className="btn secondary">
              See all listings <ArrowRightIcon size={16} />
            </Link>
          </div>
          <BoardGrid limit={6} />
        </section>

        <section className="cta-band">
          <div>
            <span className="eyebrow light">Help it get home</span>
            <h2>Found something on campus?</h2>
            <p>
              A two-minute report can make someone&apos;s week. Add one secret detail only the owner would know,
              and we&apos;ll handle the rest.
            </p>
          </div>
          <div className="cta-actions">
            <Link href="/report?type=found" className="btn light">
              <BoxIcon size={18} /> Report a found item
            </Link>
            <Link href="/board" className="btn outline-light">
              Browse the board
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
