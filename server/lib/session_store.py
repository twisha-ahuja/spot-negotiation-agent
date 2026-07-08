import os
import uuid

# Serverless functions share no memory between invocations, so the plain
# in-memory dict this used to be doesn't survive across requests on Vercel.
# When MONGODB_URI is set, sessions are persisted to MongoDB instead;
# without it (local dev), this falls back to the in-memory dict exactly
# as before.
_memory_sessions: dict[str, dict] = {}
_collection = None
_mongo_checked = False


def _get_collection():
    global _collection, _mongo_checked
    if not _mongo_checked:
        _mongo_checked = True
        uri = os.environ.get("MONGODB_URI")
        if uri:
            from motor.motor_asyncio import AsyncIOMotorClient

            client = AsyncIOMotorClient(uri)
            # Default to whatever database the connection string itself
            # points to (its path segment) rather than assuming a name -
            # the Mongo user is often only authorized on that one database.
            db_name = os.environ.get("MONGODB_DB")
            db = client[db_name] if db_name else client.get_default_database()
            _collection = db["PocSession"]
    return _collection


async def create_session(lane: dict, lane_id: str, model: str) -> dict:
    session_id = str(uuid.uuid4())
    session = {
        "id": session_id,
        "laneId": lane_id,
        "model": model,
        "lane": lane,
        "messages": [],
        "rounds": 0,
        "status": "negotiating",
        "offer_on_table": None,
    }
    await save_session(session)
    return session


async def get_session(session_id: str) -> dict | None:
    collection = _get_collection()
    if collection is not None:
        doc = await collection.find_one({"_id": session_id})
        if doc:
            doc.pop("_id", None)
        return doc
    return _memory_sessions.get(session_id)


async def save_session(session: dict) -> None:
    collection = _get_collection()
    if collection is not None:
        await collection.replace_one(
            {"_id": session["id"]}, {**session, "_id": session["id"]}, upsert=True
        )
    else:
        _memory_sessions[session["id"]] = session
