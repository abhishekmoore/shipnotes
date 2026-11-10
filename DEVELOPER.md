# Developer notes

This file is the map of the code. Read it before changing a route or the prompt. The product explanation for someone running the app is in [README.md](README.md).

## Shape

Two packages, one repo, npm workspaces.

```text
client/     React + Vite + Tailwind. Talks only to /api.
server/     Express. Owns validation, the model, and storage.
```

The client does not import server files. The changelog contract is duplicated in `client/src/types.ts` and `server/src/types.ts` on purpose.

## Request path

1. `client/src/App.tsx` submits the form through `client/src/api.ts` (axios).
2. `server/src/routes/changelogs.ts` parses the body with Zod. A failed parse is a 400 with one sentence.
3. `generateChangelog` in `server/src/ai/changelog.ts` either calls the model or `heuristicChangelog`.
4. The store inserts the input plus the result. The response is the saved record.
5. Errors hit the handler in `server/src/app.ts` and become a 500 `{ error }`.

`GET /api/health` tells the header whether it is showing a model name or the words "offline grouping".

## Model contract

`modelResultSchema` is the only shape we accept from a model:

- `added`, `fixed`, `changed`, `dropped` string arrays, with caps

`source` and `model` are set by our code after parsing.

Flow inside `fromModel`:

1. Ask with `response_format: json_object`.
2. If that flag is rejected, retry without it.
3. Strip optional markdown fences and run Zod.
4. On invalid JSON, ask once more.
5. If that still fails, or the HTTP call fails, return the heuristic result and note the failure in `dropped`. The badge still says the result is offline.

The system prompt forbids invented features, bug numbers, or file names. Zod checks shape, not truth.

## Offline checker

`heuristicChangelog` splits on newlines, drops lines that start with chore/merge/docs/ci/build or contain dependabot/bump, and buckets the rest by prefix into added / fixed / changed. It capitalizes the first letter. It does not invent new wording.

## Storage

`ChangelogStore` is the seam: `insert`, `list`, `get`, `remove`.

- `createMemoryStore` keeps an array in the process. Used when `MONGO_URI` is empty.
- `createMongoStore` connects with Mongoose and maps `_id` to `id`.

`connectStore` is the only place that chooses.

## Library notes

- **Tailwind CSS** (`@tailwindcss/vite`): all UI styling. Used throughout `client/src/App.tsx`. Interview answer: utility-first CSS keeps the design in the component instead of a separate stylesheet that drifts.
- **date-fns**: formats every timestamp the user sees. `format(new Date(row.releaseDate), "MMMM d, yyyy")` in `client/src/App.tsx` returns e.g. "November 10, 2026". Interviewers still say "moment"; Moment is legacy, mutable, and heavy; this repo uses date-fns.
- **axios**: every API call. `client/src/api.ts`. Interview answer: a single client with baseURL and interceptors instead of raw fetch scattered through components.
- **TanStack Query**: loading, creating, and deleting server data. Query key `["changelogs"]`, `invalidateQueries` after write, `isPending` on the mutation. `client/src/App.tsx`. Interview answer: server state stays in the query cache; do not keep a second copy in useState.
- **Zod**: request bodies and model JSON. `server/src/routes/changelogs.ts` and `server/src/ai/changelog.ts`. Interview answer: runtime validation at the boundary so TypeScript types are not the only check.
- **helmet**: `server/src/app.ts`. Interview answer: a one-line security header baseline for Express.
- **cors**: same file. Already required for the Vite proxy in development.

Redux Toolkit is for a large shared client cache this app does not have. React Query plus a little useState is enough.

## Tradeoffs

- In-memory fallback makes the repo runnable in a portfolio review. It is the wrong store for anything private or multi-instance.
- Falling back to the heuristic when the model fails keeps the demo alive. The risk note in `dropped` and the health badge are the signals.
- Duplicated types will drift if you only edit one side.

## Interview walkthrough

1. The UI never calls a model. It only posts text to Express.
2. Zod rejects short or huge payloads before any token is spent.
3. The model must return JSON. We parse it, check it, and retry once.
4. We label heuristic results so a missing API key cannot look like GPT.
5. Mongo is optional behind a store interface. Tests hit the memory implementation and the date-fns helper.
6. There is no auth, so the README tells you not to deploy it with private commit messages.
