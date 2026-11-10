import axios from "axios";
import type { Changelog } from "./types";

const api = axios.create({ baseURL: "/api" });

export async function listChangelogs(): Promise<Changelog[]> {
  const { data } = await api.get<Changelog[]>("/changelogs");
  return data;
}

export async function createChangelog(body: {
  commitsText: string;
  title?: string;
  releaseDate?: string;
}): Promise<Changelog> {
  const { data } = await api.post<Changelog>("/changelogs", body);
  return data;
}

export async function deleteChangelog(id: string): Promise<void> {
  await api.delete(`/changelogs/${id}`);
}

export async function health(): Promise<{ ai: string; model: string; store: string }> {
  const { data } = await api.get("/health");
  return data;
}
