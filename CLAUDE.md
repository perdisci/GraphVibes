# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

Graph.Vibes is a Next.js web app that lets a user connect to a Gremlin-compatible
graph database (JanusGraph, PuppyGraph, TinkerPop) from the browser, run raw
Gremlin queries/scripts, and visualize the results as an interactive force-directed
graph. It's a developer tool / graph IDE, not a multi-tenant product — there is no
auth layer, and the API happily executes whatever Gremlin script it's given.

The codebase was originally built via AI "vibe coding" (see README.md). It has
since had a light cleanup pass (dead code removal, extracted duplicated
helpers, an ESLint config, a small Jest suite, host/port input validation, and
extraction of the modal components out of the main page) — see git history for
details. `pages/index.js` is still a large, dense file; see Architecture below.

## Stack

- Next.js 12.3.4 (Pages Router, not App Router), React 17
- `gremlin` 3.5.6 (official JS driver) for talking to the graph DB over WebSocket
- `react-force-graph-2d` for the canvas/WebGL graph rendering
- `@monaco-editor/react` for the Gremlin query editor
- `@anthropic-ai/sdk` for the AI Query Assistant (natural language → Gremlin,
  via the Claude API — see Architecture below)
- `lucide-react` for icons, `jspdf` for PDF export of the graph
- No CSS framework beyond `styles/globals.css`; theming is done via a
  `data-theme` attribute + CSS variables

## Architecture

- [pages/index.js](pages/index.js) — the application shell. Still a large,
  single `Home` component holding ~60 `useState`/`useRef` hooks: connection
  settings, theme, query editor state, sidebar/panel UI state, profiling/explain
  state, search, etc. The five modal dialogs (Graph Settings, Connection,
  Theme, About, Warning) have been extracted into
  [components/modals/](components/modals/) as presentational components that
  take `isOpen`/`onClose`/data props — `pages/index.js` just owns the
  open/closed state and the callbacks. The main layout (query editor, results/
  profiling/explanation panels, graph area, detail popup) is still inline here;
  it was deliberately left alone because splitting it further would require
  threading a large number of the shared state hooks across component
  boundaries, and there's no way to visually regression-test that in this
  environment — treat further extraction as a job for whoever can click
  through the UI afterward.
- [components/GraphViz.js](components/GraphViz.js) — the graph rendering
  component (~850 lines) wrapping `react-force-graph-2d`: node/edge coloring,
  layout modes (force, circular, community, tree/radial), legend, zoom
  controls, PDF export.
- [components/modals/](components/modals/) — `GraphSettingsModal`,
  `ConnectionModal`, `ThemeModal`, `AboutModal`, `WarningModal`,
  `AgentSettingsModal`. Pure presentational components; state lives in
  `pages/index.js`.
- **AI Query Assistant** — a box under the Gremlin Query editor in
  `pages/index.js` (state: `nlDescription`, `agentSettings`, handler
  `handleTranslateQuery`) lets the operator describe a query in plain English;
  it's translated by [pages/api/nl-to-gremlin.js](pages/api/nl-to-gremlin.js)
  and the result is written into the query editor via `setQuery(...)` — it
  never auto-executes. Before the first translation, if the operator hasn't
  set a schema in `AgentSettingsModal`, `handleTranslateQuery` first calls
  [pages/api/infer-schema.js](pages/api/infer-schema.js), which runs
  JanusGraph's `graph.openManagement().printSchema()` management call and
  returns its output; the result is written back into `agentSettings.schema`
  so the schema box in the settings modal is populated for the operator to
  review/edit, and is reused on every subsequent translation until they clear
  it. That call is JanusGraph-specific (`openManagement()` doesn't exist on
  PuppyGraph/plain TinkerPop) and treated as best-effort — if it fails,
  `handleTranslateQuery` proceeds with an empty schema and
  `pages/api/nl-to-gremlin.js` falls back to its own generic, backend-agnostic
  introspection (vertex/edge labels + a handful of sample `valueMap(true)`
  results, queried through the same `gremlin.driver.Client` pattern as
  `pages/api/query.js`) — that fallback is request-scoped only and is never
  written back into the UI. The route calls the Claude API (`claude-opus-5`,
  via `@anthropic-ai/sdk`, credentials from `ANTHROPIC_API_KEY`) with a system
  prompt built from [utils/gremlinAgentDefaults.js](utils/gremlinAgentDefaults.js)'s
  `DEFAULT_SYSTEM_PROMPT` (overridable via `AgentSettingsModal`) plus whichever
  schema ended up populated above — both go into the Claude API `system`
  parameter (never the per-request user message), so they're resent on every
  translation. The `ANTHROPIC_API_KEY` secret lives server-side only — never
  send it to the client, and don't add a UI field for it. `agentSettings`
  (system prompt + schema) is persisted server-side to `.agent-settings.json`
  (project root, gitignored) via [pages/api/agent-settings.js](pages/api/agent-settings.js)
  and [utils/agentSettingsStore.js](utils/agentSettingsStore.js) — `pages/index.js`
  loads it on mount and writes through `updateAgentSettings(...)` (used instead
  of the raw `setAgentSettings` setter everywhere the operator or the
  auto-inferred schema changes it), so settings survive page reloads and
  server restarts instead of living only in React state.
- [pages/api/query.js](pages/api/query.js) — the main backend endpoint. Per
  request it opens one or more short-lived `gremlin.driver.Client` connections
  directly (there is no shared/pooled connection), runs the user's raw query,
  then:
  - normalizes vertices/edges/paths into `{nodes, links}` for the graph
  - fetches any nodes referenced by edges but missing from the result set
  - optionally "auto-connects" nodes (fetches edges between all returned nodes)
  - optionally "enriches" nodes/edges for PuppyGraph, which often returns empty
    `elementMap()` properties and needs a follow-up fetch
  - handles a special `mode: 'edgeProps'` request shape for on-demand edge
    property lookups
  - listens for `req.on('close')` to cancel the in-flight Gremlin client when
    the browser aborts the fetch (query cancellation feature)
