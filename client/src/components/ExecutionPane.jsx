import React, { useState, useEffect } from 'react';
import AgentTraceView from './AgentTraceView';

export default function ExecutionPane({
  sessionId, sessionStatus, computedTarget, computedWalkaway,
  transcript, loading, handleBid, activeTab
}) {
  const [quoteInput, setQuoteInput] = useState('');
  const [activeTraceId, setActiveTraceId] = useState(null);

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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
      {/* Settings & Spot Details Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Mumbai, MH → Delhi, DL</h3>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Open 32 FT • 18 Tonnes • Standard Delivery</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Calculated Target</span>
            <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>₹{computedTarget?.toLocaleString()}</span>
          </div>
          <div style={{ width: '1px', height: '32px', background: 'var(--border-color)' }}></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Walkaway</span>
            <span style={{ fontSize: '13px', color: '#ef4444', fontWeight: 500 }}>₹{computedWalkaway?.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Chat messages */}
      <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {transcript.length === 0 && !loading && (
          <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', fontSize: '13px', marginTop: '40px' }}>
            Conversation started. Send an initial quote below.
          </div>
        )}

        {transcript.map((tr, idx) => (
          <React.Fragment key={idx}>
            {/* Transporter Message */}
            <div style={{ display: 'flex', gap: '12px', maxWidth: '85%' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                <svg width="16" height="16" fill="none" stroke="var(--text-secondary)" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>{tr.transporterName || 'Transporter'}</span>
                <div style={{ background: 'var(--bg-page)', border: '1px solid var(--border-color)', padding: '12px 16px', borderRadius: '0 12px 12px 12px', color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.5' }}>
                  Quoting ₹{tr.transporterQuote.toLocaleString()} for this spot.
                </div>
              </div>
            </div>

            {/* Agent Message */}
            <div style={{ display: 'flex', gap: '12px', maxWidth: '85%', alignSelf: 'flex-end', flexDirection: 'row-reverse' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)' }}>
                <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Lori AI Agent</span>
                <div style={{ background: tr.status === 'Rejected' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)', border: tr.status === 'Rejected' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(59, 130, 246, 0.2)', padding: '12px 16px', borderRadius: '12px 0 12px 12px', color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.5' }}>
                  {tr.langfuseTrace?.output?.rationale
                    ? tr.langfuseTrace.output.rationale
                    : `We are offering ₹${tr.agentCounter?.toLocaleString() || tr.transporterQuote.toLocaleString()}.`}
                </div>
              </div>
            </div>
          </React.Fragment>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: '12px', maxWidth: '85%', alignSelf: 'flex-end', flexDirection: 'row-reverse' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.7 }}>
              <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Lori AI Agent</span>
              <div style={{ padding: '12px 16px', color: 'var(--text-tertiary)', fontSize: '13px', fontStyle: 'italic', background: 'transparent' }}>
                Thinking...
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="pane execution-pane" style={{ flexDirection: 'column' }}>

      {activeTab === 'Observability' ? renderObservability() : renderLiveConsole()}

      {(sessionStatus === "Started" || sessionStatus === "Negotiating") && (
        <div className="bid-console" style={{ marginTop: '0' }}>
          <input
            type="number"
            placeholder="Input simulated string for quote (e.g. 48000)"
            value={quoteInput}
            onChange={e => setQuoteInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && quoteInput && onBidSubmit()}
            disabled={loading}
            style={{ border: 'none', background: 'transparent', outline: 'none' }}
          />
          <button className="btn-submit" onClick={onBidSubmit} disabled={loading || !quoteInput}>
            {loading ? '...' : 'SEND'}
          </button>
        </div>
      )}
    </div>
  );
}
