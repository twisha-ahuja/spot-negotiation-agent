import React, { useState, useEffect } from 'react';
import AgentTraceView from './AgentTraceView';
import styles from '../styles/ExecutionPane.module.css';

export default function ExecutionPane({
  sessionId, computedTarget, computedFair, computedWalkaway, computingRates, setComputedTarget, setComputedWalkaway,
  onSetTargetRate, transcriptsByTransporter, selectedTransporters, loading, handleBid, activeTab, spotDetails, pendingQuoteByTransporter
}) {
  const [quoteInput, setQuoteInput] = useState('');
  const [activeTraceId, setActiveTraceId] = useState(null);
  const [obsTransporterId, setObsTransporterId] = useState(null);

  // Local state for manual input before saving
  const [tempTarget, setTempTarget] = useState('');

  // Local state for toggling rationale visibility
  const [expandedReasonings, setExpandedReasonings] = useState({});

  const toggleReasoning = (traceId) => {
    setExpandedReasonings(prev => ({ ...prev, [traceId]: !prev[traceId] }));
  };

  const isObservability = activeTab === 'Observability';
  const activeTransporterId = isObservability ? null : activeTab;
  const transcript = activeTransporterId ? (transcriptsByTransporter?.[activeTransporterId] || []) : [];
  const pendingQuote = activeTransporterId ? (pendingQuoteByTransporter?.[activeTransporterId] ?? null) : null;
  const activeTransporter = selectedTransporters?.find(t => t.transporter_id === activeTransporterId);

  // Default the Observability transporter switcher to the currently active Live Console tab
  useEffect(() => {
    if (!isObservability) return;
    if (obsTransporterId && selectedTransporters?.some(t => t.transporter_id === obsTransporterId)) return;
    const fallback = (activeTransporterId && selectedTransporters?.some(t => t.transporter_id === activeTransporterId))
      ? activeTransporterId
      : selectedTransporters?.[0]?.transporter_id || null;
    setObsTransporterId(fallback);
  }, [isObservability, activeTransporterId, selectedTransporters]);

  const obsTranscript = obsTransporterId ? (transcriptsByTransporter?.[obsTransporterId] || []) : [];

  // Auto-select newest trace within the transporter currently shown in Observability
  useEffect(() => {
    if (obsTranscript.length > 0) {
      setActiveTraceId(obsTranscript[obsTranscript.length - 1].traceId);
    } else {
      setActiveTraceId(null);
    }
  }, [obsTranscript]);

  const onBidSubmit = () => {
    handleBid(activeTransporterId, quoteInput);
    setQuoteInput('');
  };

  if (!sessionId) {
    return (
      <div className={`${styles.executionPane} ${styles.emptyState}`}>
        <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" className={styles.emptyStateIcon}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path>
        </svg>
        <p>No active pipeline initialized. Run scenario from the left pane.</p>
      </div>
    );
  }

  const activeTrace = obsTranscript.find(t => t.traceId === activeTraceId);

  const renderObservability = () => (
    <div className={styles.executionSplit}>
      {/* Middle Column: List of Rounds */}
      <div className={styles.roundsColumn}>
        <div className={styles.roundsHeader}>
          <div className={styles.roundsTitle}>
            <h3 className={styles.roundsTitleText}>Session Traces</h3>
            <span className={styles.roundsCount}>{obsTranscript.length} total</span>
          </div>

          <div style={{ position: 'relative' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" className={styles.searchIcon}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search traces..."
              className={styles.searchInput}
            />
          </div>
        </div>

        {selectedTransporters?.length > 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '0 16px 12px' }}>
            {selectedTransporters.map(t => (
              <button
                key={t.transporter_id}
                onClick={() => setObsTransporterId(t.transporter_id)}
                style={{
                  padding: '4px 10px', borderRadius: '999px', fontSize: '11px', cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                  background: obsTransporterId === t.transporter_id ? 'var(--brand-agent)' : 'var(--bg-surface)',
                  color: obsTransporterId === t.transporter_id ? 'var(--brand-agent-text, #fff)' : 'var(--text-secondary)',
                  fontWeight: obsTransporterId === t.transporter_id ? 600 : 400
                }}
              >
                {t.transporter_name}
              </button>
            ))}
          </div>
        )}

        <div className={styles.roundsList}>
          {obsTranscript.map((tr, i) => {
            const isActive = activeTraceId === tr.traceId;
            return (
              <div
                key={tr.traceId}
                onClick={() => setActiveTraceId(tr.traceId)}
                className={`${styles.roundCard} ${isActive ? styles.active : styles.inactive}`}
              >
                <div className={styles.roundCardHeader}>
                  <div className={`${styles.roundCardTitle} ${isActive ? styles.active : styles.inactive}`}>
                    Round {tr.round}: ₹{tr.transporterQuote}
                  </div>
                  <span className={`${styles.roundCardStatus} ${tr.status === 'Accepted' ? styles.accepted : styles.ongoing}`}>
                    {tr.status?.toLowerCase() || 'unknown'}
                  </span>
                </div>

                <div className={styles.roundCardTraceId}>
                  {tr.traceId} • agent.negotiate_round
                </div>

                <div className={styles.roundCardMetrics}>
                  <span className={styles.metricItem}>
                    <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {tr.latency}
                  </span>
                  <span className={styles.metricItem}>
                    <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                    {tr.tokens} tok
                  </span>
                  <span className={styles.metricItem}>
                    {tr.cost}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Trace Details */}
      <AgentTraceView
        activeTrace={activeTrace}
        loading={loading}
        sessionId={obsTransporterId ? `${sessionId}:${obsTransporterId}` : null}
      />
    </div>
  );

  const renderLiveConsole = () => (
    <div className={styles.liveConsole}>

      {/* Spot Details Header + Target Rates */}
      <div className={styles.headerRow}>
        <div className={styles.headerText}>
          <h2 className={styles.headerTitle}>
            {spotDetails ? `${spotDetails.origin?.location_name || spotDetails.originCity || spotDetails.origin || 'Unknown'} → ${spotDetails.destination?.location_name || spotDetails.destCity || spotDetails.destination || 'Unknown'}` : 'Awaiting Valid Spot Context...'}
          </h2>
          <span className={styles.headerSubtitle}>
            {spotDetails ? `${spotDetails.truckType?.label || spotDetails.truckType || 'Truck Type'} • ${spotDetails.dateOfPlacement || spotDetails.placementDate || ''}` : 'Please configure the spot in the sidebar'}
            {activeTransporter && ` • Negotiating with ${activeTransporter.transporter_name}`}
          </span>
        </div>

        <div>
          {computingRates ? (
            <div className={styles.ratesBox} style={{ justifyContent: 'center', height: '42px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>⚙️ Rates are being calculated...</span>
            </div>
          ) : computedTarget ? (
            <div className={styles.ratesBox}>
              <div className={styles.rateGroup}>
                <span className={styles.rateLabel}>Target Rate</span>
                <span className={`${styles.rateValue} ${styles.target}`}>₹{computedTarget?.toLocaleString()}</span>
              </div>
              <div className={styles.divider}></div>
              <div className={styles.rateGroup}>
                <span className={`${styles.rateLabel} ${styles.fair}`}>Fair Rate</span>
                <span className={`${styles.rateValue} ${styles.fair}`}>₹{computedFair?.toLocaleString()}</span>
              </div>
              <div className={styles.divider}></div>
              <div className={styles.rateGroup}>
                <span className={styles.rateLabel}>Walkaway Line</span>
                <span className={`${styles.rateValue} ${styles.walkaway}`}>₹{computedWalkaway?.toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <div className={styles.manualInputGroup} style={{ flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--status-err)' }}>No target rates found, set manually.</span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="number"
                  value={tempTarget}
                  onChange={e => setTempTarget(e.target.value)}
                  className={styles.manualInput}
                  placeholder="Target Rate (₹)"
                  min="1"
                />
                <button
                  onClick={() => onSetTargetRate(tempTarget)}
                  disabled={!tempTarget || Number(tempTarget) <= 0 || loading}
                  className={styles.manualButton}
                  style={{ cursor: (!tempTarget || Number(tempTarget) <= 0 || loading) ? 'not-allowed' : 'pointer', opacity: (!tempTarget || Number(tempTarget) <= 0 || loading) ? 0.5 : 1 }}>
                  {loading ? 'Setting...' : 'Set Rate'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Negotiation Transcript Panel */}
      <div className={styles.transcriptPanel}>
        <div className={styles.transcriptHeader}>
          <span className={styles.transcriptHeaderText}>NEGOTIATION TRANSCRIPT</span>
          <span className={styles.transcriptHeaderText}>{transcript.length} ROUNDS</span>
        </div>

        <div className={styles.transcriptBody}>
          {loading && transcript.length === 0 ? (
            <div className={styles.transcriptEmpty} style={{ opacity: 0.7 }}>
              <div className={styles.loaderSpinner} style={{ width: 24, height: 24, border: '2px solid var(--border-active)', borderTop: '2px solid var(--text-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              <span className={styles.transcriptEmptyText}>Initializing Simulation Workspace...</span>
            </div>
          ) : transcript.length === 0 ? (
            <div className={styles.transcriptEmpty}>
              <svg width="24" height="24" fill="none" stroke="var(--border-active)" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
              <span className={styles.transcriptEmptyText}>Compute rates first, then submit a bid.</span>
            </div>
          ) : (
            transcript.map((tr, idx) => (
              <React.Fragment key={idx}>
                {/* Transporter Message (User - Right) */}
                <div className={styles.messageRight}>
                  <span className={styles.messageAuthorRight}>
                    You ({tr.transporterName || 'Transporter'})
                  </span>
                  <div className={styles.messageBubbleRowRight}>
                    <div className={styles.avatarRight}>
                      <svg width="14" height="14" fill="none" stroke="var(--text-secondary)" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <div className={styles.bubbleRight}>
                      <strong>₹{tr.transporterQuote.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>

                {/* Agent Message (Other - Left) */}
                <div className={styles.messageLeft}>
                  <span className={styles.messageAuthorLeft}>
                    Lorri AI Agent
                  </span>
                  <div className={styles.messageBubbleRowLeft}>
                    <div className={styles.avatarLeft}>
                      <svg width="14" height="14" fill="none" stroke="var(--brand-agent-text)" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <div className={styles.bubbleLeft}>
                        {tr.negotiate === true
                          ? <strong>₹{tr.agentCounter?.toLocaleString()}</strong>
                          : <span style={{ fontStyle: 'italic', color: 'black' }}>Declined to counter.</span>}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', paddingLeft: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                          {tr.timestamp ? new Date(tr.timestamp.endsWith('Z') ? tr.timestamp : `${tr.timestamp}Z`).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        {tr.reasoning && (
                          <button
                            onClick={() => toggleReasoning(tr.traceId)}
                            style={{ background: 'none', border: 'none', color: 'var(--brand-agent)', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                          >
                            {expandedReasonings[tr.traceId] ? 'Hide Reasoning' : 'View Reasoning'}
                          </button>
                        )}
                      </div>

                      {expandedReasonings[tr.traceId] && tr.reasoning && (
                        <div style={{ marginTop: '8px', padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5', maxWidth: '300px' }}>
                          {tr.reasoning}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            ))
          )}

          {loading && pendingQuote && (
            <div className={styles.messageRight}>
              <span className={styles.messageAuthorRight}>
                You (Sending...)
              </span>
              <div className={styles.messageBubbleRowRight}>
                <div className={styles.avatarRight}>
                  <svg width="14" height="14" fill="none" stroke="var(--text-secondary)" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div className={styles.bubbleRight}>
                  <strong>₹{Number(pendingQuote).toLocaleString()}</strong>
                </div>
              </div>
            </div>
          )}

          {loading && pendingQuote && (
            <div className={styles.messageLeft}>
              <span className={styles.messageAuthorLeft}>Lorri AI Agent</span>
              <div className={styles.messageBubbleRowLeft}>
                <div className={styles.avatarLeft} style={{ opacity: 0.8 }}>
                  <svg width="14" height="14" fill="none" stroke="var(--brand-agent-text)" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div className={styles.pendingBubble}>
                  Thinking ...
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Console Input Area (Attached to bottom of transcript box) */}
        <div className={styles.consoleInputArea}>
          <div className={styles.consoleInputRow}>
            <input
              type="number"
              placeholder={computedTarget ? "Transporter quote (₹)" : "Set target rate first..."}
              value={quoteInput}
              onChange={e => setQuoteInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && quoteInput && computedTarget && onBidSubmit()}
              disabled={loading || !computedTarget}
              className={styles.quoteInput}
            />
            <button
              onClick={onBidSubmit}
              disabled={loading || !quoteInput || !computedTarget}
              className={styles.submitButton}
              style={{ cursor: (loading || !quoteInput || !computedTarget) ? 'not-allowed' : 'pointer', opacity: (loading || !quoteInput || !computedTarget) ? 0.6 : 1 }}
            >
              Submit bid
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.executionPane}>
      {activeTab === 'Observability' ? renderObservability() : renderLiveConsole()}
    </div>
  );
}