- [pages/api/test-connection.js](pages/api/test-connection.js) — opens/closes a
  client against `host`/`port` from the request body to validate connectivity.
- [utils/palettes.js](utils/palettes.js) — static color palette definitions for
  node/edge theming.
- [utils/themes.js](utils/themes.js) — the `THEME_CONFIG` map (light/dark/
  midnight background + label), shared between `pages/index.js` and
  `ThemeModal`.
- [utils/gremlinIds.js](utils/gremlinIds.js) — `getId`/`getSafeKey`/
  `formatResult`, extracted out of `pages/api/query.js` where they used to be
  redefined three separate times inline. Use these instead of reintroducing
  ad-hoc ID/key normalization.
- [utils/graphsonFormatting.js](utils/graphsonFormatting.js) — `parseGraphSON`
  (unwraps GraphSON 3.0's typed `{"@type", "@value"}` wrapper format) and the
  `formatProfileData`/`formatExplainData` pretty-printers used by the
  profiling/explain panels. Extracted out of `pages/index.js` so they're unit
  testable without a browser.
- [utils/validateConnection.js](utils/validateConnection.js) —
  `validateConnectionTarget(host, port)`. All three API routes call this
  before opening a Gremlin client; see the security note below.
- [utils/gremlinAgentDefaults.js](utils/gremlinAgentDefaults.js) —
  `DEFAULT_SYSTEM_PROMPT` for the AI Query Assistant, shared between the
  frontend (placeholder text in `AgentSettingsModal`) and the backend
  (fallback when the operator hasn't overridden it).

Host/port/query for every request come directly from the client's JSON body.
`validateConnectionTarget` rejects malformed host/port input (whitespace,
`://`, `@`, path separators, out-of-range ports) but does **not** restrict
*which* hosts can be reached — that's inherent to the tool's purpose (it's a
Gremlin console: connecting to arbitrary graph servers is the point), and the
query string itself is still executed as-is via `client.submit()`. An operator
who wants to lock this down when running somewhere more exposed than a trusted
local machine can set `GREMLIN_ALLOWED_HOSTS` (comma-separated hostnames) to
opt into an allowlist; it's unset (unrestricted) by default. Treat the app like
a local DB client, not a public API surface, regardless.

The AI Query Assistant sends the operator's natural-language description —
and, if configured or auto-inferred, a summary of the graph schema/sample data
— to Anthropic's Claude API. This is a third-party data flow distinct from the
Gremlin connection above; it only fires when the operator explicitly uses the
assistant, and only when `ANTHROPIC_API_KEY` is set.

## Running

```bash
npm install
npm run dev      # next dev, http://localhost:3000
npm run build
npm run start
npm run lint      # next lint, using .eslintrc.json (next/core-web-vitals)
npm test         # jest — see Testing below
```

Docker: `docker network create jgnet` once, then `docker-compose up -d`. The
compose file bind-mounts the repo into the container for live editing.

Requires a running Gremlin server (default `localhost:8182`); see README.md for
a JanusGraph quick-start with the "Graph of the Gods" sample data.

## Testing

There is a small Jest suite (`jest.config.js`, using `next/jest` so it shares
Next's SWC transform — no separate Babel config needed) covering the pure
logic in `utils/`: `gremlinIds`, `validateConnection`, and
`graphsonFormatting`. Run it with `npm test`. There is deliberately no
React/component-level testing infrastructure (no Testing Library, no jsdom
setup) — the modal components and the rest of the UI are not covered by
automated tests.

The root-level `test-*.js`, `verify_*.js`, and `reproduce_issue.js` files are
separate, older one-off manual scripts written against a live Gremlin server
and a running `npm run dev` instance (they hit `http://localhost:3000/api/query`
directly via Node's `http` module). They were used to debug specific past
issues (auto-connect, edge dedup, query cancellation) and are not wired into
CI or `npm test`. Treat them as disposable scratch scripts, not regression
tests — don't assume passing them proves a change is safe, and don't feel
obligated to keep them updated.

To manually verify a UI change, run `npm run dev`, connect to a real or
in-memory JanusGraph instance (see README quick-start), and exercise the
feature in the browser directly. There is no automated way to validate
UI/graph rendering changes in this repo today — `npm test` only covers the
extracted pure helpers.

## Conventions worth knowing

- `pages/index.js` and `components/GraphViz.js` are still dense and not fully
  modularized — when adding a feature, look for the existing pattern (e.g. how
  the extracted modals are wired: `pages/index.js` owns state, the modal
  component is presentational) rather than introducing a new structure.
- IDs coming back from Gremlin can be numbers, strings, or objects (e.g.
  PuppyGraph composite IDs) — use `getId`/`getSafeKey` from
  `utils/gremlinIds.js` to normalize IDs into deterministic map keys for
  dedup, rather than reintroducing naive `===`/`Map` key comparisons or a new
  local copy of these helpers. (`pages/index.js` still has a few of its own
  small inline `getSafeId` closures for client-side merge logic — those are
  simpler single-purpose variants, not duplicates of the API-side helpers.)
- `type: 'janus' | 'puppy'` in the request body toggles PuppyGraph-specific
  enrichment behavior — PuppyGraph's `elementMap()` often returns empty
  properties, which is why the enrichment branch exists.
- Commit style in this repo is short, imperative `type: description` messages
  (`feat: ...`, `fix: ...`), occasionally with a "bump version to x.y.z" commit
  alongside `package.json` version bumps.
