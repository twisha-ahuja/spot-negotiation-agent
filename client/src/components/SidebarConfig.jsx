import React, { useState, useEffect } from 'react';

export default function SidebarConfig({ config, updateConfig, handleStartSession, loading, hasSession }) {
  const [validating, setValidating] = useState(false);
  const [lsps, setLsps] = useState([]);

  useEffect(() => {
    if (config.adhocId && config.adhocId.length >= 7) {
      setValidating(true);
      const t = setTimeout(() => {
        setLsps(["FedEx Logistics", "Blue Dart", "Delhivery", "XPO Logistics", "IND004997"]);
        setValidating(false);
      }, 700);
      return () => clearTimeout(t);
    } else {
      setLsps([]);
    }
  }, [config.adhocId]);
  return (
    <div className="pane config-sidebar">
      <div className="sidebar-group">
        <div className="group-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
          Scenario
        </div>
        <div className="form-group">
          <label>Adhoc ID</label>
          <input 
            placeholder="e.g. ADHOC-88392" 
            value={config.adhocId} 
            onChange={e => updateConfig("adhocId", e.target.value)} 
            disabled={hasSession}
            className="monospaced-input"
          />
          {validating && <div style={{fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px'}}>Validating Spot ID in Source System...</div>}
        </div>
        <div className="form-group" style={{marginTop: '16px'}}>
          <label style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%'}}>
            <span>Mimic LSP</span>
            {lsps.length > 0 && !validating && <span className="pass-badge pass">Spot Active</span>}
          </label>
          <input 
            list="shortlisted-lsps"
            placeholder={lsps.length > 0 ? "Select shortlisted transporter" : "Awaiting valid Spot ID..."}
            value={config.transporterName || ''}
            onChange={e => updateConfig("transporterName", e.target.value)}
            disabled={hasSession || validating || lsps.length === 0}
          />
          <datalist id="shortlisted-lsps">
            {lsps.map(l => <option key={l} value={l} />)}
          </datalist>
        </div>
      </div>

      <div className="sidebar-group">
        <div className="group-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Agent Config
        </div>
        <div className="form-group">
          <label>Model</label>
          <select value={config.model} onChange={e => updateConfig("model", e.target.value)} disabled={hasSession}>
            <option value="claude-3-5-sonnet">claude-sonnet-3-5</option>
            <option value="gemini-1.5-pro">gemini-1-5-pro</option>
          </select>
        </div>
        <div className="form-group">
          <label>Agent prompt</label>
          <textarea 
            rows={8} 
            value={config.agentPrompt} 
            onChange={e => updateConfig("agentPrompt", e.target.value)} 
            disabled={hasSession}
            className="code-block"
            spellCheck="false"
          />
        </div>
        
        {!hasSession ? (
          <button className="btn-primary" onClick={handleStartSession} disabled={loading || !config.adhocId}>
            {loading ? 'Initializing...' : 'Run Scenario'}
          </button>
        ) : (
          <button className="btn-secondary" onClick={() => window.location.reload()} style={{width: '100%', marginTop: '16px'}}>
            Reset Session
          </button>
        )}
      </div>
    </div>
  );
}
