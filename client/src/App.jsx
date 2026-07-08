import { useState, useEffect, useRef } from "react";
import {
  fetchLanes,
  fetchGeminiModels,
  previewPrompt,
  startSession,
  sendMessage,
} from "./api";

const STATIC_MODELS = [
  // Disabled until Vertex AI credentials are set up server-side - see
  // README's Deploying to Vercel section.
  // { id: "claude-negotiator", label: "Claude" },
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

export default function App() {
  const [presets, setPresets] = useState([]);
  const [presetId, setPresetId] = useState("custom");
  const [form, setForm] = useState(EMPTY_FORM);
  const [model, setModel] = useState(STATIC_MODELS[0]?.id ?? "");
  const [geminiModels, setGeminiModels] = useState([]);
  const models = [
    // ...STATIC_MODELS,
    ...geminiModels.map((m) => ({ id: m.id, label: `Gemini - ${m.name}` })),
  ];
  const [promptDirty, setPromptDirty] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);

  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("idle");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Keep the editable system prompt in sync with the structured fields,
  // unless the user has hand-edited it - then leave their edits alone.
  useEffect(() => {
    if (sessionId || promptDirty) return;
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
    sessionId,
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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!input.trim() || !sessionId) return;
    const userMsg = input;
    setMessages((m) => [...m, { role: "user", text: userMsg }]);
    setInput("");
    setLoading(true);
    setError("");
    try {
      const data = await sendMessage(sessionId, userMsg);
      setMessages((m) => [...m, { role: "assistant", text: data.message }]);
      setStatus(data.status);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setSessionId(null);
    setMessages([]);
    setStatus("idle");
    setInput("");
    setError("");
  }

  return (
    <div className="app">
      <h1>Freight negotiation POC</h1>
      <p className="subtitle">
        You are playing the transporter. Send your opening quotation to start
        the negotiation.
      </p>

      {error && <div className="error">{error}</div>}

      {!sessionId && (
        <div className="setup">
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
            {loading ? "Starting..." : "Start negotiation"}
          </button>
        </div>
      )}

      {sessionId && (
        <>
          <div className={`status status-${status}`}>Status: {status}</div>
          <div className="chat">
            {messages.length === 0 && (
              <div className="chat-hint">
                Send your opening quotation below to start the negotiation.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                {m.text}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {status === "negotiating" ? (
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
            <button className="reset" onClick={handleReset}>
              Start a new negotiation
            </button>
          )}
        </>
      )}
    </div>
  );
}
