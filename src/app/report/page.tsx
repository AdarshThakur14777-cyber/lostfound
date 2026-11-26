"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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

  if (loading) return <div className="container page"><div className="skeleton" /></div>;

  if (!user) {
    return (
      <div className="container page">
        <div className="page-head">
          <div>
            <h1>File a report</h1>
            <p>Sign in first - it takes a few seconds and lets you track your report.</p>
          </div>
        </div>
        <div className="empty">
          <p>You need an account to file or claim items.</p>
          <a className="btn" href="/login?next=/report">
            Sign in
          </a>{" "}
          <a className="btn secondary" href="/register">
            Create account
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="container page" style={{ maxWidth: 720 }}>
      <div className="page-head">
        <div>
          <h1>File a report</h1>
          <p>Under a minute: photo, what, where, when.</p>
        </div>
      </div>

      <div className="segmented">
        <button
          type="button"
          className={type === "lost" ? "active" : ""}
          onClick={() => setType("lost")}
        >
          🔎 I lost something
        </button>
        <button
          type="button"
          className={type === "found" ? "active" : ""}
          onClick={() => setType("found")}
        >
          📦 I found something
        </button>
      </div>

      {error && <div className="notice error">{error}</div>}

      <div className="card plain mb">
        <div className="field">
          <label>Photos {type === "found" ? "(front, back, any marks)" : "(as you remember it)"}</label>
          <div className="photo-strip">
            {photos.map((photo) => (
              <div className="slot" key={photo.path}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.preview} alt="" />
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
                    📷
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(event) => void onPickFiles(event.target.files)}
                    />
                  </label>
                  <label className="slot" title="Choose from gallery">
                    🖼️
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => void onPickFiles(event.target.files)}
                    />
                  </label>
                </>
              )
            )}
          </div>
          <div className="hint">
            Photos are resized and stripped of EXIF data (including GPS) before storage.
          </div>
        </div>

        <div className="field">
          <label>Title</label>
          <input
            type="text"
            value={title}
            maxLength={120}
            placeholder={type === "found" ? "e.g. Found a black smartphone" : "e.g. Lost keys with red tag"}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="field">
          <label>Description</label>
          <textarea
            value={description}
            maxLength={2000}
            placeholder={
              type === "found"
                ? "What it looks like and where you found it. Keep secret marks out of this - they go below."
                : "Colour, brand, distinguishing features, last known location."
            }
            onChange={(event) => setDescription(event.target.value)}
          />
          {type === "found" && (
            <div className="hint">
              Do not mention unique identifiers (names, stickers, serials) here - put them in the secret
              details so only the owner can use them.
            </div>
          )}
        </div>

        <div className="row-inline">
          <div className="field">
            <label>Category</label>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
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
            <label>Where</label>
            <select value={locationId} onChange={(event) => setLocationId(event.target.value)}>
              {taxonomy?.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.path.join(" › ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label>When did it happen?</label>
          <input
            type="datetime-local"
            value={occurredAt}
            max={localDateTimeNow()}
            onChange={(event) => setOccurredAt(event.target.value)}
          />
        </div>

        {category && category.attributes.length > 0 && (
          <div className="row-inline" style={{ flexWrap: "wrap" }}>
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
      </div>

      {type === "found" && (
        <div className="card plain mb">
          <h3>🔐 Secret verification details</h3>
          <p className="muted" style={{ fontSize: "0.9rem" }}>
            Questions only the real owner can answer. They are stored encrypted, never shown publicly, and
            become the claim challenge.
          </p>
          {secrets.map((row, index) => (
            <div className="secret-row" key={index}>
              <input
                type="text"
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
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setSecrets((current) => current.filter((_, i) => i !== index))}
                disabled={secrets.length <= 1}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn ghost small"
            onClick={() => setSecrets((current) => [...current, { question: "", answer: "" }])}
          >
            + Add another secret detail
          </button>
        </div>
      )}

      <div className="row-inline">
        <button
          type="button"
          className="btn"
          onClick={() => void submit()}
          disabled={submitting || uploading > 0}
          style={{ padding: "13px 20px" }}
        >
          {submitting ? <span className="spinner" /> : type === "found" ? "Submit found item" : "Submit lost report"}
        </button>
        <button type="button" className="btn secondary" onClick={() => router.push("/board")}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="container page"><div className="skeleton" /></div>}>
      <ReportForm />
    </Suspense>
  );
}
