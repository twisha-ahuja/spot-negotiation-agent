import React, { useState, useEffect } from "react";
import "./App.css";
import { startSession, submitBid } from "./api";
import SidebarConfig from "./components/SidebarConfig";
import ExecutionPane from "./components/ExecutionPane";

const EMPTY_CONFIG = {
  adhocId: "ADHOC-88392",
  transporterName: "",
  model: "claude-3-5-sonnet",
  agentPrompt: "You are a spot-rate negotiation agent for a freight brokerage. Negotiate firmly but fairly toward the target rate, never below the walkaway rate.",
  temperature: 0.2,
};

export default function App() {
  const [config, setConfig] = useState(EMPTY_CONFIG);
  const [theme, setTheme] = useState("dark");

  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [computedTarget, setComputedTarget] = useState(null);
  const [computedWalkaway, setComputedWalkaway] = useState(null);
  const [activeTab, setActiveTab] = useState("Live Console");
  const [sessionStatus, setSessionStatus] = useState("Idle");
  const [transcript, setTranscript] = useState([]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const updateConfig = (field, val) => setConfig(prev => ({ ...prev, [field]: val }));

  const handleStartSession = async () => {
    if (!config.adhocId) return;
    setLoading(true);
    try {
      const res = await startSession(config);
      setSessionId(res.sessionId);
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
    try {
      const res = await submitBid(sessionId, config.transporterName || 'Unknown LSP', quoteInput);
      setTranscript(prev => [...prev, res]);
      setSessionStatus(res.status);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="top-nav">
        <div className="nav-left">
          <div className="nav-brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z" /><path d="M12 6a6 6 0 1 0 0 12 6 6 0 1 0 0-12z" /><path d="M12 10a2 2 0 1 0 0 4 2 2 0 1 0 0-4z" /></svg>
            <h2>Spot Negotiation Playground<br /><span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 'normal' }}>agent/spot-negotiation · dev</span></h2>
          </div>
          <div className="nav-tabs">
            <div className={`nav-tab ${activeTab === 'Live Console' ? 'active' : ''}`} onClick={() => setActiveTab('Live Console')}>Live Console</div>
            <div className={`nav-tab ${activeTab === 'Observability' ? 'active' : ''}`} onClick={() => setActiveTab('Observability')}>Observability</div>
          </div>
        </div>

        <div className="nav-actions">
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
          config={config}
          updateConfig={updateConfig}
          handleStartSession={handleStartSession}
          loading={loading}
          hasSession={!!sessionId}
        />
        <ExecutionPane
          sessionId={sessionId}
          sessionStatus={sessionStatus}
          computedTarget={computedTarget}
          computedWalkaway={computedWalkaway}
          transcript={transcript}
          loading={loading}
          handleBid={handleBid}
          activeTab={activeTab}
        />
      </div>
    </div>
  );
}
