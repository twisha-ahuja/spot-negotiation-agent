# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A POC where a human plays a freight transporter and negotiates a rate, in chat, against an AI procurement agent (Claude, GPT, or Gemini — swappable per session). The AI has a target rate and a walk-away rate that must never be revealed to the human. Every turn is optionally traced to Langfuse.

Two independently-run pieces locally, deployed as one Vercel project:

```
server/  FastAPI - negotiation orchestrator; owns the rates, the system prompt, session
         state, and model routing (calls Claude/GPT/Gemini via the litellm SDK directly).
         Deployed as its own Vercel "service" (see vercel.json) - no api/ wrapper.
client/  React (Vite) - the chat UI, deployed as its own Vercel "service"
proxy/   Unused by the app - a standalone LiteLLM proxy kept around but not called
         anymore (routing moved into server/lib/llm.py so there's no separate
         long-running process to deploy on Vercel)
```

## Commands

There is no build tooling, lint config, or test suite in this repo (POC-stage) — don't invent commands for them.

**Server**:
```bash
cd server
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 3001
```
API docs auto-generate at http://localhost:3001/docs — useful for poking endpoints directly instead of going through the UI.

**Client**:
```bash
cd client
npm install
npm run dev      # http://localhost:5173, proxies /api/* to localhost:3001
npm run build    # vite build, used to sanity-check for syntax/build errors
```

