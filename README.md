# ShipNotes

ShipNotes turns a list of commit subjects into a user-facing changelog.

Paste the subjects. It groups them into Added, Fixed, and Changed, drops chores and merges, and rewrites the kept lines in plain language. You can save the note and reopen it later.

This is a small TypeScript MERN app: React, Express, MongoDB, and an OpenAI-compatible model. If you do not set a model key, it still runs. The screen is labeled as offline grouping, not as a model judgment.

## What you can do

- Paste commit subjects, one per line, or load the sample.
- Get Added / Fixed / Changed groups plus the lines that were dropped.
- Save each note and reopen it later.
- Delete a note you do not want to keep.

The model is told not to invent features or bug numbers that are not in the subjects. The offline path only splits and lightly cleans the text you already pasted.

## Stack

| Piece | Choice |
| --- | --- |
| UI | React 19, TypeScript, Vite, Tailwind CSS |
| Data fetching | axios + TanStack Query |
| Dates | date-fns |
| API | Express 4, TypeScript, Zod, helmet, cors |
| Data | MongoDB via Mongoose, or an in-memory store |
| Model | `openai` SDK against any compatible base URL |
| Tests | `node:test` through `tsx` |

## Run it

Node 20 or newer.

```bash
cp .env.example .env
npm install
npm run dev
```

Open the Vite URL printed in the terminal (port 5173). The API is on port 4000. Vite proxies `/api` to it.

Production-style, one process:

```bash
npm run build
npm start
```

Then open port 4000. Express serves the built React app.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | API port. Default `4000`. |
| `MONGO_URI` | No | Example: `mongodb://127.0.0.1:27017/shipnotes`. If empty, notes live in memory and vanish when the process stops. |
| `OPENAI_API_KEY` | No | If empty, ShipNotes uses the offline grouping. |
| `OPENAI_BASE_URL` | No | Use this for xAI, Groq, OpenRouter, or a local server. |
| `OPENAI_MODEL` | No | Default `gpt-4o-mini`. |

Do not commit `.env`.

## API

`GET /api/health` — `{ ok, store: "memory" | "mongo", ai: "model" | "heuristic", model }`

`GET /api/changelogs?limit=20` — newest first, limit 1–50.

`POST /api/changelogs` — body `{ commitsText, title?, releaseDate? }`. `commitsText` must be 10–20,000 characters. Returns the saved note.

`GET /api/changelogs/:id`

`DELETE /api/changelogs/:id` — `204` when removed.

## Scripts

```bash
npm test
npm run typecheck
npm run build
```

GitHub Actions runs those three on every push.

## Limits

- The offline path only looks at prefixes and a few keywords. It will not rewrite a cryptic subject into a good user sentence.
- The model can still mis-group a line. Read the original subjects before you publish the note.
- There is no login. Anyone who can reach the server can read saved notes. Do not point this at the public internet with private commit messages.

Design notes for someone changing the code are in [DEVELOPER.md](DEVELOPER.md).
