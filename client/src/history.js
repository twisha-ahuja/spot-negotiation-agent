// Client-only run history. There's no durable backend store for this (session_store
// falls back to an in-memory dict per serverless invocation), so past runs live in
// localStorage instead - good enough for a single-user prompt-analysis playground.
const STORAGE_KEY = "negotiation_history";
const MAX_ENTRIES = 30;

export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRun(entry) {
  const history = [entry, ...loadHistory()].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Storage full or unavailable - history is a convenience, not critical.
  }
  return history;
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
  return [];
}
