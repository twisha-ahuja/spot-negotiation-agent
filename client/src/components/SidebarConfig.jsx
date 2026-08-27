import React, { useState, useEffect } from 'react';
import AutoComplete from './Autocomplete';
import LSP_DATA from './lsp.json';
import RAW_TRUCKS from '../trucks.json';
import { AUTOCOMPLETE_API } from '../api/urls';

// Hector trucks
const TRUCKS_LIST = Array.from(new Set(RAW_TRUCKS.map(t => t.name).filter(Boolean)));

import { createPromptVersion, getPromptTemplate, getAllowedModels, getPromptVersion, getPromptVersions } from '../api/spotApi';
import styles from '../styles/SidebarConfig.module.css';

export default function SidebarConfig({ appMode, config, updateConfig, handleStartSession, handleResetSession, loading, hasSession, sessionId, setSpotDetails }) {
  const [promptSections, setPromptSections] = useState([]);
  const [allowedModels, setAllowedModels] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [promptVersions, setPromptVersions] = useState([]);
  const [versionName, setVersionName] = useState('');
  const [versionLoading, setVersionLoading] = useState(false);

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

    async function loadVersions() {
      try {
        setPromptVersions(await getPromptVersions());
      } catch (err) {
        console.error("Failed to load prompt versions", err);
      }
    }

    loadModels();
    loadTemplate();
    loadVersions();
  }, [hasSession, sessionId]);

  const handleSelectVersion = async (versionId) => {
    updateConfig("promptVersionId", versionId || null);
    if (!versionId) {
      updateConfig("agentPrompt", "");
      return;
    }

    setVersionLoading(true);
    try {
      const version = await getPromptVersion(versionId);
      if (Array.isArray(version.sections)) {
        setPromptSections(version.sections);
        setActiveTab(0);
      }
      updateConfig("agentPrompt", version.prompt || "");
      if (version.model) updateConfig("model", version.model);
    } catch (err) {
      console.error("Failed to load prompt version", err);
    } finally {
      setVersionLoading(false);
    }
  };

  const handleSaveVersion = async () => {
    const name = versionName.trim();
    if (!name || versionLoading) return;

    setVersionLoading(true);
    try {
      const version = await createPromptVersion(
        name,
        config.model,
        promptSections.filter(section => section.editable).map(section => ({
          heading: section.heading,
          content: section.content
        }))
      );
      setPromptVersions(previous => [version, ...previous]);
      setVersionName('');
      await handleSelectVersion(version.id || version._id?.$oid || version._id);
    } catch (err) {
      console.error("Failed to save prompt version", err);
    } finally {
      setVersionLoading(false);
    }
  };

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
              <AutoComplete
                placeholder="Search truck type..."
                value={config.truckType?.label || config.truckType}
                onChange={val => updateConfig("truckType", { label: val, value: val })}
                onSelect={val => updateConfig("truckType", { label: val, value: val })}
                localData={TRUCKS_LIST}
                disabled={hasSession}
              />
            </div>
            <div className={styles.formGroup} style={{ marginTop: '16px' }}>
              <label>Select Transporter</label>
              <AutoComplete
                placeholder="Search transporter..."
                value={config.selectedTransporter}
                onChange={val => updateConfig("selectedTransporter", val)}
                onSelect={suggestion => updateConfig("selectedTransporter", {
                  transporter_id: suggestion.transporter_id,
                  transporter_name: suggestion.transporter_name,
                  isChecked: true
                })}
                localData={LSP_DATA}
                disabled={hasSession}
              />
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
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '600' }}>Prompt Version</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={config.promptVersionId || ''}
                  onChange={e => handleSelectVersion(e.target.value)}
                  disabled={hasSession || versionLoading}
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <option value="">Draft prompt</option>
                  {promptVersions.map(version => {
                    const id = version.id || version._id?.$oid || version._id;
                    return <option key={id} value={id}>{version.name}</option>;
                  })}
                </select>
                <input
                  value={versionName}
                  onChange={e => setVersionName(e.target.value)}
                  placeholder="Version name"
                  disabled={hasSession || versionLoading}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button
                  className={styles.btnSecondary}
                  onClick={handleSaveVersion}
                  disabled={hasSession || versionLoading || !versionName.trim() || promptSections.length === 0}
                  style={{ width: 'auto', whiteSpace: 'nowrap' }}
                >
                  Save Version
                </button>
              </div>
            </div>
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
          <button className={styles.btnPrimary} onClick={handleStartSession} disabled={loading || (appMode === 'existing' ? !config.adhocId : (!config.origin || !config.destination || !config.selectedTransporter || !config.placementDate || !config.expiryHours))}>
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
