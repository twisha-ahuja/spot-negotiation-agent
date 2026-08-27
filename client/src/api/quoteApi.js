import toast from 'react-hot-toast';
import { AGENT_API_BASE } from './urls';

/**
 * Submits a transporter quote to the Spot Negotiation Agent.
 * Note: The API responds with an empty literal body `0` upon success.
 * Any outcome (e.g. negotiation block, validation failures) is swallowed backend-side.
 * 
 * @param {string} truckEnquiryId - The spot enquiry ID
 * @param {string} transporterId - The ID of the transporter quoting
 * @param {number} rate - The target amount quoted
 * @returns {Promise<any>} The literal numeric 0 or threw exception
 */
export async function submitTransporterQuote(truckEnquiryId, transporterId, rate) {
  try {
    const res = await fetch(`${AGENT_API_BASE}/spot/transporter_quote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        truck_enquiry_id: truckEnquiryId,
        transporter_id: transporterId,
        rate: Number(rate)
      })
    });

    if (!res.ok) {
      throw new Error(`Quote submission failed with status: ${res.status}`);
    }

    // Attempt to parse the response if it contains valid structured data, otherwise just return raw payload
    const textRes = await res.text();
    console.log(textRes, "textRes")
    if (textRes === "Spot has been expired or deleted" ||
      textRes.includes("Spot has been expired or deleted")) {
      toast.error("Spot has expired or been deleted")
      return "Spot has been expired or deleted";
    }
    try {
      return JSON.parse(textRes);
    } catch {
      return textRes;
    }
  } catch (error) {
    console.error("Transporter quote API Error: ", error);
    throw error;
  }
}
