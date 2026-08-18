import sampleTrace from './resp.json';
import sampleSpot from './spot.json';

export async function validateAdhocId(adhocId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        spotDetails: {
          originCity: sampleSpot.lane_details?.origin?.location?.location || 'Unknown Origin',
          originState: sampleSpot.lane_details?.origin?.location?.state || '',
          destCity: sampleSpot.lane_details?.destination?.location?.location || 'Unknown Dest',
          destState: sampleSpot.lane_details?.destination?.location?.state || '',
          truckType: sampleSpot.lane_details?.truck_types?.label || 'Unknown Truck',
          tonnage: sampleSpot.lane_details?.tonnage || '0'
        },
        lsps: sampleSpot.benchmark_transporter_list?.map(t => t.transporter_name) || []
      });
    }, 700);
  });
}

export async function startSession(config) {
  window.mockRound = 0;
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        sessionId: "run_" + Math.random().toString(36).substr(2, 9),
        calculatedTargetRate: 41200,
        calculatedWalkawayRate: 44500,
        status: "Started"
      });
    }, 800);
  });
}

export async function submitBid(sessionId, transporterName, quote) {
  window.mockRound = (window.mockRound || 0) + 1;
  const numQuote = Number(quote);
  const isAccepted = numQuote <= 42500;
  const isRejected = numQuote > 50000;

  let agentCounter = numQuote - 2000;
  if (isAccepted) agentCounter = numQuote;

  const tokens = sampleTrace.observations.find(o => o.type === "GENERATION")?.usageDetails?.total || 103063;
  const costAmount = (sampleTrace.totalCost || 0).toFixed(6);

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        round: window.mockRound,
        traceId: sampleTrace.id,
        transporterName,
        transporterQuote: numQuote,
        agentCounter: isRejected ? null : agentCounter,
        status: isRejected ? "Rejected" : isAccepted ? "Accepted" : "Negotiating",
        latency: sampleTrace.latency + 's',
        tokens: tokens,
        cost: "$" + costAmount,
        langfuseTrace: sampleTrace
      });
    }, 1500); // give it a sec so UI can stream
  });
}
