import React, { useState, useEffect, useRef } from 'react';

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function LocationAutocomplete({ placeholder, value, onChange, disabled }) {
  const [query, setQuery] = useState(value ? value.label || value.suggestion || '' : '');
  const debouncedQuery = useDebounce(query, 300);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const lastSelectedRef = useRef('');

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setOptions([]);
      return;
    }

    // Hard block any subsequent fetches if the input string perfectly matches the last formally selected item string.
    if (debouncedQuery === lastSelectedRef.current) {
      setOptions([]);
      setOpen(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    fetch(`https://prod.lorri.in/api/apiuser/autocomplete?suggest=${encodeURIComponent(debouncedQuery)}&limit=20&searchFields=new_locations&application=home_page`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        setOptions(data.value || []);
        setLoading(false);
        setOpen(true);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error(err);
          setLoading(false);
        }
      });
    return () => { controller.abort(); };
  }, [debouncedQuery, value]);

  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [options, open]);

  const handleSelect = (opt) => {
    lastSelectedRef.current = opt.location_name;
    setQuery(opt.location_name);
    onChange(opt.location);
    setOptions([]);
    setOpen(false);
    if (inputRef.current) inputRef.current.blur();
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < options.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < options.length) {
        handleSelect(options[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }} ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onClick={() => { if (options.length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        style={{ width: '100%' }}
      />
      {loading && <div style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '11px', color: 'var(--text-tertiary)' }}>...</div>}

      {open && options.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg-panel)', border: '1px solid var(--border-color)',
          borderRadius: '6px', maxHeight: '200px', overflowY: 'auto',
          boxShadow: 'var(--shadow)', zIndex: 50
        }}>
          {options.map((opt, i) => {
            const isHighlighted = i === highlightedIndex;
            return (
              <div
                key={i}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
                onMouseEnter={() => setHighlightedIndex(i)}
                style={{
                  padding: '8px 12px', fontSize: '12px', color: 'var(--text-primary)',
                  cursor: 'pointer', borderBottom: i < options.length - 1 ? '1px solid var(--border-color)' : 'none',
                  background: isHighlighted ? 'var(--bg-surface)' : 'transparent'
                }}
              >
                {opt.location_name}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
