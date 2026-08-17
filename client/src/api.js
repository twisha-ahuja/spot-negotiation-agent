import sampleTrace from './resp.json';

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
