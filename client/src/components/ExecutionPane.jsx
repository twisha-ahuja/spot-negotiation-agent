import React, { useState, useEffect, useRef } from 'react';
import AgentTraceView from './AgentTraceView';
import styles from '../styles/ExecutionPane.module.css';

export default function ExecutionPane({
  sessionId, computedTarget, computedFair, computedWalkaway, computingRates, setComputedTarget, setComputedWalkaway,
  onSetTargetRate, transcriptsByTransporter, selectedTransporters, loading, handleBid, activeTab, setActiveTab, spotDetails, pendingQuoteByTransporter,
  coldLaneInfo, expiryDate
}) {
  // Cold lane doesn't need a target rate to run right now (the deterministic agent's own
  // discovery/momentum bounds don't read it) — only cold-lane spots skip the "set target rate
  // first" gate below; hot-lane playground runs keep the existing required-target-rate behavior.
  const isColdLane = !!coldLaneInfo;
  const canQuote = !!computedTarget || isColdLane;
  const [quoteInput, setQuoteInput] = useState('');
  const [activeTraceId, setActiveTraceId] = useState(null);
  const [obsTransporterId, setObsTransporterId] = useState(null);
  const transcriptBodyRef = useRef(null);

  // Local state for manual input before saving
  const [tempTarget, setTempTarget] = useState('');

  // Local state for toggling rationale visibility
  const [expandedReasonings, setExpandedReasonings] = useState({});
  const [transporterQuoteInputs, setTransporterQuoteInputs] = useState({});

  const toggleReasoning = (traceId) => {
    setExpandedReasonings(prev => ({ ...prev, [traceId]: !prev[traceId] }));
  };

  // Live expiry countdown — ticks every second off the spot's lane_details.expiry_date, which
  // playground stores as an ISO string with its own offset (e.g. +05:30), so `new Date(...)`
  // parses it correctly regardless of the browser's own timezone.
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatCountdown = (dateStr, nowMs) => {
    if (!dateStr) return null;
    const remainingMs = new Date(dateStr).getTime() - nowMs;
    if (Number.isNaN(remainingMs)) return null;
    if (remainingMs <= 0) return 'Expired';
    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
  };

  const expiryCountdown = formatCountdown(expiryDate, nowTick);

  const formatMoney = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return '-';
    return `₹${numeric.toLocaleString()}`;
  };

  const getLastTransporterQuote = (transporterId) => {
    const transporterHistory = transcriptsByTransporter?.[transporterId] || [];
    return transporterHistory.length > 0 ? transporterHistory[transporterHistory.length - 1].transporterQuote : null;
  };

  const onTransporterQuoteInputChange = (transporterId, value) => {
    setTransporterQuoteInputs(prev => ({ ...prev, [transporterId]: value }));
  };

  const submitQuoteForTransporter = (transporterId) => {
    const nextQuote = transporterQuoteInputs[transporterId] ?? '';
    if (!nextQuote || Number(nextQuote) <= 0) return;
    handleBid(transporterId, nextQuote);
    setTransporterQuoteInputs(prev => ({ ...prev, [transporterId]: '' }));
  };

  const selectTransporter = (transporterId) => {
    setActiveTab(transporterId);
    setQuoteInput('');
  };

  const isObservability = activeTab === 'Observability';
  const activeTransporterId = isObservability ? null : activeTab;
  const transcript = activeTransporterId ? (transcriptsByTransporter?.[activeTransporterId] || []) : [];
  const pendingQuote = activeTransporterId ? (pendingQuoteByTransporter?.[activeTransporterId] ?? null) : null;
  const isQuotePending = pendingQuote !== null;
  const activeTransporter = selectedTransporters?.find(t => t.transporter_id === activeTransporterId);

  // Real transporters can't raise a quote once submitted (the "no_bid_increment" company rule —
  // see agent.md's "General Rules") — enforced UI-side there too, so mirror it in the playground
  // rather than letting a test bid go up and produce a negotiation the agent would never see for
  // real. Compares against this transporter's own last submitted quote, not the agent's counter.
  const lastTransporterQuote = transcript.length > 0 ? transcript[transcript.length - 1].transporterQuote : null;
  const quoteInputNumber = quoteInput === '' ? null : Number(quoteInput);
  const quoteExceedsLastBid = lastTransporterQuote != null && quoteInputNumber != null && !isNaN(quoteInputNumber)
    && quoteInputNumber > lastTransporterQuote;

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

  useEffect(() => {
    if (isObservability) return;
    if (!transcriptBodyRef.current) return;
    transcriptBodyRef.current.scrollTop = transcriptBodyRef.current.scrollHeight;
  }, [isObservability, activeTransporterId, transcript, isQuotePending]);

  useEffect(() => {
    if (!sessionId) {
      setTempTarget('');
    }
  }, [sessionId]);

  const onBidSubmit = () => {
    if (quoteExceedsLastBid) return;
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
                    Round {tr.round}: {formatMoney(tr.transporterQuote)}
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
            {expiryCountdown && (
              <span style={{ marginLeft: '8px', fontVariantNumeric: 'tabular-nums', color: expiryCountdown === 'Expired' ? 'var(--brand-danger, #d64545)' : 'var(--text-secondary)' }}>
                • {expiryCountdown === 'Expired' ? 'Expired' : `Expires in ${expiryCountdown}`}
              </span>
            )}
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

      {isColdLane && (
        <div style={{ marginBottom: '16px', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--bg-surface)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700 }}>
            Cold Lane Configuration (read-only)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', padding: '10px 12px', fontSize: '12px' }}>
            <div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mode</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{coldLaneInfo.negotiationMode === 'get_me_best_price' ? 'Best price' : 'Get a truck'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rank visible</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{coldLaneInfo.rankVisible ? 'Yes' : 'No'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Max rounds / vendor</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{coldLaneInfo.maxRoundsPerTransporter ?? '—'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Model</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{coldLaneInfo.model || '—'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Opening anchor</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{coldLaneInfo.openingAnchorRate != null ? formatMoney(coldLaneInfo.openingAnchorRate) : '—'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rolling anchor</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{coldLaneInfo.rollingAnchorRate != null ? formatMoney(coldLaneInfo.rollingAnchorRate) : '—'}</div>
            </div>
          </div>
        </div>
      )}

      {selectedTransporters?.length > 0 && (
        <div style={{ marginBottom: '16px', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--bg-surface)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700 }}>
            Transporter Quote Board
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', padding: '10px' }}>
            {selectedTransporters.map((transport) => {
              const transporterId = transport.transporter_id;
              const currentInput = transporterQuoteInputs[transporterId] ?? '';
              const lastQuote = getLastTransporterQuote(transporterId);
              const pending = pendingQuoteByTransporter?.[transporterId] != null;
              const statusTone = pending ? 'var(--status-warn)' : (lastQuote != null ? 'var(--status-ok)' : 'var(--text-tertiary)');
              const quoteExceeds = lastQuote != null && currentInput !== '' && Number(currentInput) > Number(lastQuote);
              const canSubmit = canQuote && !!currentInput && Number(currentInput) > 0 && !pending && !quoteExceeds && !loading;

              return (
                <div
                  key={transporterId}
                  onClick={() => selectTransporter(transporterId)}
                  onFocus={() => selectTransporter(transporterId)}
                  onMouseDown={() => selectTransporter(transporterId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectTransporter(transporterId);
                    }
                  }}
                  style={{
                    border: activeTransporterId === transporterId ? '1px solid var(--brand-agent)' : '1px solid var(--border-color)',
                    borderRadius: '10px',
                    background: activeTransporterId === transporterId ? 'rgba(245, 158, 11, 0.04)' : 'var(--bg-panel)',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <div
                    onClick={() => selectTransporter(transporterId)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                  >
                    <strong style={{ fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{transport.transporter_name}</strong>
                    <span
                      style={{
                        fontSize: '9px',
                        color: statusTone,
                        border: '1px solid currentColor',
                        borderRadius: '999px',
                        padding: '2px 6px',
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {pending ? 'Pending' : (lastQuote != null ? 'Live' : 'New')}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <span>Last</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{lastQuote != null ? formatMoney(lastQuote) : '—'}</strong>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="number"
                      value={currentInput}
                      onFocus={() => selectTransporter(transporterId)}
                      onClick={() => selectTransporter(transporterId)}
                      onChange={e => onTransporterQuoteInputChange(transporterId, e.target.value)}
                      placeholder="Quote"
                      disabled={loading || pending || !canQuote}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        padding: '7px 8px',
                        fontSize: '12px'
                      }}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        submitQuoteForTransporter(transporterId);
                      }}
                      disabled={!canSubmit}
                      style={{
                        borderRadius: '8px',
                        border: 'none',
                        background: canSubmit ? 'var(--brand-agent)' : 'var(--bg-muted)',
                        color: canSubmit ? 'var(--brand-agent-text, #fff)' : 'var(--text-tertiary)',
                        padding: '7px 10px',
                        fontSize: '11px',
                        cursor: canSubmit ? 'pointer' : 'not-allowed',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Submit
                    </button>
                  </div>

                  {quoteExceeds && (
                    <div style={{ fontSize: '10px', color: 'var(--brand-danger, #d64545)' }}>
                      Above last bid.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Negotiation Transcript Panel */}
      <div className={styles.transcriptPanel}>
        <div className={styles.transcriptHeader}>
          <span className={styles.transcriptHeaderText}>
            {activeTransporter ? `${activeTransporter.transporter_name} NEGOTIATION SCRIPT` : 'NEGOTIATION SCRIPT'}
          </span>
          <span className={styles.transcriptHeaderText}>{transcript.length} ROUNDS</span>
        </div>

        <div ref={transcriptBodyRef} className={styles.transcriptBody}>
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
                      <strong>{formatMoney(tr.transporterQuote)}</strong>
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
                          ? <strong>{tr.agentCounter != null ? formatMoney(tr.agentCounter) : '—'}</strong>
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

          {isQuotePending && (
            <div className={styles.messageRight}>
              <span className={styles.messageAuthorRight}>You</span>
              <div className={styles.messageBubbleRowRight}>
                <div className={styles.avatarRight}>
                  <svg width="14" height="14" fill="none" stroke="var(--text-secondary)" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div className={styles.bubbleRight}>
                  <strong>{formatMoney(pendingQuote)}</strong>
                </div>
              </div>
            </div>
          )}

          {isQuotePending && (
            <div className={styles.messageLeft}>
              <span className={styles.messageAuthorLeft}>Lorri AI Agent</span>
              <div className={styles.messageBubbleRowLeft}>
                <div className={styles.avatarLeft}>
                  <svg width="14" height="14" fill="none" stroke="var(--brand-agent-text)" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div className={styles.bubbleLeft} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '10px 14px' }}>
                  <span className={styles.thinkingDot} style={{ animationDelay: '0ms' }}></span>
                  <span className={styles.thinkingDot} style={{ animationDelay: '150ms' }}></span>
                  <span className={styles.thinkingDot} style={{ animationDelay: '300ms' }}></span>
                  <style>{`
                    @keyframes thinkingBounce {
                      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                      30% { transform: translateY(-4px); opacity: 1; }
                    }
                  `}</style>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Console Input Area (Attached to bottom of transcript box) */}
        <div className={styles.consoleInputArea}>
          {quoteExceedsLastBid && (
            <div style={{ fontSize: '12px', color: 'var(--brand-danger, #d64545)', padding: '0 2px 6px' }}>
              A transporter can't raise their quote above their last bid ({formatMoney(lastTransporterQuote)}).
            </div>
          )}
          <div className={styles.consoleInputRow}>
            <input
              type="number"
              placeholder={canQuote ? "Transporter quote (₹)" : "Set target rate first..."}
              value={quoteInput}
              onChange={e => setQuoteInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && quoteInput && canQuote && !quoteExceedsLastBid && onBidSubmit()}
              disabled={loading || isQuotePending || !canQuote}
              className={styles.quoteInput}
            />
            <button
              onClick={onBidSubmit}
              disabled={loading || isQuotePending || !quoteInput || !canQuote || quoteExceedsLastBid}
              className={styles.submitButton}
              style={{ cursor: (loading || isQuotePending || !quoteInput || !canQuote || quoteExceedsLastBid) ? 'not-allowed' : 'pointer', opacity: (loading || isQuotePending || !quoteInput || !canQuote || quoteExceedsLastBid) ? 0.6 : 1 }}
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
