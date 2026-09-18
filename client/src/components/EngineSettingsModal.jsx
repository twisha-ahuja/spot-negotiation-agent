import React, { useEffect, useState } from 'react';
import { getColdLaneSettings, updateColdLaneSettings, resetColdLaneSettings } from '../api/spotApi';

// Each field, grouped for display, with a plain-English explanation. This list is the single
// source of truth for what the form renders — add a field here and it shows up automatically.
const FIELD_GROUPS = [
  {
    title: 'Timing',
    fields: [
      {
        key: 'sweep_interval_minutes',
        label: 'Sweep interval (minutes)',
        caption: 'How often the background check runs to look for lanes that need attention.'
      },
      {
        key: 't_minus_x_minutes',
        label: 'Stop-waiting threshold (minutes)',
        caption: "How long to keep waiting for more transporters to quote before negotiating with whoever's in. The final push window is auto-derived from this (÷ 3) — negotiation itself doesn't change there, it just revives anyone who'd gone quiet and been paused, once, for one last chance."
      },
      {
        key: 'min_reply_gap_minutes',
        label: 'Minimum reply gap (minutes)',
        caption: "Minimum time between two counters to the same transporter, for any reason — even a genuine re-quote won't get an instant reply."
      }
    ]
  },
  {
    title: 'Discount shaping',
    fields: [
      {
        key: 'discovery_open_pct',
        label: 'Opening discount (%)',
        caption: "The biggest opening discount asked for, as a % off a transporter's first quote."
      },
      {
        key: 'discovery_target_pct',
        label: 'Target discount (%)',
        caption: 'The ideal discount aimed for on a first counter.'
      },
      {
        key: 'discovery_floor_pct',
        label: 'Floor discount (%)',
        caption: 'The smallest discount ever asked for on a first counter.'
      },
      {
        key: 'momentum_pct',
        label: 'Momentum discount (%)',
        caption: "How far below the lane's best live quote later counters aim, once vendors are competing."
      },
      {
        key: 'rebroadcast_pct',
        label: 'Movement / gap threshold (%)',
        caption: "One shared threshold used three ways: how much the best price in the lane must improve before others get re-countered because of it, how much a transporter's own re-quote must move to count as new information, and how much cheaper the best price must be than a transporter's own quote for them to be worth asking at all."
      }
    ]
  },
  {
    title: 'Vendor drop',
    fields: [
      {
        key: 'max_unanswered_broadcasts',
        label: 'Max unanswered broadcasts',
        caption: 'How many counters in a row a transporter can ignore before being quietly paused.'
      }
    ]
  }
];

const ALL_KEYS = FIELD_GROUPS.flatMap(group => group.fields.map(field => field.key));

// Mirrors agents/cold_lane_negotiation/global_settings.py's validate_cold_lane_settings exactly —
// keep these two in sync if either changes. Returns { fieldKey: errorMessage }.
function validate(values) {
  const errors = {};

  for (const key of ALL_KEYS) {
    if (!(Number(values[key]) > 0)) {
      errors[key] = 'Must be greater than 0';
    }
  }

  const { discovery_floor_pct, discovery_target_pct, discovery_open_pct } = values;
  if (!(Number(discovery_floor_pct) <= Number(discovery_target_pct) && Number(discovery_target_pct) <= Number(discovery_open_pct))) {
    errors.discovery_floor_pct = errors.discovery_floor_pct || 'Floor must be ≤ target ≤ open';
    errors.discovery_target_pct = errors.discovery_target_pct || 'Floor must be ≤ target ≤ open';
    errors.discovery_open_pct = errors.discovery_open_pct || 'Floor must be ≤ target ≤ open';
  }

  const { min_reply_gap_minutes, sweep_interval_minutes, t_minus_x_minutes } = values;
  if (Number(min_reply_gap_minutes) < Number(sweep_interval_minutes)) {
    errors.min_reply_gap_minutes = errors.min_reply_gap_minutes || 'Must be ≥ sweep interval';
  }
  if (Number(t_minus_x_minutes) / 3 < Number(sweep_interval_minutes)) {
    errors.t_minus_x_minutes = errors.t_minus_x_minutes || 'Must be ≥ 3× sweep interval';
  }

  return errors;
}

