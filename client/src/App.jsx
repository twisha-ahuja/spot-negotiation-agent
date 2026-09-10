import React, { useState, useEffect } from "react";
import "./App.css";
import styles from "./styles/App.module.css";
import { createPlaygroundSpot, configurePlaygroundSpot, getPlaygroundSpotDetails, setTargetRate, getCalculatedRates } from "./api/spotApi";
import { submitTransporterQuote } from "./api/quoteApi";
import { Toaster, toast } from 'react-hot-toast';
import SidebarConfig from "./components/SidebarConfig";
import ExecutionPane from "./components/ExecutionPane";
import LandingPage from "./components/LandingPage";
import { getSessionTraces } from "./api/langfuseApi";

const LEGACY_MODEL_ALIASES = {
  "claude-haiku-4-5": "claude-haiku-sdk",
  "claude-haiku-4": "claude-haiku-sdk",
  "claude-sonnet-4-5": "claude-sonnet-sdk",
  "claude-sonnet-4": "claude-sonnet-sdk"
};

const normalizeModelSelection = (model, allowedModels = []) => {
  if (!model) return allowedModels[0] || "";

  const mapped = LEGACY_MODEL_ALIASES[model] || model;

  if (allowedModels.length > 0) {
    return allowedModels.includes(mapped) ? mapped : allowedModels[0];
  }

  return mapped;
};

