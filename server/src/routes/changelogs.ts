import { Router } from "express";
import { z } from "zod";
import { generateChangelog } from "../ai/changelog.js";
import type { ChangelogStore } from "../types.js";

const requestSchema = z.object({
  commitsText: z.string().min(10).max(20000),
  title: z.string().max(120).optional(),
  releaseDate: z.string().optional(),
});

export function changelogsRouter(store: ChangelogStore) {
  const router = Router();

  router.get("/", async (req, res) => {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const rows = await store.list(limit);
    res.json(rows);
  });

  router.post("/", async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "commitsText must be 10–20,000 characters." });
      return;
    }
    const { commitsText, title = "", releaseDate = new Date().toISOString() } = parsed.data;
    const result = await generateChangelog(commitsText);
    const saved = await store.insert({
      title,
      commitsText,
      releaseDate,
      result,
    });
    res.status(201).json(saved);
  });

  router.get("/:id", async (req, res) => {
    const row = await store.get(req.params.id);
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  });

  router.delete("/:id", async (req, res) => {
    const ok = await store.remove(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).end();
  });

  return router;
}
