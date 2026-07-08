import { useState, useEffect, useRef } from "react";
import {
  fetchLanes,
  fetchGeminiModels,
  previewPrompt,
  startSession,
  sendMessage,
} from "./api";
import { loadHistory, saveRun, clearHistory } from "./history";

const STATIC_MODELS = [
  // Disabled until Vertex AI credentials are set up server-side - see
  // README's Deploying to Vercel section.
  { id: "claude-negotiator", label: "Claude - Sonnet 4.6" },
  // { id: "gpt-negotiator", label: "GPT" },
];

const EMPTY_FORM = {
  name: "",
  currency: "INR",
  target_rate: "",
  walk_away_rate: "",
  max_rounds: 6,
  extra_instructions: "",
  system_prompt: "",
};

function exportTranscript(messages, meta) {
  const header =
    `Lane: ${meta.laneName}\n` +
    `Model: ${meta.model}\n` +
    `Status: ${meta.status}\n` +
    `Rounds: ${meta.rounds}\n` +
    `Final offer: ${meta.finalOffer ?? "—"} ${meta.currency || ""}\n\n`;
  const body = messages
    .map((m) => `${m.role === "user" ? "Transporter" : "Agent"}: ${m.text}`)
    .join("\n\n");
  const blob = new Blob([header + body], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `negotiation-${(meta.laneName || "session").replace(/\s+/g, "_")}-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// 0 = right at target (best case for the buyer), 100 = at/past walk-away.
// Assumes target_rate < walk_away_rate, which holds for every lane preset.
function offerProgressPct(offer, target, walkAway) {
  const o = Number(offer);
  const t = Number(target);
  const w = Number(walkAway);
  if (offer == null || !Number.isFinite(o) || !Number.isFinite(t) || !Number.isFinite(w) || t === w) {
    return null;
  }
  const clamped = Math.min(Math.max(o, t), w);
  return Math.round(((clamped - t) / (w - t)) * 100);
}

export default function App() {
  const [presets, setPresets] = useState([]);
  const [presetId, setPresetId] = useState("custom");
  const [form, setForm] = useState(EMPTY_FORM);
  const [model, setModel] = useState(STATIC_MODELS[0]?.id ?? "");
  const [geminiModels, setGeminiModels] = useState([]);
  const models = [
    ...STATIC_MODELS,
    ...geminiModels.map((m) => ({ id: m.id, label: `Gemini - ${m.name}` })),
  ];
  const [promptDirty, setPromptDirty] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);

  // mode drives the right-hand pane: "idle" (nothing run yet), "live" (an
  // active or just-finished session), "history" (read-only past run).
  const [mode, setMode] = useState("idle");
  const [sessionId, setSessionId] = useState(null);
  const [activeRunConfig, setActiveRunConfig] = useState(null);
  const [viewingEntry, setViewingEntry] = useState(null);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("idle");
  const [round, setRound] = useState(0);
  const [offerOnTable, setOfferOnTable] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState(() => loadHistory());
  const chatRef = useRef(null);

  useEffect(() => {
    fetchLanes()
      .then(setPresets)
      .catch((err) => setError(err.message));
    fetchGeminiModels()
      .then(setGeminiModels)
      .catch((err) => setError(err.message));
  }, []);

  // Pick a default once the model list arrives - STATIC_MODELS may be empty,
  // so `model` can otherwise stay "" until the user opens the dropdown.
  useEffect(() => {
    if (!model && models.length > 0) {
      setModel(models[0].id);
    }
  }, [models, model]);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Keep the editable system prompt in sync with the structured fields,
  // unless the user has hand-edited it (or loaded a past run) - then leave
  // it alone until they explicitly ask to regenerate.
  useEffect(() => {
    if (promptDirty) return;
    if (!isFormValid()) return;
    const handle = setTimeout(() => {
      setPromptLoading(true);
      previewPrompt({
        name: form.name.trim(),
        currency: form.currency.trim(),
        target_rate: Number(form.target_rate),
        walk_away_rate: Number(form.walk_away_rate),
        max_rounds: Number(form.max_rounds),
        extra_instructions: form.extra_instructions.trim() || null,
      })
        .then((data) =>
          setForm((f) => ({ ...f, system_prompt: data.system_prompt }))
        )
        .catch((err) => setError(err.message))
        .finally(() => setPromptLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [
    form.name,
    form.currency,
    form.target_rate,
    form.walk_away_rate,
    form.max_rounds,
    form.extra_instructions,
    promptDirty,
  ]);

  function handlePresetChange(id) {
    setPresetId(id);
    setPromptDirty(false);
    if (id === "custom") {
      setForm(EMPTY_FORM);
      return;
    }
    const preset = presets.find((p) => p.id === id);
    if (preset) {
      setForm({
        name: preset.name,
        currency: preset.currency,
        target_rate: preset.target_rate,
        walk_away_rate: preset.walk_away_rate,
        max_rounds: preset.max_rounds,
        extra_instructions: preset.extra_instructions || "",
        system_prompt: "",
      });
    }
  }

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function updatePrompt(value) {
    setPromptDirty(true);
    setForm((f) => ({ ...f, system_prompt: value }));
  }

  function isFormValid() {
    return (
      form.name.trim() &&
      form.currency.trim() &&
      form.target_rate !== "" &&
      form.walk_away_rate !== "" &&
      form.max_rounds !== ""
    );
  }

  async function handleStart() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setLoading(true);
    setError("");
    try {
      const lane = {
        name: form.name.trim(),
        currency: form.currency.trim(),
        target_rate: Number(form.target_rate),
        walk_away_rate: Number(form.walk_away_rate),
        max_rounds: Number(form.max_rounds),
        extra_instructions: form.extra_instructions.trim() || null,
        system_prompt: form.system_prompt.trim() || null,
      };
      const data = await startSession(lane, model);
      setSessionId(data.sessionId);
      setStatus(data.status);
      setMessages([]); // AI does not open - waiting for the transporter's first message
      setRound(0);
      setOfferOnTable(null);
      setViewingEntry(null);
      setMode("live");
      setActiveRunConfig({ lane, model });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!input.trim() || !sessionId) return;
    const userMsg = input;
    const afterUser = [...messages, { role: "user", text: userMsg }];
    setMessages(afterUser);
    setInput("");
    setLoading(true);
    setError("");
    try {
      const data = await sendMessage(sessionId, userMsg);
      const finalMessages = [...afterUser, { role: "assistant", text: data.message }];
      setMessages(finalMessages);
      setStatus(data.status);
      setRound(data.round);
      setOfferOnTable(data.offerOnTable);

      if (data.status !== "negotiating" && activeRunConfig) {
        const entry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          laneName: activeRunConfig.lane.name,
          currency: activeRunConfig.lane.currency,
          target_rate: activeRunConfig.lane.target_rate,
          walk_away_rate: activeRunConfig.lane.walk_away_rate,
          max_rounds: activeRunConfig.lane.max_rounds,
          extra_instructions: activeRunConfig.lane.extra_instructions,
          system_prompt: activeRunConfig.lane.system_prompt,
          model: activeRunConfig.model,
          status: data.status,
          rounds: data.round,
          finalOffer: data.offerOnTable,
          transcript: finalMessages,
        };
        setHistory(saveRun(entry));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleClosePane() {
    setMode("idle");
    setSessionId(null);
    setViewingEntry(null);
    setMessages([]);
    setStatus("idle");
    setRound(0);
    setOfferOnTable(null);
    setInput("");
    setError("");
  }

  function loadHistoryEntry(entry) {
    setPresetId("custom");
    setForm({
      name: entry.laneName,
      currency: entry.currency,
      target_rate: entry.target_rate,
      walk_away_rate: entry.walk_away_rate,
      max_rounds: entry.max_rounds,
      extra_instructions: entry.extra_instructions || "",
      system_prompt: entry.system_prompt || "",
    });
    setPromptDirty(true); // keep the loaded prompt as-is until "Regenerate" is clicked
    if (entry.model) setModel(entry.model);
    setSessionId(null);
    setMessages(entry.transcript);
    setStatus(entry.status);
    setRound(entry.rounds);
    setOfferOnTable(entry.finalOffer);
    setViewingEntry(entry);
    setMode("history");
    setError("");
  }

  function handleClearHistory() {
    setHistory(clearHistory());
  }

  const progressPct = offerProgressPct(offerOnTable, form.target_rate, form.walk_away_rate);
  const ended = status !== "negotiating" && status !== "idle";

  return (
    <div className="app">
      <h1>Freight negotiation POC</h1>
      <p className="subtitle">
        You are playing the transporter. Send your opening quotation to start
        the negotiation.
      </p>

      {error && <div className="error">{error}</div>}

      <div className="app-shell">
        <div className="pane prompt-pane">
          <h2>Prompt &amp; lane</h2>
          <label>
            Load a preset (optional, still editable)
            <select
              value={presetId}
              onChange={(e) => handlePresetChange(e.target.value)}
            >
              <option value="custom">Custom</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Lane name
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g. Mumbai to Delhi, 20ft container"
            />
          </label>

          <div className="form-row">
            <label>
              Currency
              <input
                type="text"
                value={form.currency}
                onChange={(e) => updateField("currency", e.target.value)}
              />
            </label>
            <label>
              Target rate
              <input
                type="number"
                value={form.target_rate}
                onChange={(e) => updateField("target_rate", e.target.value)}
                placeholder="45000"
              />
            </label>
            <label>
              Walk-away rate
              <input
                type="number"
                value={form.walk_away_rate}
                onChange={(e) => updateField("walk_away_rate", e.target.value)}
                placeholder="52000"
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Max rounds
              <input
                type="number"
                value={form.max_rounds}
                onChange={(e) => updateField("max_rounds", e.target.value)}
              />
            </label>
            <label>
              Model
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Extra negotiation instructions (optional)
            <textarea
              rows={3}
              value={form.extra_instructions}
              onChange={(e) => updateField("extra_instructions", e.target.value)}
              placeholder="e.g. Prioritize payment terms over price, insist on GPS tracking..."
            />
          </label>

          <label>
            <div className="prompt-label-row">
              <span>
                System prompt {promptLoading && "(generating...)"}
              </span>
              <button
                type="button"
                className="regenerate"
                onClick={() => {
                  setPromptDirty(false);
                }}
                disabled={!isFormValid() || promptLoading}
              >
                Regenerate from fields
              </button>
            </div>
            <textarea
              className="prompt-editor"
              rows={16}
              value={form.system_prompt}
              onChange={(e) => updatePrompt(e.target.value)}
              placeholder="Fill in the fields above to generate a starting prompt, then edit it directly."
            />
          </label>

          <button onClick={handleStart} disabled={loading || !isFormValid() || !model}>
            {loading ? "Starting..." : mode === "idle" ? "Run negotiation" : "Run again"}
          </button>

          <div className="history">
            <div className="history-header">
              <h3>History ({history.length})</h3>
              {history.length > 0 && (
                <button type="button" className="link-button" onClick={handleClearHistory}>
                  Clear
                </button>
              )}
            </div>
            {history.length === 0 && (
              <p className="history-empty">Past runs (stored in this browser) will show up here.</p>
            )}
            <ul className="history-list">
              {history.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={`history-item ${viewingEntry?.id === entry.id ? "active" : ""}`}
                    onClick={() => loadHistoryEntry(entry)}
                  >
                    <span className={`status-dot status-${entry.status}`} />
                    <span className="history-item-main">
                      <span className="history-item-name">{entry.laneName}</span>
                      <span className="history-item-meta">
                        {entry.model} · round {entry.rounds} · {entry.finalOffer ?? "—"} {entry.currency}
                      </span>
                    </span>
                    <span className="history-item-time">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pane negotiation-pane">
          <div className="pane-header">
            <h2>Negotiation</h2>
            {mode !== "idle" && (
              <span className={`status status-${status}`}>Status: {status}</span>
            )}
          </div>

          {mode === "idle" && (
            <div className="empty-state">
              Configure the prompt on the left and click "Run negotiation" to start.
              Past runs stay in the History list so you can revisit or rerun them.
            </div>
          )}

          {mode === "history" && viewingEntry && (
            <div className="history-banner">
              Viewing a past run from {new Date(viewingEntry.timestamp).toLocaleString()} - read-only.
              <button type="button" className="link-button" onClick={handleClosePane}>
                Close
              </button>
            </div>
          )}

          {mode !== "idle" && (
            <>
              <div className="run-meta">
                <span>Round {round} / {form.max_rounds || "?"}</span>
                <span>
                  Offer on table: {offerOnTable != null ? `${offerOnTable} ${form.currency}` : "—"}
                </span>
                <span>Target: {form.target_rate} {form.currency}</span>
                <span>Walk-away: {form.walk_away_rate} {form.currency}</span>
              </div>
              {progressPct != null && (
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${Math.min(Math.max(progressPct, 0), 100)}%` }} />
                </div>
              )}

              <div className="chat" ref={chatRef}>
                {messages.length === 0 && mode === "live" && (
                  <div className="chat-hint">
                    Send your opening quotation below to start the negotiation.
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`bubble ${m.role}`}>
                    {m.text}
                  </div>
                ))}
              </div>

              {mode === "live" && status === "negotiating" ? (
                <div className="composer">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Send your quotation as the transporter..."
                    disabled={loading}
                  />
                  <button onClick={handleSend} disabled={loading}>
                    Send
                  </button>
                </div>
              ) : (
                (mode === "history" || ended) && (
                  <div className="run-actions">
                    <button
                      type="button"
                      onClick={() =>
                        exportTranscript(messages, {
                          laneName: form.name,
                          model,
                          status,
                          rounds: round,
                          finalOffer: offerOnTable,
                          currency: form.currency,
                        })
                      }
                    >
                      Export transcript
                    </button>
                    {mode === "live" && (
                      <button type="button" className="reset" onClick={handleClosePane}>
                        New negotiation
                      </button>
                    )}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
