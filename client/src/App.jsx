import React, { useState, useEffect } from "react";
import "./App.css";
import styles from "./styles/App.module.css";
import { createPlaygroundSpot, getPlaygroundSpotDetails, setTargetRate, getCalculatedRates } from "./api/spotApi";
import { submitTransporterQuote } from "./api/quoteApi";
import { Toaster, toast } from 'react-hot-toast';
import SidebarConfig from "./components/SidebarConfig";
import ExecutionPane from "./components/ExecutionPane";
import LandingPage from "./components/LandingPage";
import { getSessionTraces } from "./api/langfuseApi";

const EMPTY_CONFIG = {
  transporterName: "",
  origin: null,
  destination: null,
  truckType: {
  },
  placementDate: "",
  expiryHours: 24,
  company: null,
  model: "",
  agentPrompt: ""
};

const getPathParams = () => {
  const segments = window.location.pathname.replace(/^\/|\/$/g, '').split('/');
  const mode = ['new', 'existing'].includes(segments[0]) ? segments[0] : 'landing';
  const sId = segments[1] || null;
  return { mode, sId };
};

export default function App() {
  const initialParams = getPathParams();

  const [appMode, setAppMode] = useState(initialParams.mode);

  const [config, setConfig] = useState(EMPTY_CONFIG);

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved : 'light';
  });

  const [loading, setLoading] = useState(false);
  const [computingRates, setComputingRates] = useState(false);
  const [polling, setPolling] = useState(false);
  const [sessionId, setSessionId] = useState(initialParams.sId);
  const [computedTarget, setComputedTarget] = useState(null);
  const [computedFair, setComputedFair] = useState(null);
  const [computedWalkaway, setComputedWalkaway] = useState(null);
  const [activeTab, setActiveTab] = useState("Live Console");
  const [transcript, setTranscript] = useState([]);
  const [spotDetails, setSpotDetails] = useState(null);
  const [pendingQuote, setPendingQuote] = useState(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const clearWorkspace = () => {
    setConfig(EMPTY_CONFIG);
    setTranscript([]);
    setSpotDetails(null);
    setComputedTarget(null);
    setComputedFair(null);
    setComputedWalkaway(null);
    setPendingQuote(null);
  };

  // Sync path routing natively via popstate
  useEffect(() => {
    const handlePopState = () => {
      const { mode, sId } = getPathParams();
      setAppMode(mode);
      setSessionId(sId);
      if (mode === 'landing') clearWorkspace();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const fetchSpotDetails = async () => {
      setLoading(true);
      try {
        const [res, traces] = await Promise.all([
          getPlaygroundSpotDetails(sessionId),
          getSessionTraces(sessionId).catch(() => [])
        ]);
        const sortedTraces = [...traces].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const docs = Array.isArray(res) ? res : (res?.docs || []);
        if (docs.length > 0) {

          const spot = docs.find(d => d?.type === 'enquiry_agent_settings') || docs[0];

          setSpotDetails({
            origin: spot.lane_details?.origin,
            destination: spot.lane_details?.destination,
            truckType: spot.lane_details?.truck_type?.label || spot.lane_details?.truck_type,
            dateOfPlacement: spot.lane_details?.dop || spot.lane_details?.placementDate,
          });

          // Auto-populate Config values exactly as fetched from API
          const fetchedTransporterList = spot.lane_details?.benchmark_transporter_list;
          setConfig(prev => ({
            ...prev,
            origin: spot.lane_details?.origin?.location_name || spot.lane_details?.origin?.location?.label || prev.origin,
            destination: spot.lane_details?.destination?.location_name || spot.lane_details?.destination?.location?.label || prev.destination,
            truckType: spot.lane_details?.truck_type || prev.truckType,
            placementDate: spot.lane_details?.dop || spot.lane_details?.placementDate || prev.placementDate,
            expiryTimestamp: spot.lane_details?.expiry_date ? new Date(spot.lane_details.expiry_date).toISOString().slice(0, 16) : prev.expiryTimestamp,
            company: { company_id: spot.company_id, domain: spot.domain, value: spot.domain },
            model: spot.playground_settings?.model || prev.model,
            agentPrompt: spot.playground_settings?.agent_prompt || prev.agentPrompt,
            promptVersionId: spot.playground_settings?.prompt_version_id || spot.prompt_version_id || prev.promptVersionId,
            selectedTransporter: fetchedTransporterList?.[0] || prev.selectedTransporter,
            transporterName: fetchedTransporterList?.[0]?.transporter_name || prev.transporterName,
            adhocId: spot.truck_enquiry_id || prev.adhocId
          }));

          // Hydrate past Negotiation Chat logs if existing
          const tId = fetchedTransporterList?.[0]?.transporter_id;
          const transDoc = docs.find(d => d.type === 'transporter_negotiation' && d.transporter_id === tId);
          if (transDoc) {
            setTranscript(transDoc.agent_logs.map(log => {
              const lfTrace = sortedTraces[log.round - 1];
              return {
                round: log.round,
                traceId: transDoc._id?.$oid || "trace_" + log.round,
                transporterName: fetchedTransporterList?.[0]?.transporter_name || 'Transporter',
                transporterQuote: log.transporter_rate,
                agentCounter: log.counter_offer_rate,
                negotiate: log.negotiate,
                status: log.negotiate ? "Negotiating" : (log.counter_offer_rate ? "Accepted" : "Rejected"),
                latency: lfTrace?.latency ? `${lfTrace.latency.toFixed(1)}s` : (log.usage?.duration_api_ms ? (log.usage.duration_api_ms / 1000).toFixed(1) + 's' : '-'),
                tokens: log.usage?.output_tokens || '-',
                cost: log.usage?.total_cost_usd ? "$" + log.usage.total_cost_usd.toFixed(4) : '-',
                timestamp: log.timestamp?.$date || log.timestamp || new Date().toISOString(),
                reasoning: log.reasoning || ""
              };
            }));

            if (transDoc.pending_round) {
              setPendingQuote(transDoc.pending_round.transporter_rate);
              setLoading(true);
              setPolling(true);
            } else {
              setPendingQuote(null);
              setPolling(false);
            }
          }

          // Update rates actively assigned only if they actually exist to prevent overwriting locally computed ones
          const tRate = spot.target_rate || spot.suggested_target_rate;
          if (tRate) {
            setComputedTarget(tRate);
            setComputedFair(spot.fair_rate || spot.suggested_fair_rate || null);
            setComputedWalkaway(spot.walkaway_rate || spot.suggested_walkaway_rate || null);
          }
        }
      } catch (err) {
        console.error("Failed to fetch spot details:", err);
      } finally {
        if (!polling) {
          setLoading(false);
        }
      }
    };

    fetchSpotDetails();
  }, [sessionId]);

  // Polling Hook for Async Agent Execution
  useEffect(() => {
    if (!polling || !sessionId) return;
    const transporterId = config.selectedTransporter?.transporter_id;

    let pollCount = 0;
    const interval = setInterval(async () => {
      try {
        pollCount++;
        const [res, traces] = await Promise.all([
          getPlaygroundSpotDetails(sessionId),
          getSessionTraces(sessionId).catch(() => [])
        ]);
        const sortedTraces = [...traces].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const docs = Array.isArray(res) ? res : (res?.docs || []);
        const transDoc = docs.length > 0 && docs.find(d => d.type === 'transporter_negotiation' && d.transporter_id === transporterId);

        // If pending_round is null/undefined, the backend agent has successfully concluded the cycle and committed logs natively.
        if (transDoc && !transDoc.pending_round && transDoc.agent_logs) {
          const logs = transDoc.agent_logs;
          setTranscript(logs.map(log => {
            const lfTrace = sortedTraces[log.round - 1];
            return {
              round: log.round,
              traceId: transDoc._id?.$oid || "trace_" + log.round,
              transporterName: config.transporterName || 'Transporter',
              transporterQuote: log.transporter_rate,
              agentCounter: log.counter_offer_rate,
              negotiate: log.negotiate,
              status: log.negotiate ? "Negotiating" : (log.counter_offer_rate ? "Accepted" : "Rejected"),
              latency: lfTrace?.latency ? `${lfTrace.latency.toFixed(1)}s` : (log.usage?.duration_api_ms ? (log.usage.duration_api_ms / 1000).toFixed(1) + 's' : '-'),
              tokens: log.usage?.output_tokens || '-',
              cost: log.usage?.total_cost_usd ? "$" + log.usage.total_cost_usd.toFixed(4) : '-',
              timestamp: log.timestamp?.$date || log.timestamp || new Date().toISOString(),
              reasoning: log.reasoning || ""
            };
          }));

          setPolling(false);
          setLoading(false);
          setPendingQuote(null);
        } else if (!transDoc || !transDoc.pending_round) {
          // If quoting genuinely hasn't started or dropped off natively without generating logs, shut down polling.
          setPolling(false);
          setLoading(false);
          setPendingQuote(null);
        } else if (pollCount > 15) {
          // Timeout after ~150 seconds based on 10s poll
          setPolling(false);
          setLoading(false);
          setPendingQuote(null);
          toast.error("Agent is taking too long to respond. Polling timed out.");
        }
      } catch (err) {
        console.error("Polling fetch failed", err);
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [polling, sessionId, transcript.length, config.selectedTransporter, config.transporterName]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const updateConfig = (field, val) => setConfig(prev => ({ ...prev, [field]: val }));

  const handleStartSession = async () => {
    if (appMode === 'existing' && !config.adhocId) return;
    if (appMode === 'new' && (!config.origin || !config.destination)) return;

    if (appMode === 'existing') {
      setSessionId(config.adhocId);
      window.history.pushState({}, '', `/existing/${config.adhocId}`);
      setTranscript([]);
      return;
    }

    let payload = {
      agent_enabled: true,
      max_rounds_per_transporter: 10,
      model: config.model,
      prompt_version_id: config.promptVersionId || null,
      agent_prompt: config.agentPrompt || null,
      sections: !config.promptVersionId && config.promptSections?.length > 0 ? (config.promptSections || []).filter(s => s.editable).map(s => ({
        heading: s.heading,
        content: s.content
      })) : null,
      lane_details: {
        origin: config.origin || {},
        destination: config.destination || {},
        truck_type: config.truckType || { label: "", value: "" },
        benchmark_transporter_list: config.selectedTransporter ? [{
          transporter_id: config.selectedTransporter.transporter_id || "",
          transporter_name: config.selectedTransporter.transporter_name || ""
        }] : [],
        dop: config.placementDate,
        expiry_hours: parseInt(config.expiryHours) || 12
      }
    };

    setLoading(true);
    try {
      const companyId = config.company?.company_id || "";
      const domain = config.company?.domain || "";
      console.log(payload, companyId, domain, "HELLO");
      const res = await createPlaygroundSpot(payload, companyId, domain);

      toast.success("Spot created successfully!");

      if (appMode === 'new') {
        const truckLabel = typeof config.truckType === 'object' ? config.truckType.label : config.truckType;
        setSpotDetails({
          origin: config?.origin,
          destination: config?.destination,
          truckType: truckLabel,
          dateOfPlacement: config?.placementDate,
        });
      }

      setSessionId(res.truck_enquiry_id);
      window.history.pushState({}, '', `/${appMode}/${res.truck_enquiry_id}`);

      // Instantly evaluate spot complexity target heuristics post-initialization
      try {
        setComputingRates(true);
        const rates = await getCalculatedRates(res.truck_enquiry_id);
        if (rates?.targetRate) {
          setComputedTarget(rates.targetRate);
          setComputedFair(rates.fairRate);
          setComputedWalkaway(rates.walkawayRate);
        }
      } catch (err) {
        console.warn("Rates computation incomplete block securely handled.", err);
      } finally {
        setComputingRates(false);
      }

      // The effect above will now fetch the exact initialized spotDetails and Rates!
      // But we will gracefully kickstart session status.

      setTranscript([]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSetManualTargetRate = async (manualRate) => {
    setLoading(true);
    try {
      const res = await setTargetRate(sessionId, manualRate);
      setComputedTarget(res.calculatedTargetRate);
      setComputedFair(res.calculatedFairRate);
      setComputedWalkaway(res.calculatedWalkawayRate);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleBid = async (quoteInput) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      // Post actual pipeline request through the newly created async API cleanly
      const transporterId = config.selectedTransporter?.transporter_id || "UNKNOWN_ID";
      const resp1 = await submitTransporterQuote(sessionId, transporterId, quoteInput);
      if (resp1 === "Spot has been expired or deleted") {
        setLoading(false);
        return;
      }

      // Immediately fetch once to pick up the pending_round document created by the backend
      const res = await getPlaygroundSpotDetails(sessionId);
      const docs = Array.isArray(res) ? res : (res?.docs || []);
      const transDoc = docs.find(d => d.type === 'transporter_negotiation' && d.transporter_id === transporterId);

      if (transDoc && transDoc.pending_round) {
        setPendingQuote(transDoc.pending_round.transporter_rate);
      }

      setPolling(true); // Engages the asynchronous listener hook mapped above
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to submit quote. Please try again.");
      setLoading(false);
      setPendingQuote(null);
    }
  };

  const handleResetSession = () => {
    window.history.pushState({}, '', '/new');
    setAppMode('new');
    setSessionId(null);
    clearWorkspace();
  };

  if (appMode === 'landing') {
    return (
      <div className={styles.appContainer}>
        <Toaster position="top-center" />
        <div className={styles.landingThemeControls}>
          <button className={styles.btnAction} onClick={toggleTheme}>
            {theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
        </div>
        <LandingPage onSelectMode={modeString => {
          if (modeString.includes('/')) {
            const [mode, sId] = modeString.split('/');
            window.history.pushState({}, '', `/${mode}/${sId}`);
            setAppMode(mode);
            if (sId) setSessionId(sId);
          } else {
            window.history.pushState({}, '', `/${modeString}`);
            setAppMode(modeString);
          }
        }} />
      </div>
    );
  }

  return (
    <div className={styles.appContainer}>
      <Toaster position="top-center" />
      <header className={styles.topNav}>
        <div className={styles.navLeft}>
          <div className={styles.navBrand}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z" /><path d="M12 6a6 6 0 1 0 0 12 6 6 0 1 0 0-12z" /><path d="M12 10a2 2 0 1 0 0 4 2 2 0 1 0 0-4z" /></svg>
            <h2 style={{ cursor: "pointer" }} onClick={() => { window.history.pushState({}, '', '/'); setAppMode('landing'); setSessionId(null); clearWorkspace(); }}>Spot Negotiation Playground</h2>
          </div>
          <div className={styles.navTabs}>
            <div className={`${styles.navTab} ${activeTab === 'Live Console' ? styles.navTabActive : ''}`} onClick={() => setActiveTab('Live Console')}>Live Console</div>
            <div className={`${styles.navTab} ${activeTab === 'Observability' ? styles.navTabActive : ''}`} onClick={() => setActiveTab('Observability')}>Observability</div>
          </div>
        </div>

        <div className={styles.navActions}>
          <button className={styles.btnAction} onClick={() => { window.history.pushState({}, '', '/'); setAppMode('landing'); setSessionId(null); clearWorkspace(); }}>
            Exit to Home
          </button>
          <button className={styles.themeToggle} onClick={toggleTheme}>
            {theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
        </div>
      </header>

      <div className={styles.workspace}>
        <SidebarConfig
          appMode={appMode}
          config={config}
          updateConfig={updateConfig}
          handleStartSession={handleStartSession}
          handleResetSession={handleResetSession}
          loading={loading}
          hasSession={!!sessionId}
          sessionId={sessionId}
          setSpotDetails={setSpotDetails}
        />
        <ExecutionPane
          sessionId={sessionId}
          computedTarget={computedTarget}
          computedFair={computedFair}
          computedWalkaway={computedWalkaway}
          computingRates={computingRates}
          onSetTargetRate={handleSetManualTargetRate}
          transcript={transcript}
          loading={loading}
          handleBid={handleBid}
          activeTab={activeTab}
          spotDetails={spotDetails}
          pendingQuote={pendingQuote}
        />
      </div>
    </div>
  );
}
