import json
import os
from pathlib import Path

import httpx

GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models"
# Relative to this file rather than cwd - cwd varies between local dev
# (server/) and the Vercel function (repo root), and a relative "config/..."
# path would silently fail to find the cache there.
GEMINI_MODELS_CACHE = Path(__file__).resolve().parent.parent / "config" / "gemini_models.json"


async def list_gemini_models() -> list[dict]:
    """
    Fetches the list of Gemini models, filtered to those that support chat
    (generateContent). Returns litellm-ready model ids in the
    "gemini/<model-id>" form call_model() expects. Prefers a bundled cache
    (config/gemini_models.json) over hitting Google's API on every request;
    falls back to the live API if the cache is missing.
    """
    gemini_models = (
        json.loads(GEMINI_MODELS_CACHE.read_text())
        if GEMINI_MODELS_CACHE.exists()
        else []
    )
    if gemini_models:
        return [
            {
                "id": f"gemini/{m['name'].removeprefix('models/')}",
                "name": m.get("displayName", m["name"]),
            }
            for m in gemini_models
        ]
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return []

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(GEMINI_MODELS_URL, params={"key": api_key})

    if res.status_code != 200:
        raise RuntimeError(f"Gemini models list error ({res.status_code}): {res.text}")

    models = res.json().get("models", [])
    chat_models = [
        m for m in models if "generateContent" in m.get("supportedGenerationMethods", [])
    ]

    return [
        {
            "id": f"gemini/{m['name'].removeprefix('models/')}",
            "name": m.get("displayName", m["name"]),
        }
        for m in chat_models
    ]
