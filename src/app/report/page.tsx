"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  AlertIcon,
  BoxIcon,
  CameraIcon,
  CheckCircleIcon,
  ClockIcon,
  ImageIcon,
  LockIcon,
  PlusCircleIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";
import { api } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";
import type { PublicCategory, PublicLocation } from "@/lib/serialize/public";

interface SecretRow {
  question: string;
  answer: string;
}

function localDateTimeNow(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function ReportForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useMe();

  const [type, setType] = useState<"lost" | "found">(
    params.get("type") === "found" ? "found" : "lost",
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [occurredAt, setOccurredAt] = useState(localDateTimeNow());
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [secrets, setSecrets] = useState<SecretRow[]>([
    { question: "", answer: "" },
    { question: "", answer: "" },
  ]);
  const [photos, setPhotos] = useState<{ path: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taxonomy, setTaxonomy] = useState<{
    categories: PublicCategory[];
    locations: PublicLocation[];
  } | null>(null);

  useEffect(() => {
    api<{ categories: PublicCategory[]; locations: PublicLocation[] }>("/api/taxonomy")
      .then((data) => {
        setTaxonomy(data);
        if (!categoryId && data.categories.length > 0) setCategoryId(data.categories[0].id);
        if (!locationId && data.locations.length > 0) {
          setLocationId(data.locations.find((location) => location.parentId !== null)?.id ?? data.locations[0].id);
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const category = useMemo(
    () => taxonomy?.categories.find((entry) => entry.id === categoryId) ?? null,
    [taxonomy, categoryId],
  );

  const parents = useMemo(() => {
    if (!taxonomy) return [];
    const top = taxonomy.categories.filter((entry) => !entry.parentId);
    return top.map((parent) => ({
      parent,
      children: taxonomy.categories.filter((entry) => entry.parentId === parent.id),
    }));
  }, [taxonomy]);

  async function onPickFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, 4 - photos.length);
    if (files.length === 0) return;
    setUploading((count) => count + files.length);
    setError(null);
    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      const result = await api<{ paths: string[] }>("/api/uploads", { method: "POST", body: form });
      setPhotos((current) => [
        ...current,
        ...result.paths.map((path, index) => ({
          path,
          preview: URL.createObjectURL(files[index]),
        })),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setUploading((count) => Math.max(0, count - files.length));
    }
  }

  function removePhoto(path: string) {
    setPhotos((current) => {
      const target = current.find((photo) => photo.path === path);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((photo) => photo.path !== path);
    });
  }

  async function submit() {
    setError(null);
    if (title.trim().length < 3) return setError("Add a short title");
    if (description.trim().length < 10) return setError("Add a little more detail in the description");
    if (!categoryId || !locationId) return setError("Pick a category and a location");
    const filledSecrets = secrets
      .map((row) => ({ question: row.question.trim(), answer: row.answer.trim() }))
      .filter((row) => row.question.length >= 3 && row.answer.length >= 1);
    if (type === "found" && filledSecrets.length === 0) {
      return setError("Add at least one secret detail - only the real owner will know the answer");
    }

    setSubmitting(true);
    try {
      const item = await api<{ id: string }>("/api/items", {
        method: "POST",
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          categoryId,
          locationId,
          occurredAt,
          attributes,
          images: photos.map((photo) => photo.path),
          privateDetails: filledSecrets,
        }),
      });
      router.push(`/items/${item.id}?created=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the report");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="container page">
        <div className="skeleton" style={{ height: 420 }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container page report-page">
        <div className="page-head">
          <div>
            <span className="eyebrow muted">New report</span>
            <h1>File a report</h1>
            <p>Sign in first — it takes a few seconds and lets you track your report.</p>
          </div>
        </div>
        <div className="empty auth-empty">
          <span className="empty-icon">
            <LockIcon size={26} />
          </span>
          <h3>An account keeps your report safe</h3>
          <p>You need an account to file or claim items. Your details are never shown on the public board.</p>
          <div className="empty-actions">
            <Link className="btn" href="/login?next=/report">
              Sign in
            </Link>
            <Link className="btn secondary" href="/register">
              Create account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container page report-page">
      <div className="page-head report-head">
        <div>
          <span className="eyebrow muted">New report</span>
          <h1>File a report</h1>
          <p>Photo, what, where, when — the whole thing takes about a minute.</p>
        </div>
        <span className="time-pill">
          <ClockIcon size={15} /> About 1 minute
        </span>
      </div>

      <div className="segmented report-type" role="group" aria-label="Report type">
        <button
          type="button"
          className={type === "lost" ? "active" : ""}
          aria-pressed={type === "lost"}
          onClick={() => setType("lost")}
        >
          <SearchIcon size={17} /> I lost something
        </button>
        <button
          type="button"
          className={type === "found" ? "active" : ""}
          aria-pressed={type === "found"}
          onClick={() => setType("found")}
        >
          <BoxIcon size={17} /> I found something
        </button>
      </div>

      {error && (
        <div className="notice error" role="alert">
          <AlertIcon size={17} />
          <span>{error}</span>
        </div>
      )}

      <div className="report-grid">
        <div className="report-main">
          <section className="card plain form-section">
            <div className="section-title">
              <span className="section-icon">
                <CameraIcon size={20} />
              </span>
              <div>
                <h2>{type === "found" ? "What did you find?" : "What did you lose?"}</h2>
                <p>Start with a photo, then add the details that will help it get matched.</p>
              </div>
            </div>

            <div className="field">
              <div className="label-row">
                <label>
                  Photos {type === "found" ? "(front, back, any marks)" : "(as you remember it)"}
                </label>
                <span className="counter">{photos.length}/4</span>
              </div>
              <div className="photo-strip">
                {photos.map((photo) => (
                  <div className="photo-item" key={photo.path}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.preview} alt="" />
                    <button
                      type="button"
                      className="photo-remove"
                      aria-label="Remove photo"
                      onClick={() => removePhoto(photo.path)}
                    >
                      <XIcon size={13} />
                    </button>
                  </div>
                ))}
                {uploading > 0 ? (
                  <div className="slot">
                    <span className="spinner dark" />
                  </div>
                ) : (
                  photos.length < 4 && (
                    <>
                      <label className="slot" title="Take a photo">
                        <CameraIcon size={22} />
                        <span className="slot-caption">Camera</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          aria-label="Take a photo"
                          onChange={(event) => void onPickFiles(event.target.files)}
                        />
                      </label>
                      <label className="slot" title="Choose from gallery">
                        <ImageIcon size={22} />
                        <span className="slot-caption">Gallery</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          aria-label="Choose photos from gallery"
                          onChange={(event) => void onPickFiles(event.target.files)}
                        />
                      </label>
                    </>
                  )
                )}
              </div>
              <div className="hint">
                <CameraIcon size={14} />
                <span>
                  On a phone, <strong>Camera</strong> opens your camera so you can take a new photo;{" "}
                  <strong>Gallery</strong> lets you pick existing ones.
                </span>
              </div>
              <div className="hint">
                <ShieldCheckIcon size={14} /> Photos are resized and stripped of EXIF data (including GPS)
                before storage.
              </div>
            </div>

            <div className="field">
              <div className="label-row">
                <label htmlFor="report-title">Title</label>
                <span className="counter">{title.length}/120</span>
              </div>
              <input
                id="report-title"
                name="title"
                type="text"
                value={title}
                maxLength={120}
                placeholder={type === "found" ? "e.g. Found a black smartphone" : "e.g. Lost keys with red tag"}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="field">
              <div className="label-row">
                <label htmlFor="report-description">Description</label>
                <span className="counter">{description.length}/2000</span>
              </div>
              <textarea
                id="report-description"
                name="description"
                value={description}
                maxLength={2000}
                placeholder={
                  type === "found"
                    ? "What it looks like and where you found it. Keep secret marks out of this — they go below."
                    : "Colour, brand, distinguishing features, last known location."
                }
                onChange={(event) => setDescription(event.target.value)}
              />
              {type === "found" && (
                <div className="hint">
                  Do not mention unique identifiers (names, stickers, serials) here — put them in the secret
                  details so only the owner can use them.
                </div>
              )}
            </div>

            <div className="row-inline report-row">
              <div className="field">
                <label htmlFor="report-category">Category</label>
                <select
                  id="report-category"
                  name="category"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  {parents.map(({ parent, children }) => (
                    <optgroup key={parent.id} label={parent.name}>
                      {children.length === 0 && <option value={parent.id}>{parent.name}</option>}
                      {children.map((child) => (
                        <option key={child.id} value={child.id}>
                          {child.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="report-location">Where</label>
                <select
                  id="report-location"
                  name="location"
                  value={locationId}
                  onChange={(event) => setLocationId(event.target.value)}
                >
                  {taxonomy?.locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.path.join(" › ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="report-when">When did it happen?</label>
              <input
                id="report-when"
                name="occurredAt"
                type="datetime-local"
                value={occurredAt}
                max={localDateTimeNow()}
                onChange={(event) => setOccurredAt(event.target.value)}
              />
            </div>

            {category && category.attributes.length > 0 && (
              <div className="row-inline attribute-row">
                {category.attributes.map((attribute) => (
                  <div className="field" key={attribute} style={{ minWidth: 140, flex: 1 }}>
                    <label>{attribute}</label>
                    <input
                      type="text"
                      value={attributes[attribute] ?? ""}
                      maxLength={60}
                      placeholder={attribute}
                      onChange={(event) =>
                        setAttributes((current) => ({ ...current, [attribute]: event.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {type === "found" && (
            <section className="card plain form-section">
              <div className="section-title">
                <span className="section-icon accent">
                  <LockIcon size={20} />
                </span>
                <div>
                  <h2>Secret verification details</h2>
                  <p>
                    Questions only the real owner can answer. They are stored encrypted, never shown publicly,
                    and become the claim challenge.
                  </p>
                </div>
              </div>

              <div className="secret-list">
                {secrets.map((row, index) => (
                  <div className="secret-row" key={index}>
                    <input
                      type="text"
                      aria-label={`Secret question ${index + 1}`}
                      placeholder="Question, e.g. What is written on the sticker inside?"
                      value={row.question}
                      maxLength={200}
                      onChange={(event) =>
                        setSecrets((current) =>
                          current.map((entry, i) =>
                            i === index ? { ...entry, question: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                    <input
                      type="text"
                      aria-label={`Secret answer ${index + 1}`}
                      placeholder="Answer (only you and the system)"
                      value={row.answer}
                      maxLength={200}
                      onChange={(event) =>
                        setSecrets((current) =>
                          current.map((entry, i) =>
                            i === index ? { ...entry, answer: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                    {secrets.length > 1 && (
                      <button
                        type="button"
                        className="btn secondary small icon-btn"
                        aria-label={`Remove secret detail ${index + 1}`}
                        onClick={() => setSecrets((current) => current.filter((_, i) => i !== index))}
                      >
                        <TrashIcon size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn ghost small add-secret"
                onClick={() => setSecrets((current) => [...current, { question: "", answer: "" }])}
              >
                <PlusCircleIcon size={16} /> Add another secret detail
              </button>
            </section>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-lg"
              onClick={() => void submit()}
              disabled={submitting || uploading > 0}
            >
              {submitting ? (
                <span className="spinner" />
              ) : type === "found" ? (
                "Submit found item"
              ) : (
                "Submit lost report"
              )}
            </button>
            <button type="button" className="btn secondary btn-lg" onClick={() => router.push("/board")}>
              Cancel
            </button>
            <span className="form-actions-note">
              <LockIcon size={14} /> Details stay private
            </span>
          </div>
        </div>

        <aside className="report-aside">
          <div className="tip-card">
            <span className="tip-icon">
              <SparklesIcon size={18} />
            </span>
            <h3>A great report has…</h3>
            <ul className="check-list">
              <li>
                <CheckCircleIcon size={15} /> A clear, specific title
              </li>
              <li>
                <CheckCircleIcon size={15} /> A recent photo or two
              </li>
              <li>
                <CheckCircleIcon size={15} /> The exact place and time
              </li>
              <li>
                <CheckCircleIcon size={15} /> A detail only the owner knows
              </li>
            </ul>
          </div>
          <div className="tip-card privacy">
            <span className="tip-icon">
              <ShieldCheckIcon size={18} />
            </span>
            <h3>Privacy by default</h3>
            <p>
              The public board shows a redacted listing. Contact details, secret answers and identifying marks
              stay encrypted and are used only for ownership checks.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <div className="container page">
          <div className="skeleton" />
        </div>
      }
    >
      <ReportForm />
    </Suspense>
  );
}
