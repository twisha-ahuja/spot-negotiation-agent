import React, { useState, useEffect } from "react";
import "./App.css";
import styles from "./styles/App.module.css";
import { createPlaygroundSpot, getPlaygroundSpotDetails, setTargetRate } from "./api/spotApi";
import { submitTransporterQuote } from "./api/quoteApi";
import sampleTrace from "./trace.json";
import { Toaster, toast } from 'react-hot-toast';
import SidebarConfig from "./components/SidebarConfig";
import ExecutionPane from "./components/ExecutionPane";
import LandingPage from "./components/LandingPage";

const EMPTY_CONFIG = {
  transporterName: "",
  origin: null,
  destination: null,
  truckType: {
    label: "18 MT MXL Container",
    value: "18 MT MXL Container"
  },
  placementDate: "",
  expiryTimestamp: "",
  company: null,
  model: "claude-3-5-sonnet",
  agentPrompt: "You are a spot-rate negotiation agent for a freight brokerage. Negotiate firmly but fairly toward the target rate, never below the walkaway rate."
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

  // Sync path routing natively via popstate
  useEffect(() => {
    const handlePopState = () => {
      const { mode, sId } = getPathParams();
      setAppMode(mode);
      setSessionId(sId);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const fetchSpotDetails = async () => {
      try {
        const res = await getPlaygroundSpotDetails(sessionId);
        if (res?.docs?.length > 0) {

          const spot = res.docs?.length > 0 && res.docs.find(d => d?.type === 'enquiry_agent_settings') || res.docs[0];

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
            selectedTransporter: fetchedTransporterList?.[0] || prev.selectedTransporter,
            transporterName: fetchedTransporterList?.[0]?.transporter_name || prev.transporterName,
            adhocId: spot.truck_enquiry_id || prev.adhocId
          }));

          // Hydrate past Negotiation Chat logs if existing
          const tId = fetchedTransporterList?.[0]?.transporter_id;
          const transDoc = res.docs.find(d => d.type === 'transporter_negotiation' && d.transporter_id === tId);
          if (transDoc && transDoc.agent_logs) {
            setTranscript(transDoc.agent_logs.map(log => ({
              round: log.round,
              traceId: transDoc._id?.$oid || "trace_" + log.round,
              transporterName: fetchedTransporterList?.[0]?.transporter_name || 'Transporter',
              transporterQuote: log.transporter_rate,
              agentCounter: log.counter_offer_rate,
              status: log.negotiate ? "Negotiating" : (log.counter_offer_rate ? "Accepted" : "Rejected"),
              latency: log.usage?.duration_api_ms ? (log.usage.duration_api_ms / 1000).toFixed(1) + 's' : '-',
              tokens: log.usage?.output_tokens || '-',
              cost: log.usage?.total_cost_usd ? "$" + log.usage.total_cost_usd.toFixed(4) : '-',
              langfuseTrace: {
                id: transDoc._id?.$oid || "trace_" + log.round,
                name: "Agent Negotiation Round " + log.round,
                timestamp: log.timestamp?.$date || new Date().toISOString(),
                latency: log.usage?.duration_api_ms ? log.usage.duration_api_ms / 1000 : 0,
                totalCost: log.usage?.total_cost_usd || 0,
                sessionId: transDoc.truck_enquiry_id,
                environment: "production",
                input: {
                  truck_enquiry_id: transDoc.truck_enquiry_id,
                  transporter_id: transDoc.transporter_id,
                  transporter_rate: log.transporter_rate,
                  quotes_count: log.total_quotes_count
                },
                output: {
                  counter_offer_rate: log.counter_offer_rate,
                  rationale: log.reasoning,
                  negotiate: log.negotiate
                },
                observations: sampleTrace.observations
              }
            })));
          }

          // Update rates actively assigned
          setComputedTarget(spot.target_rate || null);
          setComputedFair(spot.fair_rate || null);
          setComputedWalkaway(spot.walkaway_rate || null);
        }
      } catch (err) {
        console.error("Failed to fetch spot details:", err);
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
        const res = await getPlaygroundSpotDetails(sessionId);
        const transDoc = res?.docs?.find(d => d.type === 'transporter_negotiation' && d.transporter_id === transporterId);

        const logs = transDoc?.agent_logs || [];

        // If logs size meets or exceeds the local transcript array, the agent has effectively responded.
        if (logs.length > 0 && logs.length >= transcript.length) {

          setTranscript(logs.map(log => ({
            round: log.round,
            traceId: transDoc._id?.$oid || "trace_" + log.round,
            transporterName: config.transporterName || 'Transporter',
            transporterQuote: log.transporter_rate,
            agentCounter: log.counter_offer_rate,
            status: log.negotiate ? "Negotiating" : (log.counter_offer_rate ? "Accepted" : "Rejected"),
            latency: log.usage?.duration_api_ms ? (log.usage.duration_api_ms / 1000).toFixed(1) + 's' : '-',
            tokens: log.usage?.output_tokens || '-',
            cost: log.usage?.total_cost_usd ? "$" + log.usage.total_cost_usd.toFixed(4) : '-',
            langfuseTrace: {
              id: transDoc._id?.$oid || "trace_" + log.round,
              name: "Agent Negotiation Round " + log.round,
              timestamp: log.timestamp?.$date || new Date().toISOString(),
              latency: log.usage?.duration_api_ms ? log.usage.duration_api_ms / 1000 : 0,
              totalCost: log.usage?.total_cost_usd || 0,
              sessionId: transDoc.truck_enquiry_id,
              environment: "production",
              input: {
                truck_enquiry_id: transDoc.truck_enquiry_id,
                transporter_id: transDoc.transporter_id,
                transporter_rate: log.transporter_rate,
                quotes_count: log.total_quotes_count
              },
              output: {
                counter_offer_rate: log.counter_offer_rate,
                rationale: log.reasoning,
                negotiate: log.negotiate
              },
              observations: sampleTrace.observations
            }
          })));

          setPolling(false);
          setLoading(false);
        } else if (pollCount > 15) {
          // Timeout after ~225 seconds based on 15s poll
          setPolling(false);
          setLoading(false);
          toast.error("Agent is taking too long to respond. Polling timed out.");
        }
      } catch (err) {
        console.error("Polling fetch failed", err);
      }
    }, 15000);

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
      playground_settings: {
        model: config.model,
        agent_prompt: config.agentPrompt
      },
      lane_details: {
        origin: config.origin || {},
        destination: config.destination || {},
        truck_type: config.truckType || { label: "", value: "" },
        benchmark_transporter_list: config.selectedTransporter ? [{
          transporter_id: config.selectedTransporter.transporter_id || "",
          transporter_name: config.selectedTransporter.transporter_name || ""
        }] : [],
        dop: config.placementDate,
        expiry_date: config.expiryTimestamp
          ? new Date(config.expiryTimestamp).toISOString().replace('Z', '+00:00')
          : ""
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
    setPendingQuote(quoteInput);
    try {
      // Post actual pipeline request through the newly created async API cleanly
      const transporterId = config.selectedTransporter?.transporter_id || "UNKNOWN_ID";
      await submitTransporterQuote(sessionId, transporterId, quoteInput);

      // Instantly inject the transporter's manual quote into the UI transcript locally
      setTranscript(prev => [...prev, {
        round: prev.length + 1,
        traceId: 'pending...',
        transporterName: config.transporterName || 'Transporter',
        transporterQuote: Number(quoteInput),
        agentCounter: null,
        status: "Negotiating",
        latency: '-',
        tokens: '-',
        cost: '-',
        langfuseTrace: null
      }]);

      setPendingQuote(null);
      setPolling(true); // Engages the asynchronous listener hook mapped above
    } catch (e) {
      console.error(e);
      setLoading(false);
      setPendingQuote(null);
    }
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
        <LandingPage onSelectMode={mode => {
          window.history.pushState({}, '', `/${mode}`);
          setAppMode(mode);
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
            <h2>Spot Negotiation Playground</h2>
          </div>
          <div className={styles.navTabs}>
            <div className={`${styles.navTab} ${activeTab === 'Live Console' ? styles.navTabActive : ''}`} onClick={() => setActiveTab('Live Console')}>Live Console</div>
            <div className={`${styles.navTab} ${activeTab === 'Observability' ? styles.navTabActive : ''}`} onClick={() => setActiveTab('Observability')}>Observability</div>
          </div>
        </div>

        <div className={styles.navActions}>
          <button className={styles.btnAction} onClick={() => { window.history.pushState({}, '', '/'); setAppMode('landing'); setSessionId(null); }}>
            Exit to Home
          </button>
          <button className={styles.themeToggle} onClick={toggleTheme}>
            {theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
          <button className={styles.btnAction}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
            Save config
          </button>
        </div>
      </header>

      <div className={styles.workspace}>
        <SidebarConfig
          appMode={appMode}
          config={config}
          updateConfig={updateConfig}
          handleStartSession={handleStartSession}
          loading={loading}
          hasSession={!!sessionId}
          setSpotDetails={setSpotDetails}
        />
        <ExecutionPane
          sessionId={sessionId}
          computedTarget={computedTarget}
          computedFair={computedFair}
          computedWalkaway={computedWalkaway}
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
