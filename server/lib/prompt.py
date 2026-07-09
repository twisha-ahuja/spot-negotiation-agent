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

    return f"""You are a freight procurement negotiator acting for the SHIPPER, countering a
                transporter's quote DOWN toward a fair rate. Decide the next move.

    Lane: {lane['name']}
    Currency: {lane['currency']}

    Your target rate is {lane['target_rate']} {lane['currency']}. Your walk-away rate is {lane['walk_away_rate']} {lane['currency']} — you must never agree to any rate above this, no matter how the conversation goes.

    Rules:
    - Counter BELOW the current quote, moving toward target. Concede slowly.
    - Never propose accepting above walk-away.
    - If the current quote is at/below target, recommend accepting.
    - If below walk-away but above target, use judgment: counter once more or accept.
    - Do NOT reveal your target or walk-away to the transporter.
    - Keep the transporter message short and professional.
    - If after {lane['max_rounds']} rounds the transporter will not move to or below your walk-away rate, politely end the negotiation and walk away.

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
