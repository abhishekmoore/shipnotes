import OpenAI from "openai";
import { modelResultSchema, type ChangelogResult, type ModelResult } from "../types.js";

const SYSTEM = `You turn commit subjects into a user-facing changelog.
Group them into added, fixed, and changed.
Drop chores, merges, reverts of chores, and pure dependency bumps that are not user-visible.
Rewrite each kept line in plain user language. Do not invent features, bug numbers, or file names that are not in the subjects.
Return JSON only: { "added": string[], "fixed": string[], "changed": string[], "dropped": string[] }.
dropped is the original subjects you chose to omit.`;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw.trim());
}

export function heuristicChangelog(commitsText: string): ChangelogResult {
  const lines = commitsText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const added: string[] = [];
  const fixed: string[] = [];
  const changed: string[] = [];
  const dropped: string[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (
      lower.startsWith("chore") ||
      lower.startsWith("merge") ||
      lower.startsWith("revert") ||
      lower.includes("dependabot") ||
      lower.includes("bump ") ||
      lower.startsWith("ci:") ||
      lower.startsWith("build:") ||
      lower.startsWith("docs:")
    ) {
      dropped.push(line);
      continue;
    }
    if (lower.startsWith("fix") || lower.includes("bug") || lower.startsWith("hotfix")) {
      fixed.push(line.replace(/^fix[:\s-]*/i, "").replace(/^hotfix[:\s-]*/i, ""));
    } else if (lower.startsWith("feat") || lower.startsWith("add ") || lower.startsWith("added ")) {
      added.push(line.replace(/^feat[:\s-]*/i, "").replace(/^added?[:\s-]*/i, ""));
    } else {
      changed.push(line);
    }
  }

  return {
    added: added.slice(0, 20).map((s) => s.charAt(0).toUpperCase() + s.slice(1)),
    fixed: fixed.slice(0, 20).map((s) => s.charAt(0).toUpperCase() + s.slice(1)),
    changed: changed.slice(0, 20).map((s) => s.charAt(0).toUpperCase() + s.slice(1)),
    dropped: dropped.slice(0, 30),
    source: "heuristic",
  };
}

export async function fromModel(
  client: OpenAI,
  model: string,
  commitsText: string,
): Promise<ChangelogResult> {
  const ask = async (extra?: string) => {
    const messages = [
      { role: "system" as const, content: SYSTEM },
      {
        role: "user" as const,
        content: extra ? `${commitsText}\n\n${extra}` : commitsText,
      },
    ];
    try {
      const res = await client.chat.completions.create({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages,
      });
      return res.choices[0]?.message?.content ?? "";
    } catch {
      const res = await client.chat.completions.create({
        model,
        temperature: 0.2,
        messages,
      });
      return res.choices[0]?.message?.content ?? "";
    }
  };

  let text = await ask();
  let parsed: unknown;
  try {
    parsed = extractJson(text);
    const checked = modelResultSchema.safeParse(parsed);
    if (checked.success) {
      return { ...checked.data, source: "model", model };
    }
  } catch {
    /* retry */
  }

  text = await ask("Previous output was invalid JSON or failed schema. Return only valid JSON.");
  try {
    parsed = extractJson(text);
    const checked = modelResultSchema.safeParse(parsed);
    if (checked.success) {
      return { ...checked.data, source: "model", model };
    }
  } catch {
    /* fall through */
  }

  const fallback = heuristicChangelog(commitsText);
  fallback.dropped.push("Model call failed; used offline grouping.");
  return fallback;
}

export async function generateChangelog(
  commitsText: string,
): Promise<ChangelogResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return heuristicChangelog(commitsText);

  const client = new OpenAI({
    apiKey: key,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  try {
    return await fromModel(client, model, commitsText);
  } catch {
    const fallback = heuristicChangelog(commitsText);
    fallback.dropped.push("Model call failed; used offline grouping.");
    return fallback;
  }
}
