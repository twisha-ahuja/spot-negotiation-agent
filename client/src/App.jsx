import React, { useState, useEffect } from "react";
import "./App.css";
import { startSession, submitBid } from "./api";
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
  const [sessionId, setSessionId] = useState(initialParams.sId);
  const [computedTarget, setComputedTarget] = useState(null);
  const [computedWalkaway, setComputedWalkaway] = useState(null);
  const [activeTab, setActiveTab] = useState("Live Console");
  const [sessionStatus, setSessionStatus] = useState("Idle");
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



  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const updateConfig = (field, val) => setConfig(prev => ({ ...prev, [field]: val }));

  const handleStartSession = async () => {
    if (appMode === 'existing' && !config.adhocId) return;
    if (appMode === 'new' && (!config.origin || !config.destination)) return;

    let payload = appMode === 'existing'
      ? {
        simulation_mode: appMode,
        document_id: config.adhocId,
        lsp_selection: config.transporterName
      }
      : {
        simulation_mode: appMode,
        playground_settings: {
          model: config.model,
          agent_prompt: config.agentPrompt
        },
        benchmark_transporter_list: config.selectedTransporter ? [{
          transporter_id: config.selectedTransporter.transporter_id || "",
          transporter_name: config.selectedTransporter.transporter_name || ""
        }] : [],
        lane_details: {
          origin: config.origin || {},
          destination: config.destination || {},
          truck_type: config.truckType || { label: "", value: "" }
        },
        date_of_placement: config.placementDate,
        expiry_timestamp: config.expiryTimestamp
      };

    console.log(payload, "P");

    setLoading(true);
    try {
      const res = await startSession(config);
      setSessionId(res.sessionId);
      window.history.pushState({}, '', `/${appMode}/${res.sessionId}`);
      setComputedTarget(res.calculatedTargetRate);
      setComputedWalkaway(res.calculatedWalkawayRate);
      setSessionStatus(res.status);
      setTranscript([]);
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
      const res = await submitBid(sessionId, config.transporterName || 'Unknown LSP', quoteInput);
      setTranscript(prev => [...prev, res]);
      setSessionStatus(res.status);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setPendingQuote(null);
    }
  };

  if (appMode === 'landing') {
    return (
      <div className="app-container">
        <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px' }}>
          <button style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }} onClick={toggleTheme}>
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
    <div className="app-container">
      <header className="top-nav">
        <div className="nav-left">
          <div className="nav-brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z" /><path d="M12 6a6 6 0 1 0 0 12 6 6 0 1 0 0-12z" /><path d="M12 10a2 2 0 1 0 0 4 2 2 0 1 0 0-4z" /></svg>
            <h2>Spot Negotiation Playground</h2>
          </div>
          <div className="nav-tabs">
            <div className={`nav-tab ${activeTab === 'Live Console' ? 'active' : ''}`} onClick={() => setActiveTab('Live Console')}>Live Console</div>
            <div className={`nav-tab ${activeTab === 'Observability' ? 'active' : ''}`} onClick={() => setActiveTab('Observability')}>Observability</div>
          </div>
        </div>

        <div className="nav-actions">
          <button style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }} onClick={() => { window.history.pushState({}, '', '/'); setAppMode('landing'); setSessionId(null); }}>
            Exit to Home
          </button>
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
          <button style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
            Save config
          </button>
        </div>
      </header>

      <div className="workspace">
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
          sessionStatus={sessionStatus}
          computedTarget={computedTarget}
          setComputedTarget={setComputedTarget}
          computedWalkaway={computedWalkaway}
          setComputedWalkaway={setComputedWalkaway}
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