**Deploy**: `vercel` / `vercel --prod` from the repo root (see README's Deploying to Vercel section for required env vars).

## Architecture

### Request flow
Local dev: `client` (React, port 5173, Vite proxy) → `server` (FastAPI, port 3001) → model provider (Vertex AI / OpenAI / Gemini) directly via the `litellm` Python SDK.

Vercel: same client and server code, single project — deployed as two `services` in `vercel.json` (`client` and `server`), with a top-level rewrite sending `/api/*` to the `server` service so both share one origin (no CORS, no separate API URL to configure).

The client never talks to a model provider directly, and never sees the rates.

### The negotiation contract (`server/lib/prompt.py`)
`build_system_prompt(lane)` renders a system prompt from a `lane` dict (`name`, `currency`, `target_rate`, `walk_away_rate`, `max_rounds`, optional `extra_instructions`). The rules baked into the template: never reveal target/walk-away rates, wait for the transporter's opening quote before responding, concede only in exchange for something, accept at-or-below target, walk away after `max_rounds` if still above walk-away.

The model is instructed to emit a hidden `<STATE>{"offer_on_table": ..., "status": "..."}</STATE>` block after every reply. `parse_state()` extracts and strips that block via regex before the text reaches the client — the human never sees it.

**Full-prompt editability**: the client can send a `system_prompt` override on the lane payload (see `LaneRequest` in `main.py`). If present, it's used verbatim instead of `build_system_prompt(lane)` generating one. `POST /api/prompt/preview` exposes `build_system_prompt` so the client can show/seed an editable textarea with the generated text before a session starts.

### Session lifecycle (`server/main.py` + `server/lib/session_store.py`)
- `session_store.py`'s `create_session`/`get_session`/`save_session` are all **async**. When `MONGODB_URI` is set, sessions persist to a `sessions` collection (keyed by `_id` = session id); otherwise they fall back to an in-memory dict — fine for local dev, but the fallback is a dead end on Vercel (each serverless invocation can get a cold instance with an empty dict), so `MONGODB_URI` is required in production.
- `main.py` never mutates a session and expects the change to persist implicitly — every mutation (`session["messages"].append(...)`, `session["rounds"] += 1`, `session["status"] = ...`) is followed by an explicit `await save_session(session)` before the handler returns. If you add a new field that gets mutated mid-request, make sure a `save_session` call happens after it, or the write silently only lands in the in-memory fallback.
- `POST /api/session/start` creates a session and seeds it with the system prompt. It does **not** call the LLM — the AI is instructed to wait for the transporter's opening message.
- `POST /api/session/{id}/message` appends the human's message, calls the model via `call_model()` (`server/lib/llm.py`), parses out the `<STATE>` block, and updates session status/offer.
- A round-count safety net (`rounds >= max_rounds * 2`) forces `walked_away` even if the model ignores its own instructions.
- Langfuse tracing (`server/lib/langfuse_client.py`) wraps each LLM call when `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY` are set in `server/.env`; otherwise `get_langfuse()` returns `None` and every call site does `if langfuse:` to skip cleanly. Note: this pins `langfuse==2.53.9` for its explicit `.trace()`/`.generation()` API — a newer major version uses a different (OpenTelemetry-based) tracing API and will need `main.py`'s calls adjusted.

### Model routing (`server/lib/llm.py`)
No separate proxy process — `call_model()` calls the `litellm` Python package's `acompletion()` directly. Claude and GPT are fixed app-facing aliases in `MODEL_MAP` (`claude-negotiator`, `gpt-negotiator`) mapped to a specific provider model string; the client's `STATIC_MODELS` list in `App.jsx` must stay in sync with these two ids.

Gemini is different: any model string starting with `gemini/` passes straight through to litellm unchanged, so no code change is needed when Google ships a new model. The actual list of selectable Gemini models is fetched live — `GET /api/models/gemini` (`server/lib/gemini_models.py`) reads a bundled `config/gemini_models.json` snapshot if present, otherwise calls Google's List Models API directly (needs `GEMINI_API_KEY`), filters to models supporting `generateContent`, and returns ids already in the `gemini/<model-id>` shape `call_model()` expects. The client fetches this on mount and merges it into the model dropdown alongside `STATIC_MODELS`.

Claude is routed through **Vertex AI**, not the Anthropic API directly — `vertex_ai/claude-sonnet-4-6` with `vertex_project`/`vertex_location` from env vars. Auth is GCP Application Default Credentials locally (`gcloud auth application-default login`); on Vercel there's no persistent login session, so `call_model()` reads a full service-account key from `VERTEX_CREDENTIALS_JSON` and passes it to litellm as `vertex_credentials` instead. There is no `ANTHROPIC_API_KEY` anywhere in this project.

### Client state (`client/src/App.jsx`)
Single-file app. Setup form (lane presets or custom fields) → `startSession` → chat loop against `sendMessage` while `status === "negotiating"`. Presets come from `GET /api/lanes`, which returns full lane objects (rates included) — the "hide rates from the client" idea from an earlier version of this code no longer applies, since the human configuring the negotiation is expected to see/set the AI's parameters before playing the transporter role in the chat.

The system-prompt textarea auto-regenerates from the structured fields (debounced call to `/api/prompt/preview`) until the user edits it directly, at which point it stops overwriting their edits (`promptDirty` flag) until they click "Regenerate from fields."

### Vercel deployment (`vercel.json`, Services)
Deployed using Vercel's `services` config (not a single `api/index.py` function — that approach reliably deployed with zero Python dependencies installed, see below). `vercel.json` defines two services:

- `client` — `root: "client/"`, framework `vite`. Builds and serves the static frontend.
- `server` — `root: "server/"`, framework `fastapi`, `entrypoint: "main:app"`. Vercel builds this exactly like a standalone FastAPI project rooted at `server/`, so it installs `server/requirements.txt` directly and runs `main.py` with `server/` as its working root — matching local dev (`cd server && uvicorn main:app`) and satisfying `main.py`'s relative imports (`from lib.xxx import ...`) without any `sys.path` hack.

Top-level `rewrites` route `/api/*` to the `server` service (path passed through unchanged, so FastAPI's own `/api/...`-prefixed routes still match) and everything else to `client`. Per Vercel's services model, `installCommand`/`buildCommand`/`outputDirectory`/`framework` are **not** valid at the top level of `vercel.json` once `services` is used — set them per-service instead.

Python functions get no automatic tree-shaking, so `config/lanes.json` and `config/gemini_models.json` (read via `open()` rather than imported) are included in the `server` service's bundle automatically — no `includeFiles` override needed.

There used to be an `api/index.py` shim (manual `sys.path` insert + `from main import app`) plus a duplicate root-level `requirements.txt`. That setup deployed successfully but with **zero installed Python dependencies** — confirmed via Vercel Build Logs showing no Python install step at all, and a runtime `ModuleNotFoundError` on the very first third-party import in `main.py`. A custom top-level `installCommand` does **not** apply to Python functions under `api/` and can't be used to work around it (Vercel's own docs: "a different Install Command will be used depending on the language of the Vercel Function. You cannot customize this Install Command."). If Python deps ever fail to install again, check the deployment's **Build Logs** (not Runtime Logs) for the `server` service's install step before assuming it's a code issue.
