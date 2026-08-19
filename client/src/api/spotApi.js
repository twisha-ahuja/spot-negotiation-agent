import sampleTrace from './resp.json';
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
 * (Placeholder) Connects to the backend target rate calculation engine.
 * Currently returning `null` to gracefully trigger the manual rate input layout naturally.
 */
export async function getCalculatedRates(truckEnquiryId) {
  try {
    // In actual implementation, this points to your specific rate calculation GET/POST endpoint
    // Returning nulls right now triggers the graceful manual-input fallback UI as requested
    return {
      targetRate: null,
      fairRate: null,
      walkawayRate: null
    };
  } catch (err) {
    throw err;
  }
}

/**
 * Calculates Mock Fallback Rates natively.
 * Converts your manual target rate string dynamically into a mock Fair and Walkaway bracket.
 */
export async function setTargetRate(sessionId, targetRate) {
  try {
    const t = Number(targetRate);
    return {
      calculatedTargetRate: t,
      calculatedFairRate: t + 1800,
      calculatedWalkawayRate: t + 3300
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
