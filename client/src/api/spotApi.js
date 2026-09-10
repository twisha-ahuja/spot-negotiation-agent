import { AGENT_API_BASE } from './urls';

/**
 * Creates a brand new Playground Spot Enquiry.
 * This triggers the backend to generate a scenario instance, returning the resulting `truck_enquiry_id`.
 */
export async function createPlaygroundSpot(payload, companyId, domain) {
  try {
    const res = await fetch(`${AGENT_API_BASE}/spot/create?company_id=${companyId}&domain=${domain}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Failed to create spot: ${res.statusText}`);
    }

    return await res.json();
  } catch (err) {
    throw err;
  }
}

/**
 * Applies the per-spot model, prompt section overlay, and negotiation mode.
 */
export async function configurePlaygroundSpot(truckEnquiryId, model, negotiationMode, sections = []) {
  const res = await fetch(`${AGENT_API_BASE}/spot/${truckEnquiryId}/configure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      negotiation_mode: negotiationMode,
      sections
    })
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Failed to configure spot: ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Fetches the global list of previously initialized AI spot simulations directly handling history.
 */
export async function getSimulations() {
  try {
    const res = await fetch(`${AGENT_API_BASE}/spot/list`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch simulations: ${res.statusText}`);
    }

    const data = await res.json();
    return data.simulations || [];
  } catch (err) {
    console.error("Simulation list fetch failed:", err);
    return [];
  }
}

/**
 * Fetches the exact details and configuration history of a given Spot Enquiry.
 * Passing the Enquiry ID safely recovers all original nested configurations like Location, Model, and Rates natively.
 */
export async function getPlaygroundSpotDetails(truckEnquiryId) {
  try {
    const url = new URL(`${AGENT_API_BASE}/spot/get`);
    url.searchParams.append('truck_enquiry_id', truckEnquiryId);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch spot details: ${res.statusText}`);
    }

    return await res.json();
  } catch (err) {
    throw err;
  }
}

/**
 * Connects to the backend target rate calculation engine asynchronously.
 * Calculates Fair, Target, and Walkaway rates based autonomously on scenario metadata.
 */
export async function getCalculatedRates(truckEnquiryId) {
  try {
    const res = await fetch(`${AGENT_API_BASE}/spot/${truckEnquiryId}/calculate_rates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to calculate rates: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      targetRate: data.target_rate || null,
      fairRate: data.fair_rate || null,
      walkawayRate: data.walkaway_rate || null
    };
  } catch (err) {
    console.warn("Target calculation incomplete natively:", err);
    return { targetRate: null, fairRate: null, walkawayRate: null };
  }
}

/**
 * Submits a natively forced Target Rate directly establishing baseline constraints asynchronously natively.
 */
export async function setTargetRate(sessionId, targetRate) {
  try {
    const res = await fetch(`${AGENT_API_BASE}/spot/${sessionId}/set_rate?target_rate=${targetRate}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to set manual target rate: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      calculatedTargetRate: data.target_rate || null,
      calculatedFairRate: data.fair_rate || null,
      calculatedWalkawayRate: data.walkaway_rate || null
    };
  } catch (err) {
    throw err;
  }
}

/**
 * Executes a simulated User bid.
 * Since actual Agent tracing is asynchronous, this provides an instant visual fake trace 
 * using parameters derived cleanly from Langfuse to populate the chat interface.
 */
export async function submitBid(sessionId, transporterName, quote) {
  try {
    const numQuote = Number(quote);
    const isAccepted = numQuote <= 42500;
    const isRejected = numQuote > 50000;

    let agentCounter = numQuote - 2000;
    if (isAccepted) agentCounter = numQuote;

    const tokens = sampleTrace.observations.find(o => o.type === "GENERATION")?.usageDetails?.total || 103063;
    const costAmount = (sampleTrace.totalCost || 0).toFixed(6);

    return {
      round: 1, // Placeholder until real backend implementation
      traceId: sampleTrace.id,
      transporterName,
      transporterQuote: numQuote,
      agentCounter: isRejected ? null : agentCounter,
      status: isRejected ? "Rejected" : isAccepted ? "Accepted" : "Negotiating",
      latency: sampleTrace.latency + 's',
      tokens: tokens,
      cost: "$" + costAmount,
      langfuseTrace: sampleTrace
    };
  } catch (err) {
    throw err;
  }
}

/**
 * Fetches the master instruction manual for the AI agent, broken down into editable sections.
 * If you pass a truck_enquiry_id, it returns any previous custom edits made for that specific spot.
 */
export async function getPromptTemplate(truckEnquiryId = null) {
  try {
    const url = new URL(`${AGENT_API_BASE}/spot/prompt_template`);
    if (truckEnquiryId) {
      url.searchParams.append('truck_enquiry_id', truckEnquiryId);
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch prompt template: ${res.statusText}`);
    }

    return await res.json();
  } catch (err) {
    throw err;
  }
}

/**
 * Creates an immutable named prompt version from the current prompt sections.
 */
export async function createPromptVersion(name, model, sections) {
  const res = await fetch(`${AGENT_API_BASE}/spot/prompt_versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, model: model || null, sections })
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Failed to create prompt version: ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Lists immutable prompt versions available to the playground.
 */
export async function getPromptVersions() {
  const res = await fetch(`${AGENT_API_BASE}/spot/prompt_versions`, {
    method: "GET",
    headers: { "Content-Type": "application/json" }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch prompt versions: ${res.statusText}`);
  }

  const data = await res.json();
  return data.prompt_versions || [];
}

/**
 * Fetches the full immutable prompt version document.
 */
export async function getPromptVersion(versionId) {
  const res = await fetch(`${AGENT_API_BASE}/spot/prompt_versions/${versionId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch prompt version: ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Retrieves the exact list of agent LLM models allowed by the system configuration synchronously.
 */
export async function getAllowedModels() {
  try {
    const res = await fetch(`${AGENT_API_BASE}/spot/allowed_models`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch allowed models: ${res.statusText}`);
    }

    return await res.json();
  } catch (err) {
    console.error("Failed fetching allowed models:", err);
    return [];
  }
}
