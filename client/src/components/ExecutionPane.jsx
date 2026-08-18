import React, { useState, useEffect } from 'react';
import AgentTraceView from './AgentTraceView';

export default function ExecutionPane({
  sessionId, sessionStatus, computedTarget, setComputedTarget, computedWalkaway, setComputedWalkaway,
  transcript, loading, handleBid, activeTab, spotDetails, pendingQuote
}) {
  const [quoteInput, setQuoteInput] = useState('');
  const [activeTraceId, setActiveTraceId] = useState(null);

  // Local state for manual input before saving
  const [tempTarget, setTempTarget] = useState('');
  const [tempWalkaway, setTempWalkaway] = useState('');

  const handleSaveRates = () => {
    if (tempTarget) setComputedTarget(Number(tempTarget));
    if (tempWalkaway) setComputedWalkaway(Number(tempWalkaway));
  };

  // Auto-select newest trace
  useEffect(() => {
    if (transcript.length > 0) {
      setActiveTraceId(transcript[transcript.length - 1].traceId);
    }
  }, [transcript]);

  const onBidSubmit = () => {
    handleBid(quoteInput);
    setQuoteInput('');
  };

  if (!sessionId) {
    return (
      <div className="pane execution-pane" style={{ justifyContent: 'center', alignItems: 'center', color: 'var(--text-tertiary)' }}>
        <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.2, marginBottom: '16px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path>
        </svg>
        <p>No active pipeline initialized. Run scenario from the left pane.</p>
      </div>
    );
  }

  const activeTrace = transcript.find(t => t.traceId === activeTraceId);

  const renderObservability = () => (
    <div className="execution-split">
      {/* Middle Column: List of Rounds */}
      <div className="rounds-list" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '8px', flex: 1, minHeight: 0 }}>
        <div className="rounds-header" style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.5px' }}>Session Traces</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-surface)', padding: '2px 8px', borderRadius: '4px' }}>{transcript.length} total</span>
          </div>

          <div style={{ position: 'relative' }}>
            <svg width="14" height="14" fill="none" stroke="var(--text-tertiary)" viewBox="0 0 24 24" style={{ position: 'absolute', left: '10px', top: '9px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search traces..."
              style={{
                width: '100%', background: 'var(--bg-page)', border: '1px solid var(--border-color)',
                borderRadius: '6px', padding: '8px 8px 8px 30px',
                fontSize: '12px', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        <div className="round-cards" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-panel)' }}>
          {transcript.map((tr, idx) => {
            const isActive = activeTraceId === tr.traceId;
            return (
              <div
                key={tr.traceId}
                onClick={() => setActiveTraceId(tr.traceId)}
                style={{
                  padding: '16px',
                  borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  background: isActive ? 'var(--bg-surface)' : 'transparent',
                  borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
                  display: 'flex', flexDirection: 'column', gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    Round {tr.round}: ₹{tr.transporterQuote}
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
                    padding: '2px 6px', borderRadius: '4px',
                    color: tr.status === 'Accepted' ? '#10b981' : '#a78bfa',
                    background: tr.status === 'Accepted' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(168, 85, 247, 0.1)',
                    border: `1px solid ${tr.status === 'Accepted' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(168, 85, 247, 0.2)'}`
                  }}>
                    {tr.status === 'Accepted' ? 'pass' : 'ongoing'}
                  </span>
                </div>

                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                  {tr.traceId} • agent.negotiate_round
                </div>

                <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {tr.latency}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                    {tr.tokens} tok
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {tr.cost}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Trace Details */}
      <AgentTraceView activeTrace={activeTrace} loading={loading} />
    </div>
  );

  const renderLiveConsole = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0 }}>

      {/* Spot Details Header + Target Rates */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ flexShrink: 0 }}>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {spotDetails ? `${spotDetails.originCity}${spotDetails.originState ? ', ' + spotDetails.originState : ''} → ${spotDetails.destCity}${spotDetails.destState ? ', ' + spotDetails.destState : ''}` : 'Awaiting Valid Spot Context...'}
          </h2>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {spotDetails ? `${spotDetails.truckType} • ${spotDetails.tonnage} Tonnes` : 'Please configure the spot in the sidebar'}
          </span>
        </div>

        <div>
          {computedTarget ? (
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', background: 'var(--bg-surface)', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Target Rate</span>
                <span style={{ fontSize: '14px', color: 'var(--status-ok)', fontWeight: 600 }}>₹{computedTarget?.toLocaleString()}</span>
              </div>
              <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Walkaway Line</span>
                <span style={{ fontSize: '14px', color: 'var(--status-err)', fontWeight: 600 }}>₹{computedWalkaway?.toLocaleString()}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Negotiation Transcript Panel */}
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.5px' }}>NEGOTIATION TRANSCRIPT</span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.5px' }}>{transcript.length} ROUNDS</span>
        </div>

        <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {transcript.length === 0 ? (
            <div style={{ margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <svg width="24" height="24" fill="none" stroke="var(--border-active)" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Compute rates first, then submit a bid.</span>
            </div>
          ) : (
            transcript.map((tr, idx) => (
              <React.Fragment key={idx}>
                {/* Transporter Message (User - Right) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '85%', alignSelf: 'flex-end', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500, marginRight: '40px' }}>
                    You ({tr.transporterName || 'Transporter'})
                  </span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexDirection: 'row-reverse' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="14" height="14" fill="none" stroke="var(--text-secondary)" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', padding: '12px 16px', borderRadius: '16px 16px 4px 16px', color: 'var(--text-primary)', fontSize: '13.5px', lineHeight: '1.5' }}>
                      Quoting <strong>₹{tr.transporterQuote.toLocaleString()}</strong> for this spot.
                    </div>
                  </div>
                </div>

                {/* Agent Message (Other - Left) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '85%' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500, marginLeft: '40px' }}>
                    Lorri AI Agent
                  </span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--brand-agent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(14, 165, 233, 0.25)' }}>
                      <svg width="14" height="14" fill="none" stroke="var(--brand-agent-text)" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <div style={{ background: 'var(--brand-agent)', padding: '12px 16px', borderRadius: '16px 16px 16px 4px', color: 'var(--brand-agent-text)', fontSize: '13.5px', lineHeight: '1.5', fontWeight: 500, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                      {tr.langfuseTrace?.output?.rationale
                        ? tr.langfuseTrace.output.rationale
                        : `We are offering ₹${tr.agentCounter?.toLocaleString() || tr.transporterQuote.toLocaleString()}.`}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            ))
          )}

          {loading && pendingQuote && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '85%', alignSelf: 'flex-end', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500, marginRight: '40px' }}>
                You (Sending...)
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexDirection: 'row-reverse' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="14" height="14" fill="none" stroke="var(--text-secondary)" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', padding: '12px 16px', borderRadius: '16px 16px 4px 16px', color: 'var(--text-primary)', fontSize: '13.5px', lineHeight: '1.5' }}>
                  Quoting <strong>₹{Number(pendingQuote).toLocaleString()}</strong> for this spot.
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '85%' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500, marginLeft: '40px' }}>Lorri AI Agent</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--brand-agent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.8 }}>
                  <svg width="14" height="14" fill="none" stroke="var(--brand-agent-text)" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div style={{ padding: '12px 16px', color: 'var(--text-tertiary)', fontSize: '13px', fontStyle: 'italic', background: 'transparent' }}>
                  Processing strategy...
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Console Input Area (Attached to bottom of transcript box) */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-pane)' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <input
              type="number"
              placeholder="Transporter quote (₹)"
              value={quoteInput}
              onChange={e => setQuoteInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && quoteInput && onBidSubmit()}
              disabled={loading || sessionStatus === "Idle"}
              style={{ flex: 1, padding: '10px 16px', border: '1px solid var(--border-active)', background: 'var(--bg-page)', borderRadius: '6px', outline: 'none', color: 'var(--text-primary)', fontSize: '13px' }}
            />
            <button
              onClick={onBidSubmit}
              disabled={loading || !quoteInput}
              style={{
                background: 'var(--brand-agent)', color: 'var(--brand-agent-text)',
                border: 'none', padding: '10px 20px', borderRadius: '6px',
                fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center',
                gap: '8px', cursor: (loading || !quoteInput) ? 'not-allowed' : 'pointer',
                opacity: (loading || !quoteInput) ? 0.6 : 1, transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}>
              Submit bid
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="pane execution-pane" style={{ flexDirection: 'column', padding: '32px', overflow: 'hidden' }}>
      {activeTab === 'Observability' ? renderObservability() : renderLiveConsole()}
    </div>
  );
}
