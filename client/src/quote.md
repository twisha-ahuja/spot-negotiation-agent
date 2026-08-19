# `POST /spot/transporter_quote`
Called when a transporter quotes (or re-quotes) on a playground spot enquiry — triggers the negotiation agent to evaluate and, if applicable, counter-offer. Thin wrapper around `POST /negotiation/start` (`routes/negotiation.start_negotiation`) — same validation, RBAC, guardrails, and background-task behavior; see `docs/negotiation_start_api.md` for the full decision tree. This route exists as a distinct path/payload shape for the playground's transporter-quote flow, not a different negotiation engine.


## Request


```
POST /spot/transporter_quote
Content-Type: application/json
```


```json
{
  "truck_enquiry_id": "string",
  "transporter_id": "string",
  "rate": 12345.0
}
```


| Field | Type | Required | Description |
|---|---|---|---|
| `truck_enquiry_id` | string | yes | Spot/enquiry identifier. |
| `transporter_id` | string | yes | Transporter identifier. |
| `rate` | float | yes | Rate just quoted by the transporter. Mapped to `transporter_rate` internally. |


⚠️ **Not schema-validated on the way in.** The body is read manually via `payload.get(...)` (no Pydantic body model on this route), then repackaged into a `NegotiationStartRequest` inside a `try` block. A missing/wrong-typed field fails Pydantic validation *there*, is caught by a blanket `except Exception`, logged server-side (`logging.exception`), and swallowed — see **Response** below.


## Response


### `200 OK` — always
```json
0
```
This route **always returns `200` with the literal body `0`**, regardless of whether the negotiation agent was actually triggered, blocked, disabled, or failed validation entirely. There is no status discriminator, no error surfaced to the caller, and no request body validation — every outcome (`accepted`, `blocked`, `disabled`, `duplicate`, or an exception) is only visible in server logs, never in the HTTP response.


**Practical implication for the frontend:** this endpoint cannot tell you whether the negotiation actually started. If you need to know the outcome, call `GET /negotiation/{truck_enquiry_id}/status` afterward (see `docs/negotiation_start_api.md`'s **Async behavior** section) rather than relying on this response.
