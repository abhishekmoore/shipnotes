export interface ChangelogResult {
  added: string[];
  fixed: string[];
  changed: string[];
  dropped: string[];
  source: "model" | "heuristic";
  model?: string;
}

export interface Changelog {
  id: string;
  title: string;
  commitsText: string;
  releaseDate: string;
  result: ChangelogResult;
  createdAt: string;
}
