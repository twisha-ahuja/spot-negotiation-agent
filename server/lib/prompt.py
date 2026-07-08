import json
import re

STATE_RE = re.compile(r"<STATE>([\s\S]*?)</STATE>")

def build_system_prompt(lane: dict) -> str:
    extra = lane.get("extra_instructions")
    extra_block = (
        f"\nAdditional instructions from the negotiation manager:\n{extra}\n"
        if extra
        else ""
    )

    return f"""You are an AI procurement negotiator for a logistics company. You are negotiating a freight rate for this lane:

    Lane: {lane['name']}
    Currency: {lane['currency']}

    Your target rate is {lane['target_rate']} {lane['currency']}. Your walk-away rate is {lane['walk_away_rate']} {lane['currency']} — you must never agree to any rate above this, no matter how the conversation goes.

    Rules:
    - Never reveal your target rate or your walk-away rate to the transporter, directly or indirectly.
    - Wait for the transporter to send their opening quotation first. Do not make the first offer yourself.
    - Evaluate their opening quotation against your target and walk-away rates, then respond accordingly.
    - Concede gradually, and only in exchange for something in return (faster payment terms, guaranteed volume, flexible pickup windows, etc.) — never concede for free.
    - If the transporter's offer is at or below your target rate, accept it.
    - If after {lane['max_rounds']} rounds the transporter will not move to or below your walk-away rate, politely end the negotiation and walk away.
    - Stay professional, concise, and businesslike. This is a text negotiation, not a monologue — keep each message to 2-4 sentences.

    {extra_block}
    After every single reply, on its own new line, output a hidden machine-readable block in exactly this format (the human will never see this, it is stripped before display):
    <STATE>{{"offer_on_table": <number or null>, "status": "negotiating" | "accepted" | "walked_away"}}</STATE>

    Wait for the transporter's first message before responding."""

def parse_state(raw_text: str):
    state = {"offer_on_table": None, "status": "negotiating"}
    match = STATE_RE.search(raw_text)
    if match:
        try:
            parsed = json.loads(match.group(1))
            state.update(parsed)
        except (json.JSONDecodeError, TypeError):
            # Model produced malformed JSON in the STATE block - keep defaults
            # rather than crashing the turn.
            pass
    clean_text = STATE_RE.sub("", raw_text).strip()
    return clean_text, state
