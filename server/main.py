import json
from pathlib import Path
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from lib.gemini_models import list_gemini_models
from lib.langfuse_client import get_langfuse
from lib.llm import call_model
from lib.prompt import build_system_prompt, parse_state
from lib.session_store import create_session, get_session, save_session

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

with open(BASE_DIR / "config" / "lanes.json") as f:
    LANES = json.load(f)

app = FastAPI(title="Negotiation POC API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class LaneRequest(BaseModel):
    name: str
    currency: str
    target_rate: float
    walk_away_rate: float
    max_rounds: int
    extra_instructions: str | None = None
    system_prompt: str | None = None


class StartRequest(BaseModel):
    lane: LaneRequest
    model: str


class MessageRequest(BaseModel):
    message: str


@app.get("/api/lanes")
def list_lanes():
    return [{"id": lane_id, **lane} for lane_id, lane in LANES.items()]


@app.post("/api/prompt/preview")
def preview_prompt(req: LaneRequest):
    return {"system_prompt": build_system_prompt(req.dict())}


@app.get("/api/models/gemini")
async def gemini_models():
    try:
        return await list_gemini_models()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@app.post("/api/session/start")
async def start_session(req: StartRequest):
    lane = req.lane.dict()

    session = await create_session(lane, lane["name"], req.model)
    system_prompt = lane.get("system_prompt") or build_system_prompt(lane)
    session["messages"].append({"role": "system", "content": system_prompt})
    await save_session(session)

    # No LLM call here - the transporter sends the opening quotation via
    # /api/session/{id}/message, and the AI only responds after that.
    return {
        "sessionId": session["id"],
        "status": session["status"],
    }

@app.post("/api/session/{session_id}/message")
async def send_message(session_id: str, req: MessageRequest):
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["status"] != "negotiating":
        raise HTTPException(
            status_code=400, detail=f"Session already {session['status']}"
        )
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Empty message")

    session["messages"].append({"role": "user", "content": req.message})
    session["rounds"] += 1

    langfuse = get_langfuse()
    generation = None
    if langfuse:
        trace = langfuse.trace(
            name="negotiation-turn",
            session_id=session["id"],
            metadata={
                "laneId": session["laneId"],
                "model": session["model"],
                "round": session["rounds"],
            },
        )
        generation = trace.generation(
            name="llm-call", model=session["model"], input=session["messages"]
        )

    # try:
    raw = await call_model(session["model"], session["messages"])
    # except Exception as e:
    #     raise HTTPException(status_code=500, detail=str(e))

    if generation:
        generation.end(output=raw)

    clean_text, state = parse_state(raw)
    session["messages"].append({"role": "assistant", "content": raw})
    session["status"] = state["status"]
    session["offer_on_table"] = state["offer_on_table"]

    # Safety net in case a model ignores max_rounds in the prompt.
    if (
        session["rounds"] >= session["lane"]["max_rounds"] * 2
        and session["status"] == "negotiating"
    ):
        session["status"] = "walked_away"

    await save_session(session)

    if langfuse:
        langfuse.flush()

    return {
        "message": clean_text,
        "status": session["status"],
        "offerOnTable": session["offer_on_table"],
        "round": session["rounds"],
    }


if __name__ == "__main__":

    uvicorn.run("main:app", host="0.0.0.0", port=3001, reload=True)
