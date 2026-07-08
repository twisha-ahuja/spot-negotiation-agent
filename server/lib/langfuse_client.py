import os

_client = None


def get_langfuse():
    """
    Returns a Langfuse client if keys are configured, otherwise None so the
    rest of the app can just do `if langfuse:` and skip tracing cleanly.

    NOTE: Langfuse's Python SDK has changed its tracing API across major
    versions (explicit .trace()/.generation() calls in v2, an
    OpenTelemetry-based @observe()/start_span() style from v3 onward). This
    file uses the explicit trace()/generation() calls used in main.py - if
    you're on a newer SDK version and see an AttributeError, check
    https://langfuse.com/docs for the current tracing API and adjust
    main.py's calls to match (the shape of what gets logged stays the same).
    """
    global _client
    public_key = os.environ.get("LANGFUSE_PUBLIC_KEY")
    secret_key = os.environ.get("LANGFUSE_SECRET_KEY")
    if not public_key or not secret_key:
        return None

    if _client is None:
        from langfuse import Langfuse

        _client = Langfuse(
            public_key=public_key,
            secret_key=secret_key,
            host=os.environ.get("LANGFUSE_BASE_URL", "https://cloud.langfuse.com"),
        )
    return _client
