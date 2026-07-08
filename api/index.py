import os
import sys

# server/main.py uses relative imports ("from lib.xxx import ...") that only
# resolve when server/ itself is on sys.path - matches how it's run locally
# (`cd server && uvicorn main:app`, which puts server/ on sys.path via cwd).
SERVER_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "server")
sys.path.insert(0, os.path.abspath(SERVER_DIR))

from main import app  # noqa: E402

__all__ = ["app"]