export default function EngineSettingsModal({ onClose }) {
  const [values, setValues] = useState(null); // form draft, null while loading
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    getColdLaneSettings()
      .then(data => setValues(data))
      .catch(err => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const errors = values ? validate(values) : {};
  const hasErrors = Object.keys(errors).length > 0;

  // t_minus_x_minutes / 3, recalculated live as the field is edited — same formula the backend
  // uses (LAST_CALL_FRACTION), shown here so the derived value is never a mystery. This is the
  // final PUSH window now, not a final-call/frozen-price mode — see the field's caption above.
  const derivedLastCall = values ? (Number(values.t_minus_x_minutes) / 3).toFixed(1) : null;

  const updateField = (key, raw) => {
    setValues(prev => ({ ...prev, [key]: raw === '' ? '' : Number(raw) }));
  };

  const handleSave = async () => {
    if (hasErrors) return;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await updateColdLaneSettings(values);
      setValues(updated);
      onClose();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset every cold lane engine setting to its default value?')) return;
    setSaving(true);
    setSaveError('');
    try {
      const defaults = await resetColdLaneSettings();
      setValues(defaults);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '12px',
          width: '520px', maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)'
        }}
      >
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Negotiation Engine Settings
            </span>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '18px', cursor: 'pointer', lineHeight: 1, padding: '4px' }}
            >
              &times;
            </button>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--status-warn, #d97706)', marginTop: '6px' }}>
            Global — these apply to every cold lane, not just the spot you have open.
          </div>
        </div>

        {loading && (
          <div style={{ padding: '24px', fontSize: '13px', color: 'var(--text-secondary)' }}>Loading&hellip;</div>
        )}

        {loadError && (
          <div style={{ padding: '24px', fontSize: '13px', color: 'var(--brand-danger, #d64545)' }}>{loadError}</div>
        )}

        {values && (
          <>
            <div style={{ padding: '4px 18px 18px' }}>
              {FIELD_GROUPS.map(group => (
                <div key={group.title} style={{ marginTop: '16px' }}>
                  <div style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: '8px' }}>
                    {group.title}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {group.fields.map(field => (
                      <div key={field.key}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                          {field.label}
                        </label>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                          {field.caption}
                        </div>
                        <input
                          type="number"
                          value={values[field.key]}
                          onChange={e => updateField(field.key, e.target.value)}
                          style={{
                            width: '140px', padding: '6px 10px', borderRadius: '6px', fontSize: '13px',
                            border: `1px solid ${errors[field.key] ? 'var(--brand-danger, #d64545)' : 'var(--border-color)'}`,
                            background: 'var(--bg-surface)', color: 'var(--text-primary)'
                          }}
                        />
                        {errors[field.key] && (
                          <div style={{ fontSize: '11px', color: 'var(--brand-danger, #d64545)', marginTop: '4px' }}>
                            {errors[field.key]}
                          </div>
                        )}
                        {field.key === 't_minus_x_minutes' && !errors.t_minus_x_minutes && (
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                            Final push window: {derivedLastCall} min (auto = this ÷ 3) — revives paused transporters once
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {saveError && (
              <div style={{ padding: '0 18px 12px', fontSize: '12px', color: 'var(--brand-danger, #d64545)' }}>
                {saveError}
              </div>
            )}

            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={handleReset}
                disabled={saving}
                style={{
                  background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px',
                  color: 'var(--text-secondary)', fontSize: '12px', padding: '7px 12px',
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                Reset to defaults
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={onClose}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '12px', padding: '7px 12px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={hasErrors || saving}
                  style={{
                    background: (hasErrors || saving) ? 'var(--bg-muted)' : 'var(--brand-agent)',
                    color: (hasErrors || saving) ? 'var(--text-tertiary)' : 'var(--brand-agent-text, #fff)',
                    border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, padding: '7px 14px',
                    cursor: (hasErrors || saving) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
