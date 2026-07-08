const BASE = "/api";

export async function fetchLanes() {
  const res = await fetch(`${BASE}/lanes`);
  if (!res.ok) throw new Error("Failed to load lanes");
  return res.json();
}

export async function fetchGeminiModels() {
  const res = await fetch(`${BASE}/models/gemini`);
  if (!res.ok) throw new Error("Failed to load Gemini models");
  return res.json();
}

export async function previewPrompt(lane) {
  const res = await fetch(`${BASE}/prompt/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lane),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Failed to preview prompt");
  return res.json();
}

export async function startSession(lane, model) {
  const res = await fetch(`${BASE}/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lane, model }),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Failed to start session");
  return res.json();
}

export async function sendMessage(sessionId, message) {
  const res = await fetch(`${BASE}/session/${sessionId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to send message");
  return res.json();
}
