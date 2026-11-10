import mongoose, { Schema } from "mongoose";
import { randomUUID } from "node:crypto";
import type { Changelog, ChangelogStore, ChangelogResult } from "./types.js";

const memory: Changelog[] = [];

export function createMemoryStore(): ChangelogStore {
  return {
    async insert(doc) {
      const row: Changelog = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        ...doc,
      };
      memory.unshift(row);
      return row;
    },
    async list(limit) {
      return memory.slice(0, limit);
    },
    async get(id) {
      return memory.find((r) => r.id === id) ?? null;
    },
    async remove(id) {
      const i = memory.findIndex((r) => r.id === id);
      if (i === -1) return false;
      memory.splice(i, 1);
      return true;
    },
  };
}

const ChangelogModel = mongoose.models.Changelog || mongoose.model(
  "Changelog",
  new Schema(
    {
      title: String,
      commitsText: String,
      releaseDate: String,
      result: Schema.Types.Mixed,
      createdAt: String,
    },
    { versionKey: false },
  ),
);

export async function createMongoStore(uri: string): Promise<ChangelogStore> {
  await mongoose.connect(uri);
  return {
    async insert(doc) {
      const created = await ChangelogModel.create({
        ...doc,
        createdAt: new Date().toISOString(),
      });
      return { id: created._id.toString(), ...doc, createdAt: created.createdAt };
    },
    async list(limit) {
      const rows = await ChangelogModel.find().sort({ createdAt: -1 }).limit(limit).lean();
      return rows.map((r: any) => ({
        id: r._id.toString(),
        title: r.title,
        commitsText: r.commitsText,
        releaseDate: r.releaseDate,
        result: r.result,
        createdAt: r.createdAt,
      }));
    },
    async get(id) {
      if (!mongoose.isValidObjectId(id)) return null;
      const r = await ChangelogModel.findById(id).lean();
      if (!r || Array.isArray(r)) return null;
      return {
        id: (r._id as { toString(): string }).toString(),
        title: r.title as string,
        commitsText: r.commitsText as string,
        releaseDate: r.releaseDate as string,
        result: r.result as ChangelogResult,
        createdAt: r.createdAt as string,
      };
    },
    async remove(id) {
      if (!mongoose.isValidObjectId(id)) return false;
      const res = await ChangelogModel.deleteOne({ _id: id });
      return res.deletedCount === 1;
    },
  };
}

export async function connectStore(): Promise<ChangelogStore> {
  const uri = process.env.MONGO_URI;
  if (uri) return createMongoStore(uri);
  return createMemoryStore();
}
