export async function getSessionTraces(sessionId) {
  const pk = import.meta.env.VITE_LANGFUSE_PUBLIC_KEY;
  const sk = import.meta.env.VITE_LANGFUSE_SECRET_KEY;

  if (!pk || !sk) {
    console.warn("Langfuse API keys missing in environment variables (.env). Please add VITE_LANGFUSE_PUBLIC_KEY and VITE_LANGFUSE_SECRET_KEY.");
  }

  const authHeader = btoa(`${pk}:${sk}`);

  const res = await fetch(`https://hipaa.cloud.langfuse.com/api/public/traces?sessionId=${sessionId}`, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${authHeader}`,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    throw new Error(`Langfuse traces fetch failed: ${res.statusText}`);
  }

  const json = await res.json();
  return json.data; // returns array of traces
}

export async function getTraceData(traceId) {
  const pk = import.meta.env.VITE_LANGFUSE_PUBLIC_KEY;
  const sk = import.meta.env.VITE_LANGFUSE_SECRET_KEY;
  const authHeader = btoa(`${pk}:${sk}`);

  const res = await fetch(`https://hipaa.cloud.langfuse.com/api/public/traces/${traceId}`, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${authHeader}`,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Status ${res.status}: ${errorText || res.statusText || "Unknown"}`);
  }

  return await res.json();
}