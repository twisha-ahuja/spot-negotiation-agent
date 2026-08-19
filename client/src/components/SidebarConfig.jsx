import React, { useState, useEffect } from 'react';
import AutoComplete from './Autocomplete';
import LSP_DATA from './lsp.json';
import { AUTOCOMPLETE_API } from '../api/urls';
import styles from '../styles/SidebarConfig.module.css';

export default function SidebarConfig({ appMode, config, updateConfig, handleStartSession, loading, hasSession, setSpotDetails }) {
  const [lsps, setLsps] = useState([]);

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
                  <option value="20 MT MXL Container">20 MT MXL Container</option>
                  <option value="24 MT MXL Container">24 MT MXL Container</option>
                  <option value="32 FT SXL Container">32 FT SXL Container</option>
                  <option value="32 FT MXL Container">32 FT MXL Container</option>
                </select>
                <svg className={styles.selectIcon} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
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
              <label>Expiry Timestamp</label>
              <input
                type="datetime-local"
                value={config.expiryTimestamp}
                onChange={e => updateConfig("expiryTimestamp", e.target.value)}
                disabled={hasSession}
                style={{ width: '100%' }}
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
                style={{ width: '100%', appearance: 'none', paddingRight: '32px' }}
              >
                <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
                <option value="claude-3-5-haiku">claude-3-5-haiku</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                <option value="gemini-3.0-pro">gemini-3.0-pro</option>
                <option value="gemini-3.0-flash">gemini-3.0-flash</option>
              </select>
              <svg className={styles.selectIcon} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label>Agent prompt</label>
            <textarea
              rows={8}
              value={config.agentPrompt}
              onChange={e => updateConfig("agentPrompt", e.target.value)}
              disabled={hasSession}
              className={styles.codeBlock}
              spellCheck="false"
            />
          </div>
        </div>
      )}

      <div className={styles.sidebarGroup} style={{ background: 'transparent', border: 'none', padding: 0 }}>
        {!hasSession ? (
          <button className={styles.btnPrimary} onClick={handleStartSession} disabled={loading || (appMode === 'existing' ? !config.adhocId : (!config.origin || !config.destination || !config.selectedTransporter || !config.placementDate || !config.expiryTimestamp))}>
            {loading ? 'Initializing...' : 'Run Scenario'}
          </button>
        ) : (
          <button className={styles.btnSecondary} onClick={() => window.location.reload()} style={{ width: '100%', marginTop: '16px' }}>
            Reset Session
          </button>
        )}
      </div>
    </div>
  );
}
