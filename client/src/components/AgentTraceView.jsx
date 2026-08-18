import React, { useState } from 'react';

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

export default function AgentTraceView({ activeTrace, loading }) {
  const [selectedObsId, setSelectedObsId] = useState(null);
  const [showUsageBreakdown, setShowUsageBreakdown] = useState(false);

  if (loading) {
    return <div className="trace-details" style={{ justifyContent: 'center', alignItems: 'center', color: 'var(--text-tertiary)' }}>Loading Langfuse Trace...</div>;
  }

  if (!activeTrace || !activeTrace.langfuseTrace) {
    return (
      <div className="trace-details" style={{ justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <div style={{ color: 'var(--text-tertiary)', textAlign: 'center' }}>
          Select a round to view Langfuse trace
        </div>
      </div>
    );
  }

  const lf = activeTrace.langfuseTrace;
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
    <div className="trace-details" style={{
      display: 'flex', flexDirection: 'row', padding: 0, gap: 0,
      border: '1px solid var(--border-color)', borderRadius: '8px',
      overflow: 'hidden', height: '100%', background: 'var(--bg-page)'
    }}>

      {/* ---------------- LEFT PANE: OBSERVATION TREE ---------------- */}
      <div style={{
        width: '320px', borderRight: '1px solid var(--border-color)',
        background: 'var(--bg-panel)', display: 'flex', flexDirection: 'column', overflowY: 'auto'
      }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'var(--bg-surface)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" /></svg> Tree
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', cursor: 'pointer' }}>Timeline</span>
        </div>

        <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column' }}>
          {/* Root Level Item */}
          <div
            onClick={() => setSelectedObsId(lf.id)}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              background: isRootSelected ? 'var(--bg-surface)' : 'transparent',
              display: 'flex', alignItems: 'flex-start', gap: '10px'
            }}
          >
            <div style={{ marginTop: '2px' }}>{getIcon('TRACE')}</div>
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
                style={{
                  padding: '6px 16px 6px 36px',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--bg-surface)' : 'transparent',
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  position: 'relative'
                }}
              >
                {/* Vertical Tree Line Guide */}
                <div style={{ position: 'absolute', left: '22px', top: '0', bottom: '0', width: '1px', background: 'var(--border-color)' }}></div>
                {/* Horizontal branch */}
                <div style={{ position: 'absolute', left: '22px', top: '14px', width: '10px', height: '1px', background: 'var(--border-color)' }}></div>

                <div style={{ marginTop: '2px', position: 'relative', zIndex: 2, background: isSelected ? 'var(--bg-surface)' : 'var(--bg-panel)' }}>{getIcon(obs.type)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span style={{ fontSize: '12px', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

        {/* Top Header / Badges */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            {getIcon(selectedData.type)}
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedData.name}</span>
          </div>

          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
            {formattedTime}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {isRootSelected && <span style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: '4px', fontSize: '11.5px', color: 'var(--text-primary)' }}>Latency: {lf.latency}s</span>}
            <span style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: '4px', fontSize: '11.5px', color: 'var(--text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              Session: {lf.sessionId}
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>
            </span>
            <span style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: '4px', fontSize: '11.5px', color: 'var(--text-primary)' }}>Env: {lf.environment}</span>
            {isRootSelected && <span style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: '4px', fontSize: '11.5px', color: 'var(--text-primary)' }}>${(lf.totalCost || 0).toFixed(6)} ⓘ</span>}
            {isRootSelected && tokensInfoStr && (
              <span 
                style={{ 
                  background: 'var(--bg-surface)', border: '1px solid var(--border-color)', 
                  padding: '4px 8px', borderRadius: '4px', fontSize: '11.5px', color: 'var(--text-primary)',
                  position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
                onMouseEnter={() => setShowUsageBreakdown(true)}
                onMouseLeave={() => setShowUsageBreakdown(false)}
              >
                {tokensInfoStr}
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 16v-4m0-4h.01"></path></svg>
                
                {showUsageBreakdown && usageData && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: '0', 
                    background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '6px',
                    width: '300px', padding: '16px', zIndex: 100,
                    boxShadow: 'var(--shadow)',
                    display: 'flex', flexDirection: 'column', gap: '16px',
                    cursor: 'default'
                  }}>
                    <strong style={{color: 'var(--text-primary)', fontSize: '14px'}}>Usage breakdown</strong>
                    
                    <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                      {Object.entries(usageData)
                        .filter(([k]) => k !== 'total' && k !== 'totalTokens')
                        .map(([key, value]) => (
                        <div key={key} style={{display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)'}}>
                          <span>{key}</span>
                          <span>{Number(value).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)', fontWeight: 600, borderTop: '1px solid var(--border-color)', paddingTop: '12px'}}>
                        <span>Total usage</span>
                        <span>{Number(usageData.total || usageData.totalTokens || 0).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </span>
            )}
          </div>

          {/* Tab Bar Map */}
          <div style={{ display: 'flex', gap: '20px', marginTop: '16px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ paddingBottom: '8px', fontSize: '13px', color: 'var(--text-primary)', borderBottom: '2px solid var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>Preview</div>
            <div style={{ paddingBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500 }}>Scores</div>
            <div style={{ paddingBottom: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500 }}>Log View</div>
          </div>

          {/* Tags (Only for root usually) */}
          {isRootSelected && lf.tags && lf.tags.length > 0 && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Tags</span>
              {lf.tags.map(t => (
                <span key={t} style={{ border: '1px solid var(--border-color)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Payload Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>

          {selectedData.input && (
            <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ padding: '8px 16px', background: 'var(--bg-surface)', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                Input
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>{typeof selectedData.input === 'object' && Object.keys(selectedData.input).length + ' keys'}</span>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'var(--font-mono)', overflowX: 'auto', borderLeft: '3px solid #3b82f6' }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {typeof selectedData.input === 'string'
                    ? `input: ${JSON.stringify(selectedData.input)}`
                    : `input: ${JSON.stringify(selectedData.input, null, 2)}`
                  }
                </pre>
              </div>
            </div>
          )}

          {selectedData.output && (
            <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ padding: '8px 16px', background: 'var(--bg-surface)', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                Output
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>{typeof selectedData.output === 'object' && Object.keys(selectedData.output).length + ' keys'}</span>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'var(--font-mono)', overflowX: 'auto', borderLeft: '3px solid #10b981' }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {typeof selectedData.output === 'string'
                    ? `output: ${JSON.stringify(selectedData.output)}`
                    : `output: ${JSON.stringify(selectedData.output, null, 2)}`}
                </pre>
              </div>
            </div>
          )}

          {(!selectedData.input && !selectedData.output) && (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
              No payload data for this selected span.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
