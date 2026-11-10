import { z } from "zod";

export const modelResultSchema = z.object({
  added: z.array(z.string()).max(20),
  fixed: z.array(z.string()).max(20),
  changed: z.array(z.string()).max(20),
  dropped: z.array(z.string()).max(30),
});

export type ModelResult = z.infer<typeof modelResultSchema>;

export interface ChangelogResult extends ModelResult {
  source: "model" | "heuristic";
  model?: string;
}

export interface Changelog {
  id: string;
  title: string;
  commitsText: string;
  releaseDate: string; // ISO
  result: ChangelogResult;
  createdAt: string;
}

export interface ChangelogStore {
  insert(doc: Omit<Changelog, "id" | "createdAt">): Promise<Changelog>;
  list(limit: number): Promise<Changelog[]>;
  get(id: string): Promise<Changelog | null>;
  remove(id: string): Promise<boolean>;
}
