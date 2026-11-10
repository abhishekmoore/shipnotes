import { test } from "node:test";
import assert from "node:assert/strict";
import { heuristicChangelog } from "./changelog.js";
import { format } from "date-fns";

test("heuristic drops chores and merges, groups the rest", () => {
  const text = `feat: add dark mode
fix: login timeout
chore: bump deps
Merge branch 'main'
docs: update readme
changed button color`;
  const r = heuristicChangelog(text);
  assert.equal(r.source, "heuristic");
  assert.ok(r.added.some((s) => s.toLowerCase().includes("dark")));
  assert.ok(r.fixed.some((s) => s.toLowerCase().includes("timeout")));
  assert.ok(r.dropped.some((s) => s.toLowerCase().includes("chore") || s.toLowerCase().includes("merge") || s.toLowerCase().includes("docs")));
  assert.ok(r.changed.some((s) => s.toLowerCase().includes("button")));
});

test("date-fns format returns a readable date", () => {
  const iso = "2026-11-10T00:00:00.000Z";
  const out = format(new Date(iso), "MMMM d, yyyy");
  assert.match(out, /November 10, 2026/);
});
