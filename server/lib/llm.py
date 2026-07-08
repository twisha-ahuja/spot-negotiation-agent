from __future__ import annotations

import json
import os

import litellm

# Replaces the standalone LiteLLM proxy (proxy/litellm_config.yaml) - calling
# the litellm SDK directly means there's no separate long-running proxy
# process to deploy, which doesn't fit Vercel's serverless model anyway.
MODEL_MAP = {
    # Disabled until Vertex AI credentials are set up (either
    # `gcloud auth application-default login` or VERTEX_CREDENTIALS_JSON) -
    # see README's Deploying to Vercel section.
    "claude-negotiator": {
        "model": "vertex_ai/claude-sonnet-4-6",
        "vertex_project": os.environ.get("VERTEX_PROJECT_ID"),
        "vertex_location": os.environ.get("VERTEX_LOCATION"),
    },
    # "gpt-negotiator": {
    #     "model": "openai/gpt-4.1",
    # },
}


def _model_params(model: str) -> dict:
    if model in MODEL_MAP:
        return dict(MODEL_MAP[model])
    if model.startswith("gemini/"):
        # Any Gemini model id from GET /api/models/gemini passes straight
        # through - matches the old proxy's "gemini/*" wildcard route.
        return {"model": model}
    raise ValueError(f"Unknown model: {model}")


def _vertex_credentials() -> dict | None:
    # Vercel's serverless functions have no `gcloud auth application-default
    # login` session and no filesystem to point GOOGLE_APPLICATION_CREDENTIALS
    # at, so Vertex auth there comes from a service account key pasted whole
    # into an env var. Locally, ADC handles it and this stays unset.
    raw = os.environ.get("VERTEX_CREDENTIALS_JSON")
    if raw:
        json.loads(raw)  # validate it's parseable JSON before handing it off
    return raw


async def call_model(model: str, messages: list[dict]) -> str:
    params = _model_params(model)

    if params["model"].startswith("vertex_ai/"):
        credentials = _vertex_credentials()
        if credentials:
            params["vertex_credentials"] = credentials

    try:
        response = await litellm.acompletion(
            messages=messages, temperature=0.7, **params
        )
    except Exception as e:
        raise RuntimeError(f"LLM call failed for {model}: {e}") from e

    return response.choices[0].message.content
