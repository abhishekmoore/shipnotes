import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { listChangelogs, createChangelog, deleteChangelog, health } from "./api";
import type { Changelog } from "./types";

const SAMPLE = `feat: add CSV export for invoices
fix: timeout on large PDF uploads
feat: dark mode toggle in settings
chore: bump react to 19
Merge branch 'main' into feature/export
fix: missing currency symbol on totals
docs: update README
changed default sort to newest first`;

export default function App() {
  const qc = useQueryClient();
  const [commitsText, setCommitsText] = useState("");
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const healthQ = useQuery({ queryKey: ["health"], queryFn: health });
  const listQ = useQuery({ queryKey: ["changelogs"], queryFn: listChangelogs });

  const createMut = useMutation({
    mutationFn: createChangelog,
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["changelogs"] });
      setSelected(row.id);
      setCommitsText("");
      setTitle("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteChangelog,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["changelogs"] });
      setSelected(null);
    },
  });

  const rows = listQ.data ?? [];
  const current = rows.find((r) => r.id === selected) ?? null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ShipNotes</h1>
            <p className="text-sm text-slate-600">Paste commit subjects. Get a user-facing changelog.</p>
          </div>
          <div className="text-xs text-slate-500">
            {healthQ.data
              ? healthQ.data.ai === "model"
                ? `model · ${healthQ.data.model}`
                : "offline grouping"
              : "…"}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-6 py-6 md:grid-cols-[1fr_280px]">
        <section className="space-y-4">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <label className="mb-1 block text-sm font-medium">Release title (optional)</label>
            <input
              className="mb-3 w-full rounded border px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="v1.4.0 or November release"
            />
            <label className="mb-1 block text-sm font-medium">Commit subjects</label>
            <textarea
              className="h-48 w-full rounded border px-3 py-2 font-mono text-sm"
              value={commitsText}
              onChange={(e) => setCommitsText(e.target.value)}
              placeholder="One subject per line"
            />
            <div className="mt-3 flex gap-2">
              <button
                className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                disabled={commitsText.trim().length < 10 || createMut.isPending}
                onClick={() =>
                  createMut.mutate({
                    commitsText,
                    title: title || undefined,
                    releaseDate: new Date().toISOString(),
                  })
                }
              >
                {createMut.isPending ? "Grouping…" : "Write notes"}
              </button>
              <button
                className="rounded border px-4 py-2 text-sm"
                onClick={() => setCommitsText(SAMPLE)}
              >
                Load sample
              </button>
            </div>
            {createMut.isError && (
              <p className="mt-2 text-sm text-red-600">Could not save. Check the API.</p>
            )}
          </div>

          {current && <Result row={current} onDelete={() => deleteMut.mutate(current.id)} deleting={deleteMut.isPending} />}
        </section>

        <aside>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Saved</h2>
          {listQ.isPending && <p className="text-sm text-slate-500">Loading…</p>}
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  className={`w-full rounded border px-3 py-2 text-left text-sm ${
                    selected === row.id ? "border-slate-900 bg-slate-100" : "bg-white"
                  }`}
                  onClick={() => setSelected(row.id)}
                >
                  <div className="font-medium">{row.title || "Untitled release"}</div>
                  <div className="text-xs text-slate-500">
                    {format(new Date(row.releaseDate || row.createdAt), "MMM d, yyyy")}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </div>
  );
}

function Result({ row, onDelete, deleting }: { row: Changelog; onDelete: () => void; deleting: boolean }) {
  const r = row.result;
  return (
    <article className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{row.title || "Changelog"}</h2>
          <p className="text-sm text-slate-500">
            {format(new Date(row.releaseDate || row.createdAt), "MMMM d, yyyy")} ·{" "}
            {r.source === "model" ? `model${r.model ? ` (${r.model})` : ""}` : "offline grouping"}
          </p>
        </div>
        <button
          className="text-sm text-red-600 disabled:opacity-50"
          disabled={deleting}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
      <Group title="Added" items={r.added} />
      <Group title="Fixed" items={r.fixed} />
      <Group title="Changed" items={r.changed} />
      {r.dropped.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-slate-500">Dropped ({r.dropped.length})</summary>
          <ul className="mt-1 list-disc pl-5 text-slate-500">
            {r.dropped.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

function Group({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="mb-3">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <ul className="mt-1 list-disc pl-5 text-sm">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