const EMPTY_CONFIG = {
  transporterName: "",
  selectedTransporters: [],
  origin: null,
  destination: null,
  truckType: {
  },
  placementDate: "",
  expiryHours: 24,
  company: null,
  model: "",
  allowedModels: [],
  negotiationMode: "get_me_a_truck",
  agentPrompt: "",
  maxRoundsPerTransporter: ""
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
  const [activeTab, setActiveTab] = useState("Observability");
  const [transcriptsByTransporter, setTranscriptsByTransporter] = useState({});
  const [spotDetails, setSpotDetails] = useState(null);
  const [pendingQuoteByTransporter, setPendingQuoteByTransporter] = useState({});
  const activeTabInitialized = React.useRef(false);
  const pendingQuoteRef = React.useRef({});

  useEffect(() => {
    pendingQuoteRef.current = pendingQuoteByTransporter;
  }, [pendingQuoteByTransporter]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const clearWorkspace = () => {
    setConfig(EMPTY_CONFIG);
    setTranscriptsByTransporter({});
    setSpotDetails(null);
    setComputedTarget(null);
    setComputedFair(null);
    setComputedWalkaway(null);
    setPendingQuoteByTransporter({});
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
        const res = await getPlaygroundSpotDetails(sessionId);
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
            model: spot.playground_settings?.agent_model || spot.playground_settings?.model || prev.model,
            negotiationMode: spot.playground_settings?.negotiation_mode || prev.negotiationMode,
            agentPrompt: spot.playground_settings?.agent_prompt || prev.agentPrompt,
            promptVersionId: spot.playground_settings?.prompt_version_id || spot.prompt_version_id || prev.promptVersionId,
            selectedTransporters: fetchedTransporterList?.length > 0 ? fetchedTransporterList : prev.selectedTransporters,
            transporterName: fetchedTransporterList?.[0]?.transporter_name || prev.transporterName,
            adhocId: spot.truck_enquiry_id || prev.adhocId
          }));

          // Hydrate past Negotiation Chat logs for every selected transporter - each transporter's
          // Langfuse traces live under their own composite session id (truck_enquiry_id:transporter_id)
          const tracesByTransporter = {};
          await Promise.all((fetchedTransporterList || []).map(async t => {
            try {
              const traces = await getSessionTraces(`${sessionId}:${t.transporter_id}`);
              tracesByTransporter[t.transporter_id] = [...traces].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            } catch {
              tracesByTransporter[t.transporter_id] = [];
            }
          }));

          const nextTranscripts = {};
          const nextPending = {};
          (fetchedTransporterList || []).forEach(t => {
            const transDoc = docs.find(d => d.type === 'transporter_negotiation' && d.transporter_id === t.transporter_id);
            if (!transDoc) return;

            const sortedTraces = tracesByTransporter[t.transporter_id] || [];
            nextTranscripts[t.transporter_id] = (transDoc.agent_logs || []).map(log => {
              const lfTrace = sortedTraces[log.round - 1];
              const transporterQuote = log.transporter_rate ?? log.rate ?? null;
              const agentCounter = log.counter_offer_rate ?? null;
              const negotiate = typeof log.negotiate === 'boolean' ? log.negotiate : (agentCounter != null);
              return {
                round: log.round,
                traceId: transDoc._id?.$oid || "trace_" + log.round,
                transporterName: t.transporter_name || 'Transporter',
                transporterQuote,
                agentCounter,
                negotiate,
                status: negotiate ? "Negotiating" : (agentCounter != null ? "Accepted" : "Rejected"),
                latency: lfTrace?.latency ? `${lfTrace.latency.toFixed(1)}s` : (log.usage?.duration_api_ms ? (log.usage.duration_api_ms / 1000).toFixed(1) + 's' : '-'),
                tokens: log.usage?.output_tokens || '-',
                cost: log.usage?.total_cost_usd ? "$" + log.usage.total_cost_usd.toFixed(4) : '-',
                timestamp: log.timestamp?.$date || log.timestamp || new Date().toISOString(),
                reasoning: log.reasoning || ""
              };
            });

            if (transDoc.pending_round) {
              nextPending[t.transporter_id] = transDoc.pending_round.transporter_rate;
            }
          });

          setTranscriptsByTransporter(nextTranscripts);
          setPendingQuoteByTransporter(nextPending);

          if (!activeTabInitialized.current && fetchedTransporterList?.length > 0) {
            setActiveTab(fetchedTransporterList[0].transporter_id);
            activeTabInitialized.current = true;
          }

          if (Object.keys(nextPending).length > 0) {
            setLoading(true);
            setPolling(true);
          } else {
            setPolling(false);
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

  // Polling Hook for Async Agent Execution - resolves every transporter with a pending round
  useEffect(() => {
    if (!polling || !sessionId) return;

    let pollCount = 0;
    const interval = setInterval(async () => {
      try {
        pollCount++;
        const pendingIds = Object.keys(pendingQuoteRef.current);
        const [res, tracesByTransporter] = await Promise.all([
          getPlaygroundSpotDetails(sessionId),
          Promise.all(pendingIds.map(async id => {
            try {
              const traces = await getSessionTraces(`${sessionId}:${id}`);
              return [id, [...traces].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())];
            } catch {
              return [id, []];
            }
          })).then(Object.fromEntries)
        ]);
        const docs = Array.isArray(res) ? res : (res?.docs || []);
        const latestSpot = docs.find(d => d?.type === 'enquiry_agent_settings') || docs[0];

        if (latestSpot) {
          setSpotDetails(prev => ({
            ...prev,
            origin: latestSpot.lane_details?.origin || prev?.origin,
            destination: latestSpot.lane_details?.destination || prev?.destination,
            truckType: latestSpot.lane_details?.truck_type?.label || latestSpot.lane_details?.truck_type || prev?.truckType,
            dateOfPlacement: latestSpot.lane_details?.dop || latestSpot.lane_details?.placementDate || prev?.dateOfPlacement,
          }));

          const latestTarget = latestSpot.target_rate ?? latestSpot.suggested_target_rate;
          const latestFair = latestSpot.fair_rate ?? latestSpot.suggested_fair_rate;
          const latestWalkaway = latestSpot.walkaway_rate ?? latestSpot.suggested_walkaway_rate;

          if (latestTarget != null) { setComputedTarget(latestTarget); }
          if (latestFair != null) { setComputedFair(latestFair); }
          if (latestWalkaway != null) { setComputedWalkaway(latestWalkaway); }
        }

        setPendingQuoteByTransporter(prevPending => {
          const remainingPending = { ...prevPending };

          Object.keys(prevPending).forEach(transporterId => {
            const transDoc = docs.find(d => d.type === 'transporter_negotiation' && d.transporter_id === transporterId);
            const transporterMeta = config.selectedTransporters?.find(t => t.transporter_id === transporterId);

            // If pending_round is null/undefined, the backend agent has successfully concluded the cycle and committed logs natively.
            if (transDoc && !transDoc.pending_round && transDoc.agent_logs) {
              const logs = transDoc.agent_logs;
              const sortedTraces = tracesByTransporter[transporterId] || [];
              setTranscriptsByTransporter(prevT => {
                const previousEntries = prevT[transporterId] || [];
                return {
                  ...prevT,
                  [transporterId]: logs.map((log, index) => {
                    const lfTrace = sortedTraces[log.round - 1];
                    const previousEntry = previousEntries.find(entry => entry.round === log.round) || previousEntries[index] || previousEntries[previousEntries.length - 1];
                    const transporterQuote = log.transporter_rate ?? log.rate ?? previousEntry?.transporterQuote ?? null;
                    const agentCounter = log.counter_offer_rate ?? previousEntry?.agentCounter ?? null;
                    const negotiate = typeof log.negotiate === 'boolean' ? log.negotiate : (agentCounter != null);
                    return {
                      round: log.round,
                      traceId: transDoc._id?.$oid || "trace_" + log.round,
                      transporterName: transporterMeta?.transporter_name || 'Transporter',
                      transporterQuote,
                      agentCounter,
                      negotiate,
                      status: negotiate ? "Negotiating" : (agentCounter != null ? "Accepted" : "Rejected"),
                      latency: lfTrace?.latency ? `${lfTrace.latency.toFixed(1)}s` : (log.usage?.duration_api_ms ? (log.usage.duration_api_ms / 1000).toFixed(1) + 's' : '-'),
                      tokens: log.usage?.output_tokens || '-',
                      cost: log.usage?.total_cost_usd ? "$" + log.usage.total_cost_usd.toFixed(4) : '-',
                      timestamp: log.timestamp?.$date || log.timestamp || new Date().toISOString(),
                      reasoning: log.reasoning || ""
                    };
                  })
                };
              });
              delete remainingPending[transporterId];
            } else if (!transDoc || !transDoc.pending_round) {
              // If quoting genuinely hasn't started or dropped off natively without generating logs, shut down polling for it.
              delete remainingPending[transporterId];
            } else if (pollCount > 15) {
              // Timeout after ~150 seconds based on 10s poll
              delete remainingPending[transporterId];
              toast.error(`Agent is taking too long to respond for ${transporterMeta?.transporter_name || 'transporter'}. Polling timed out.`);
            }
          });

          if (Object.keys(remainingPending).length === 0) {
            setPolling(false);
            setLoading(false);
          }

          return remainingPending;
        });
      } catch (err) {
        console.error("Polling fetch failed", err);
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [polling, sessionId, config.selectedTransporters]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const updateConfig = (field, val) => setConfig(prev => ({ ...prev, [field]: val }));

  const handleStartSession = async () => {
    if (appMode === 'existing' && !config.adhocId) return;
    if (appMode === 'new' && (!config.origin || !config.destination)) return;

    if (appMode === 'existing') {
      activeTabInitialized.current = false;
      setSessionId(config.adhocId);
      window.history.pushState({}, '', `/existing/${config.adhocId}`);
      setTranscriptsByTransporter({});
      return;
    }

    const safeModel = normalizeModelSelection(config.model, config.allowedModels || []);
    if (safeModel && config.model !== safeModel) {
      updateConfig("model", safeModel);
    }

    let payload = {
      agent_enabled: true,
      ...(config.maxRoundsPerTransporter !== "" && config.maxRoundsPerTransporter != null
        ? { max_rounds_per_transporter: parseInt(config.maxRoundsPerTransporter, 10) }
        : {}),
      model: safeModel,
      negotiation_mode: config.negotiationMode,
      prompt_version_id: config.promptVersionId || null,
      agent_prompt: config.agentPrompt || null,
      sections: !config.promptVersionId
        ? (config.promptSections || []).filter(s => s.editable).map(s => ({
            heading: s.heading,
            content: s.content
          }))
        : [],
      lane_details: {
        origin: config.origin || {},
        destination: config.destination || {},
        truck_type: config.truckType || { label: "", value: "" },
        benchmark_transporter_list: (config.selectedTransporters || []).map(t => ({
          transporter_id: t.transporter_id || "",
          transporter_name: t.transporter_name || ""
        })),
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

      await configurePlaygroundSpot(
        res.truck_enquiry_id,
        safeModel,
        config.negotiationMode,
        !config.promptVersionId
          ? (config.promptSections || []).filter(s => s.editable).map(s => ({
              heading: s.heading,
              content: s.content
            }))
          : []
      );

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

      if (config.selectedTransporters?.length > 0) {
        setActiveTab(config.selectedTransporters[0].transporter_id);
        activeTabInitialized.current = true;
      }

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

      setTranscriptsByTransporter({});
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

  const handleBid = async (transporterId, quoteInput) => {
    if (!sessionId || !transporterId) return;
    setPendingQuoteByTransporter(prev => ({ ...prev, [transporterId]: Number(quoteInput) }));
    try {
      // Post actual pipeline request through the newly created async API cleanly
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
        setPendingQuoteByTransporter(prev => ({ ...prev, [transporterId]: transDoc.pending_round.transporter_rate }));
      }

      setPolling(true); // Engages the asynchronous listener hook mapped above
    } catch (e) {
      console.error(e);
      setPendingQuoteByTransporter(prev => {
        const next = { ...prev };
        delete next[transporterId];
        return next;
      });
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
          <div
            className={styles.navTabs}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <div
              className={`${styles.navTab} ${activeTab === 'Observability' ? styles.navTabActive : ''}`}
              onClick={() => setActiveTab('Observability')}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                whiteSpace: 'nowrap'
              }}
            >
              Observability
            </div>
            {(config.selectedTransporters || []).map(transporter => (
              <button
                key={transporter.transporter_id}
                type="button"
                className={`${styles.navTab} ${activeTab === transporter.transporter_id ? styles.navTabActive : ''}`}
                onClick={() => setActiveTab(transporter.transporter_id)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  whiteSpace: 'nowrap'
                }}
                title={`View ${transporter.transporter_name}'s negotiation script`}
              >
                {transporter.transporter_name}
              </button>
            ))}
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
          transcriptsByTransporter={transcriptsByTransporter}
          selectedTransporters={config.selectedTransporters || []}
          loading={loading}
          handleBid={handleBid}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          spotDetails={spotDetails}
          pendingQuoteByTransporter={pendingQuoteByTransporter}
        />
      </div>
    </div>
  );
}
