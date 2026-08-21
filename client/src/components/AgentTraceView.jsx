import React, { useState, useEffect } from 'react';
import { getSessionTraces, getTraceData } from '../api/langfuseApi';
import styles from '../styles/AgentTraceView.module.css';

// Langfuse-style Icons
const Icons = {
  root: <svg width="14" height="14" fill="none" stroke="#a855f7" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4M8 16h8" /></svg>,
  span: <svg width="14" height="14" fill="none" stroke="#3b82f6" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>,
  event: <svg width="14" height="14" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /></svg>,
  tool: <svg width="14" height="14" fill="none" stroke="#f97316" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 7h3a5 5 0 015 5 5 5 0 01-5 5h-3m-6 0H6a5 5 0 01-5-5 5 5 0 015-5h3m-3 5h12" /></svg>,
  generation: <svg width="14" height="14" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12H3m0 0l6-6m-6 6l6 6" /></svg>
};

function getIcon(type) {
  if (type === 'AGENT' || type === 'TRACE') return Icons.root;
  if (type === 'SPAN') return Icons.span;
  if (type === 'EVENT') return Icons.event;
  if (type === 'TOOL') return Icons.tool;
  if (type === 'GENERATION') return Icons.generation;
  return Icons.span;
}

export default function AgentTraceView({ activeTrace, loading: parentLoading, sessionId }) {
  const [selectedObsId, setSelectedObsId] = useState(null);
  const [showUsageBreakdown, setShowUsageBreakdown] = useState(false);
  const [langfuseTrace, setLangfuseTrace] = useState(null);
  const [loadingTrace, setLoadingTrace] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    async function fetchTrace() {
      if (!sessionId || !activeTrace) return;
      setErrorMsg(null);
      try {
        const traces = await getSessionTraces(sessionId);
        if (traces && traces.length > 0) {
          // Sort traces chronologically to natively map traces linearly to execution rounds, bypassing brittle name string mapping
          const sortedTraces = [...traces].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          const targetIndex = (activeTrace.round || 1) - 1;
          const matchedTrace = sortedTraces[targetIndex] || sortedTraces[sortedTraces.length - 1];

          const fullTrace = await getTraceData(matchedTrace.id);
          setLangfuseTrace(fullTrace);
        } else {
          setLangfuseTrace(null);
        }
      } catch (err) {
        console.error("Langfuse fetch error:", err);
        setErrorMsg(err.message);
      } finally {
        setLoadingTrace(false);
      }
    }

    setLoadingTrace(true);
    fetchTrace();

    const interval = setInterval(fetchTrace, 40000);
    return () => clearInterval(interval);
  }, [sessionId, activeTrace?.round]);

  if (parentLoading || loadingTrace) {
    return <div className={`${styles.container} ${styles.loading}`}>Loading Langfuse Trace...</div>;
  }

  if (errorMsg) {
    return (
      <div className={`${styles.container} ${styles.emptyState}`}>
        <div style={{ color: 'var(--brand-agent)' }}>Failed to load trace: {errorMsg}</div>
        <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>Ensure VITE_LANGFUSE_PUBLIC_KEY is set in .env</div>
      </div>
    );
  }

  if (!activeTrace || !langfuseTrace) {
    return (
      <div className={`${styles.container} ${styles.emptyState}`}>
        <div>Select a round to view Langfuse trace</div>
      </div>
    );
  }

  const lf = langfuseTrace;
  const observations = [...(lf.observations || [])].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // Root trace object
  const rootObs = {
    id: lf.id,
    name: lf.name,
    type: 'TRACE',
    startTime: lf.timestamp,
    latency: lf.latency,
    input: lf.input,
    output: lf.output,
    metadata: lf.metadata,
    totalCost: lf.totalCost
  };

  const selectedData = selectedObsId === lf.id ? rootObs : observations.find(o => o.id === selectedObsId) || rootObs;
  const isRootSelected = selectedData.id === lf.id;

  const formattedTime = lf.timestamp.replace('T', ' ').substring(0, 23);

  // Derive total tokens from the generation observation explicitly, if it exists in data
  const genObs = observations.find(o => o.type === 'GENERATION' && (o.usage || o.usageDetails));
  const usageData = genObs?.usage || genObs?.usageDetails;

  const tokensInfoStr = usageData
    ? `${usageData.input || usageData.promptTokens || 0} prompt → ${usageData.output || usageData.completionTokens || 0} completion (Σ ${usageData.total || usageData.totalTokens || 0})`
    : null;

  return (
    <div className={styles.container}>

      {/* ---------------- LEFT PANE: OBSERVATION TREE ---------------- */}
      <div className={styles.leftPane}>
        <div className={styles.treeHeader}>
          <div className={styles.treeLabel}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" /></svg> Tree
          </div>
          <span className={styles.timelineLabel}>Timeline</span>
        </div>

        <div className={styles.treeView}>
          {/* Root Level Item */}
          <div
            onClick={() => setSelectedObsId(lf.id)}
            className={`${styles.treeItem} ${isRootSelected ? styles.selected : ''}`}
          >
            <div className={styles.iconWrapper}>{getIcon('TRACE')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{lf.name}</span>
              <span style={{ fontSize: '11px', color: '#ef4444' }}>{lf.latency.toFixed(2)}s <span style={{ marginLeft: '4px' }}>Σ ${(lf.totalCost || 0).toFixed(6)}</span></span>
            </div>
          </div>

          {/* Children Items */}
          {observations.map(obs => {
            const isSelected = selectedObsId === obs.id;
            return (
              <div
                key={obs.id}
                onClick={() => setSelectedObsId(obs.id)}
                className={`${styles.childItem} ${isSelected ? styles.selected : ''}`}
              >
                {/* Vertical Tree Line Guide */}
                <div className={styles.verticalLine}></div>
                {/* Horizontal branch */}
                <div className={styles.horizontalLine}></div>

                <div className={`${styles.iconWrapper} ${isSelected ? styles.selected : ''}`}>{getIcon(obs.type)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span className={`${styles.itemLabel} ${isSelected ? styles.selected : ''}`}>
                    {obs.name}
                  </span>
                  {obs.latency > 0 && (
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      {obs.latency.toFixed(2)}s
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------------- RIGHT PANE: DETAIL VIEW ---------------- */}
      <div className={styles.rightPane}>

        {/* Top Header / Badges */}
        <div className={styles.detailHeader}>
          <div className={styles.detailTitle}>
            {getIcon(selectedData.type)}
            <span className={styles.detailName}>{selectedData.name}</span>
          </div>

          <div className={styles.detailTime}>
            {formattedTime}
          </div>

          <div className={styles.badges}>
            {isRootSelected && <span className={styles.badge}>Latency: {lf.latency}s</span>}
            <span className={`${styles.badge} ${styles.badgeInteractive}`}>
              Session: {lf.sessionId}
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>
            </span>
            <span className={styles.badge}>Env: {lf.environment}</span>
            {isRootSelected && <span className={styles.badge}>${(lf.totalCost || 0).toFixed(6)} ⓘ</span>}
            {isRootSelected && tokensInfoStr && (
              <span
                className={`${styles.badge} ${styles.badgeInteractive}`}
                onMouseEnter={() => setShowUsageBreakdown(true)}
                onMouseLeave={() => setShowUsageBreakdown(false)}
              >
                {tokensInfoStr}
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 16v-4m0-4h.01"></path></svg>

                {showUsageBreakdown && usageData && (
                  <div className={styles.usageDropdown}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>Usage breakdown</strong>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {Object.entries(usageData)
                        .filter(([k]) => k !== 'total' && k !== 'totalTokens')
                        .map(([key, value]) => (
                          <div key={key} className={styles.usageRow}>
                            <span>{key}</span>
                            <span>{Number(value).toLocaleString()}</span>
                          </div>
                        ))}
                    </div>

                    <div className={styles.usageTotal}>
                      <span>Total usage</span>
                      <span>{Number(usageData.total || usageData.totalTokens || 0).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </span>
            )}
          </div>

          {/* Tab Bar Map */}
          <div className={styles.tabs}>
            <div className={`${styles.tab} ${styles.active}`}>Preview</div>
            <div className={styles.tab}>Scores</div>
            <div className={styles.tab}>Log View</div>
          </div>

          {/* Tags (Only for root usually) */}
          {isRootSelected && lf.tags && lf.tags.length > 0 && (
            <div className={styles.tagsContainer}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Tags</span>
              {lf.tags.map(t => (
                <span key={t} className={styles.tag}>
                  <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Payload Content Area */}
        <div className={styles.payloadArea}>

          {selectedData.input && (
            <div className={styles.payloadSection}>
              <div className={styles.payloadHeader}>
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                Input
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>{typeof selectedData.input === 'object' && Object.keys(selectedData.input).length + ' keys'}</span>
              </div>
              <div className={`${styles.payloadContent} ${styles.input}`}>
                <pre className={styles.payloadPre}>
                  {typeof selectedData.input === 'string'
                    ? `input: ${JSON.stringify(selectedData.input)}`
                    : `input: ${JSON.stringify(selectedData.input, null, 2)}`
                  }
                </pre>
              </div>
            </div>
          )}

          {selectedData.output && (
            <div className={styles.payloadSection}>
              <div className={styles.payloadHeader}>
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                Output
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>{typeof selectedData.output === 'object' && Object.keys(selectedData.output).length + ' keys'}</span>
              </div>
              <div className={`${styles.payloadContent} ${styles.output}`}>
                <pre className={styles.payloadPre}>
                  {typeof selectedData.output === 'string'
                    ? `output: ${JSON.stringify(selectedData.output)}`
                    : `output: ${JSON.stringify(selectedData.output, null, 2)}`}
                </pre>
              </div>
            </div>
          )}

          {(!selectedData.input && !selectedData.output) && (
            <div className={styles.noPayload}>
              No payload data for this selected span.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
