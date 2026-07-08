

# Freight negotiation POC

A human plays the transporter and negotiates a freight rate, in chat, against
an AI procurement agent (Claude, GPT, or Gemini - swappable per session). The
AI has a hardcoded target rate and walk-away rate that are never shown to the
human. Every call is optionally traced to Langfuse.

Two pieces, run in two terminals:

```
server/  FastAPI - negotiation orchestrator; holds the rates + prompt, and
         calls Claude/GPT/Gemini directly via the litellm Python SDK (Python)
client/  React (Vite) - the chat UI (Node.js)
```

`proxy/` (a standalone LiteLLM proxy) is no longer used by the app - model
routing now happens inside `server/lib/llm.py` via the `litellm` package
directly, since a separate long-running proxy process doesn't fit a
serverless deployment. The folder is left in the repo in case you want to
run a real LiteLLM proxy for something else later.

## Prerequisites

- Node.js >= 18 (for the client)
- Python >= 3.9 (for the backend)
- Claude runs via Vertex AI, so you need a GCP project with the Vertex AI API
  enabled and the Claude models granted, plus the `gcloud` CLI. No Anthropic
  API key is used.
- API keys for the other providers you want to test: OpenAI, Google (Gemini)
- A MongoDB connection string if you want sessions to survive a server
  restart (required for the Vercel deployment - see below). Without one,
  sessions are just kept in memory, which is fine for local dev.
- Optional: a Langfuse account (cloud.langfuse.com) or self-hosted instance, for tracing

## 1. Backend (FastAPI)

```bash
cd server
cp .env.example .env
# edit .env: set VERTEX_PROJECT_ID/VERTEX_LOCATION, GEMINI_API_KEY (needed
# both for actual Gemini calls and to populate the model dropdown),
# OPENAI_API_KEY, and - if you want sessions to persist - MONGODB_URI.
# Leave the Langfuse lines blank to skip tracing.

gcloud auth application-default login   # one-time, for local Vertex auth

python -m venv venv
source venv/bin/activate        # on Windows: venv\Scripts\activate
pip install -r requirements.txt

uvicorn main:app --reload --port 3001
```

Server runs on http://localhost:3001. Interactive API docs are auto-generated
at http://localhost:3001/docs, handy for poking the endpoints directly while
you're iterating. It reads lane configs (rates) from `config/lanes.json` -
edit that file to add your own lanes.

## 2. Frontend (React)

In a second terminal:

```bash
cd client
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). Vite's dev server
proxies `/api/*` to http://localhost:3001 (see `client/vite.config.js`) -
no env var needed locally.

## Using it

1. Pick a lane and a model, click "Start negotiation."
2. The AI sends its opening offer.
3. Reply as the transporter - counter-offer, push back, ask for terms, whatever
   you'd actually say. Keep going until the AI accepts or walks away.
4. Click "Start a new negotiation" to try a different lane or model.

## Where to tweak things

- **Rates and lanes** - `server/config/lanes.json`
- **Negotiation behavior / prompt** - `server/lib/prompt.py`. This is the
  file to iterate on if the AI concedes too fast, folds under pressure, or
  leaks its target rate.
- **Models available** - Claude and GPT are fixed aliases in `server/lib/llm.py`'s
  `MODEL_MAP`, mirrored in `client/src/App.jsx`'s `STATIC_MODELS` list (keep
  the `id` values in sync). Gemini is dynamic - any `gemini/<model-id>`
  passes straight through in `llm.py`, and the dropdown is populated live
  from `GET /api/models/gemini` (`server/lib/gemini_models.py`, needs
  `GEMINI_API_KEY` in `server/.env`).
- **Session storage** - `server/lib/session_store.py` falls back to an
  in-memory dict when `MONGODB_URI` isn't set (fine for local dev), and
  persists to MongoDB when it is (required once you're running on Vercel -
  see below).

## Deploying to Vercel

The whole app (client + backend) deploys as a single Vercel project using
[Vercel Services](https://vercel.com/docs/services), defined in `vercel.json`:

- `client` service (`root: "client/"`) builds and serves the static frontend.
- `server` service (`root: "server/"`, `entrypoint: "main:app"`) is built like
  a standalone FastAPI project rooted at `server/` - Vercel installs
  `server/requirements.txt` directly and runs `main.py` with `server/` as its
  working root, matching local dev (`cd server && uvicorn main:app`).
- A top-level rewrite sends `/api/*` to the `server` service unchanged, so
  FastAPI's own routes (which already start with `/api/...`) match as-is;
  everything else goes to `client`.
- `config/lanes.json` and `config/gemini_models.json` (read via `open()`
  rather than imported) are included automatically - Python services get no
  import-based tree-shaking.
- Because serverless functions share no memory between invocations, sessions
  **must** be backed by MongoDB in production - set `MONGODB_URI` in the
  Vercel project's environment variables, or every negotiation will 404 on
  the second request.
- Vertex AI auth can't use `gcloud auth application-default login` in a
  serverless environment (no persistent filesystem, no login session). Create
  a GCP service account with Vertex AI access, download its JSON key, and set
  the **entire JSON content** as the `VERTEX_CREDENTIALS_JSON` env var in
  Vercel (`server/lib/llm.py` passes it to litellm as `vertex_credentials`).

**Steps:**

```bash
npm install -g vercel   # if you don't have the CLI
vercel login
vercel                  # links/creates the project, deploys a preview
```

Then in the Vercel dashboard (Project → Settings → Environment Variables), set:

| Variable | Value |
| --- | --- |
| `VERTEX_PROJECT_ID` | your GCP project id |
| `VERTEX_LOCATION` | e.g. `us-east5` |
| `VERTEX_CREDENTIALS_JSON` | full JSON key of a service account with Vertex AI access |
| `OPENAI_API_KEY` | your OpenAI key |
| `GEMINI_API_KEY` | your Gemini key |
| `MONGODB_URI` | connection string for session persistence |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_BASE_URL` | optional, for tracing |

Redeploy (`vercel --prod`) after setting env vars so the functions pick them up.

## Viewing traces in Langfuse

If you filled in the Langfuse keys in `server/.env`, every session and every
turn shows up in your Langfuse project as a trace, tagged with the lane,
model, and round number - useful for comparing how Claude vs GPT vs Gemini
handle the same lane.

Note: Langfuse's Python SDK API has shifted across major versions (explicit
`trace()`/`generation()` calls vs. a newer OpenTelemetry-based style). This
project pins `langfuse==2.53.9` to match the calls used in `server/main.py`.
If you upgrade the package and hit an `AttributeError` on tracing calls,
check https://langfuse.com/docs for the current API and adjust `main.py`
accordingly - the actual data being logged doesn't change, just the method
names.
