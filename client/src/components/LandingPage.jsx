import React from 'react';

export default function LandingPage({ onSelectMode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--brand-agent)" strokeWidth="2" style={{ marginBottom: '16px' }}><path d="M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z" /><path d="M12 6a6 6 0 1 0 0 12 6 6 0 1 0 0-12z" /><path d="M12 10a2 2 0 1 0 0 4 2 2 0 1 0 0-4z" /></svg>
        <h1 style={{ fontSize: '28px', fontWeight: 600, margin: '0 0 8px 0' }}>Spot Negotiation Playground</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>Select an operation mode to begin.</p>
      </div>

      <div style={{ display: 'flex', gap: '24px' }}>
        {/* NEW SIMULATION CARD */}
        <div 
          onClick={() => onSelectMode('new')}
          className="hover-card"
          style={{ width: '280px', padding: '32px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '16px', transition: '0.2s', boxShadow: 'var(--shadow)' }}
        >
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-agent)' }}>
             <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px 0' }}>New Simulation</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5 }}>Create a fresh spot context by searching origin and destinations to run isolated agent negotiations.</p>
          </div>
        </div>

        {/* EXISTING SIMULATION CARD */}
        <div 
          onClick={() => onSelectMode('existing')}
          className="hover-card"
          style={{ width: '280px', padding: '32px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '16px', transition: '0.2s', boxShadow: 'var(--shadow)' }}
        >
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
             <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px 0' }}>Existing Simulation</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5 }}>Attach to an existing Adhoc ID from the source system and evaluate transporter bids in real-time.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
