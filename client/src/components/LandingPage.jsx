import React from 'react';
import styles from '../styles/LandingPage.module.css';

export default function LandingPage({ onSelectMode }) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--brand-agent)" strokeWidth="2" className={styles.headerIcon}><path d="M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z" /><path d="M12 6a6 6 0 1 0 0 12 6 6 0 1 0 0-12z" /><path d="M12 10a2 2 0 1 0 0 4 2 2 0 1 0 0-4z" /></svg>
        <h1 className={styles.title}>Spot Negotiation Playground</h1>
        <p className={styles.subtitle}>Select an operation mode to begin.</p>
      </div>

      <div className={styles.cardContainer}>
        {/* NEW SIMULATION CARD */}
        <div 
          onClick={() => onSelectMode('new')}
          className={styles.card}
        >
          <div className={`${styles.iconBox} ${styles.primary}`}>
             <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          </div>
          <div>
            <h3 className={styles.cardTitle}>New Simulation</h3>
            <p className={styles.cardDesc}>Create a fresh spot context by searching origin and destinations to run isolated agent negotiations.</p>
          </div>
        </div>

        {/* EXISTING SIMULATION CARD */}
        <div 
          onClick={() => onSelectMode('existing')}
          className={styles.card}
        >
          <div className={`${styles.iconBox} ${styles.secondary}`}>
             <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>
          <div>
            <h3 className={styles.cardTitle}>Existing Simulation</h3>
            <p className={styles.cardDesc}>Attach to an existing Adhoc ID from the source system and evaluate transporter bids in real-time.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
