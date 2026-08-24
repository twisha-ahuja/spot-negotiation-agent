import React, { useState, useEffect } from 'react';
import AutoComplete from './Autocomplete';
import LSP_DATA from './lsp.json';
import { AUTOCOMPLETE_API } from '../api/urls';
import { getPromptTemplate, getAllowedModels } from '../api/spotApi';
import styles from '../styles/SidebarConfig.module.css';

export default function SidebarConfig({ appMode, config, updateConfig, handleStartSession, handleResetSession, loading, hasSession, sessionId, setSpotDetails }) {
  const [promptSections, setPromptSections] = useState([]);
  const [allowedModels, setAllowedModels] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [transporterSearch, setTransporterSearch] = useState('');

  useEffect(() => {
    async function loadTemplate() {
      try {
        const idToFetch = hasSession ? sessionId : null;
        const data = await getPromptTemplate(idToFetch);
        if (data && data.sections) {
          setPromptSections(data.sections);
        }
      } catch (err) {
        console.error("Failed to load prompt template", err);
      }
    }

    async function loadModels() {
      try {
        const models = await getAllowedModels();
        if (models && models.length > 0) {
          setAllowedModels(models);
          if (!models.includes(config.model)) {
            updateConfig("model", models[0]);
          }
        }
      } catch (err) {
        console.error("Failed to load allowed models", err);
      }
    }

    loadModels();
    loadTemplate();
  }, [hasSession, sessionId]);

  const handleUpdateSection = (idx, newContent) => {
    const updated = [...promptSections];
    updated[idx].content = newContent;
    setPromptSections(updated);
  };

  useEffect(() => {
    if (promptSections.length > 0 && !hasSession) {
      updateConfig("promptSections", promptSections);
    }
  }, [promptSections, hasSession]);

  useEffect(() => {
    if (hasSession) return;

    if (appMode !== 'existing') {
      // New Simulation logic - populate hypothetical spotDetails dynamically
      if (config.origin && config.destination && config.placementDate) {
        let formattedExpiry = "";
        if (config.expiryTimestamp) {
          const dateObj = new Date(config.expiryTimestamp);
          if (!isNaN(dateObj.getTime())) {
            formattedExpiry = dateObj.toISOString().replace("Z", "+00:00");
          }
        }
        setSpotDetails({
          origin: config.origin,
          destination: config.destination,
          truckType: config.truckType,
          placementDate: config.placementDate,
          expiryDate: formattedExpiry
        });
      } else {
        setSpotDetails(null);
      }
    }
  }, [config.adhocId, appMode, config.origin, config.destination, config.truckType]);

  return (
    <div className={`${styles.pane} ${styles.configSidebar}`}>
      <div className={styles.sidebarGroup}>
        <div className={styles.groupTitle}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
          Scenario
        </div>
        {appMode === 'existing' && !hasSession ? (
          <>
            <div className={styles.formGroup}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Adhoc ID</span>
              </label>
              <input
                placeholder="e.g. ADHOC-88392"
                value={config.adhocId}
                onChange={e => updateConfig("adhocId", e.target.value)}
                disabled={hasSession}
                className={styles.monospacedInput}
              />
            </div>
          </>
        ) : (
          <>
            <div className={styles.formGroup}>
              <label>Origin</label>
              <AutoComplete
                placeholder="Search origin city..."
                value={config.origin}
                onChange={val => updateConfig("origin", val)}
                onSelect={val => updateConfig("origin", val)}
                apiUrl={AUTOCOMPLETE_API}
                disabled={hasSession}
              />
            </div>
            <div className={styles.formGroup} style={{ marginTop: '16px' }}>
              <label>Destination</label>
              <AutoComplete
                placeholder="Search destination city..."
                value={config.destination}
                onChange={val => updateConfig("destination", val)}
                onSelect={val => updateConfig("destination", val)}
                apiUrl={AUTOCOMPLETE_API}
                disabled={hasSession}
              />
            </div>
            <div className={styles.formGroup} style={{ marginTop: '16px' }}>
              <label>Truck Type</label>
              <div className={styles.selectWrapper}>
                <select
                  value={config.truckType?.value || ''}
                  onChange={e => updateConfig("truckType", { label: e.target.value, value: e.target.value })}
                  disabled={hasSession}
                  style={{ width: '100%', appearance: 'none', paddingRight: '32px' }}
                >
                  <option value="18 MT MXL Container">18 MT MXL Container</option>
                  <option value="12 WHEELER OPEN BODY TRUCK (20/21 MT)">12 WHEELER OPEN BODY TRUCK (20/21 MT)</option>
                  <option value="Open Truck 9 MT">Open Truck 9 MT</option>
                  <option value="32 FT MULTI AXLE CONTAINER (15 MT)">32 FT MULTI AXLE CONTAINER (15 MT)</option>
                  <option value="20 MT MXL Container">20 MT MXL Container</option>
                  <option value="24 MT MXL Container">24 MT MXL Container</option>
                  <option value="32 FT SXL Container">32 FT SXL Container</option>
                  <option value="32 FT MXL Container">32 FT MXL Container</option>
                </select>
                <svg className={styles.selectIcon} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
            <div className={styles.formGroup} style={{ marginTop: '16px' }}>
              <label>Select Transporters</label>
              <AutoComplete
                placeholder="Search transporter..."
                value={transporterSearch}
                onChange={val => setTransporterSearch(val)}
                onSelect={suggestion => {
                  const exists = (config.selectedTransporters || []).some(t => t.transporter_id === suggestion.transporter_id);
                  if (!exists) {
                    updateConfig("selectedTransporters", [
                      ...(config.selectedTransporters || []),
                      { transporter_id: suggestion.transporter_id, transporter_name: suggestion.transporter_name }
                    ]);
                  }
                  setTransporterSearch('');
                }}
                localData={LSP_DATA}
                disabled={hasSession}
              />
              {(config.selectedTransporters || []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                  {config.selectedTransporters.map(t => (
                    <span
                      key={t.transporter_id}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '4px 8px', borderRadius: '999px', fontSize: '12px',
                        background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      {t.transporter_name}
                      {!hasSession && (
                        <button
                          type="button"
                          onClick={() => updateConfig("selectedTransporters", config.selectedTransporters.filter(x => x.transporter_id !== t.transporter_id))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0, fontSize: '13px', lineHeight: 1 }}
                        >
                          &times;
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.formGroup} style={{ marginTop: '16px' }}>
              <label>Date of Placement</label>
              <input
                type="date"
                value={config.placementDate}
                onChange={e => updateConfig("placementDate", e.target.value)}
                disabled={hasSession}
                style={{ width: '100%' }}
              />
            </div>
            <div className={styles.formGroup} style={{ marginTop: '16px' }}>
              <label>Expiry Hours</label>
              <input
                type="number"
                min="1"
                value={config.expiryHours}
                onChange={e => updateConfig("expiryHours", e.target.value)}
                disabled={hasSession}
                style={{ width: '100%' }}
                placeholder="e.g. 24"
              />
            </div>
            <div className={styles.formGroup} style={{ marginTop: '16px' }}>
              <label>Select Company</label>
              <div className={styles.selectWrapper}>
                <select
                  value={config.company?.value || ""}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === 'hectorbeverages.com') {
                      updateConfig("company", { company_id: "COM000384", domain: "hectorbeverages.com", label: "Hector", value: "hectorbeverages.com" });
                    } else if (val === 'onida.com') {
                      updateConfig("company", { company_id: "COM000684", domain: "onida.com", label: "Onida", value: "onida.com" });
                    } else {
                      updateConfig("company", null);
                    }
                  }}
                  disabled={hasSession}
                  style={{ width: '100%', appearance: 'none', paddingRight: '32px' }}
                >
                  <option value="">-- Select Company --</option>
                  <option value="hectorbeverages.com">Hector</option>
                  <option value="onida.com">Onida</option>
                </select>
                <svg className={styles.selectIcon} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
          </>
        )}
      </div>

      {(appMode === 'new' || hasSession) && (
        <div className={styles.sidebarGroup}>
          <div className={styles.groupTitle}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            Agent Config
          </div>
          <div className={styles.formGroup}>
            <label>Model</label>
            <div className={styles.selectWrapper}>
              <select
                value={config.model}
                onChange={e => updateConfig("model", e.target.value)}
                disabled={hasSession}
                style={{ width: '100%', appearance: 'none', paddingRight: '32px', fontSize: '14px', padding: '12px', fontWeight: '500' }}
              >
                {allowedModels.length > 0 ? (
                  allowedModels.map(m => <option key={m} value={m}>{m}</option>)
                ) : (
                  <option value="" disabled>Loading models...</option>
                )}
              </select>
              <svg className={styles.selectIcon} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
          <div className={styles.formGroup}>
          </div>
          <div className={styles.formGroup}>
            <label>Agent Instruction Builder</label>
            <button
              className={styles.btnSecondary}
              onClick={() => setShowModal(true)}
            >
              Open Configuration Tabs
            </button>
          </div>
        </div>
      )}

      {/* Configuration Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--bg-panel)', width: '900px', maxWidth: '90%', height: '70vh',
            borderRadius: '12px', border: '1px solid var(--border-color)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow)'
          }}>
            {/* Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Agent Instruction Overlay</h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px' }}>
                &times;
              </button>
            </div>

            {/* Content Area */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
              {/* Tab Column */}
              <div style={{ width: '250px', borderRight: '1px solid var(--border-color)', background: 'var(--bg-page)', overflowY: 'auto' }}>
                {promptSections.map((sec, idx) => (
                  <div
                    key={idx}
                    onClick={() => setActiveTab(idx)}
                    style={{
                      padding: '16px', fontSize: '12px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)',
                      background: activeTab === idx ? 'var(--bg-surface)' : 'transparent',
                      borderLeft: activeTab === idx ? '4px solid var(--brand-agent)' : '4px solid transparent',
                      fontWeight: activeTab === idx ? '600' : '400',
                      color: activeTab === idx ? 'var(--text-primary)' : 'var(--text-secondary)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      {sec.heading}
                      {!sec.editable && <span style={{ color: 'var(--status-err)', fontSize: '10px' }}>Locked</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Editor Pane */}
              <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
                {promptSections[activeTab] && (
                  <>
                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                        {promptSections[activeTab].heading}
                      </span>
                      {!promptSections[activeTab].editable && <span style={{ fontSize: '11px', color: 'var(--status-err)', fontWeight: '600' }}>🔒 Editing Disabled for Runtime Integrity</span>}
                    </div>
                    <textarea
                      value={promptSections[activeTab].content}
                      onChange={e => handleUpdateSection(activeTab, e.target.value)}
                      disabled={!promptSections[activeTab].editable}
                      style={{
                        flex: 1, width: '100%', fontFamily: 'var(--font-mono)', fontSize: '13px', padding: '16px',
                        borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'none',
                        backgroundColor: !promptSections[activeTab].editable ? 'var(--bg-hover)' : 'var(--bg-surface)'
                      }}
                      spellCheck="false"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Footer Action Bar */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'var(--bg-page)' }}>
              <button onClick={() => setShowModal(false)} className={styles.btnSecondary} style={{ width: 'auto', padding: '8px 16px' }}>
                Close Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.sidebarGroup} style={{ background: 'transparent', border: 'none', padding: 0 }}>
        {!hasSession ? (
          <button className={styles.btnPrimary} onClick={handleStartSession} disabled={loading || (appMode === 'existing' ? !config.adhocId : (!config.origin || !config.destination || !(config.selectedTransporters?.length > 0) || !config.placementDate || !config.expiryHours))}>
            {loading ? 'Initializing...' : 'Run Scenario'}
          </button>
        ) : (
          <button className={styles.btnSecondary} onClick={handleResetSession} style={{ width: '100%', marginTop: '16px' }}>
            Reset Session
          </button>
        )}
      </div>
    </div>
  );
}
