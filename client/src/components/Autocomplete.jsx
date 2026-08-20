import React, { useState, useCallback, useRef } from 'react'
import Location from 'react-autosuggest'
import debounce from 'lodash/debounce'
import '../styles/Autocomplete.css'

const AutoComplete = ({
    onSelect,
    placeholder,
    onChange,
    value,
    apiUrl,
    isPost = false,
    labelKey = 'location_name',
    dataKey = 'value',
    payloadKey = '',
    inputClassName = '',
    id = 'Autosuggets_Input_id',
    localData = null,
    disabled = false
}) => {
    const [suggestions, setSuggestions] = useState([])
    const [show, setShow] = useState(false)
    const abortControllerRef = useRef(null)

    const getLabel = (opt) => opt[labelKey] || opt.transporter_name || opt.name || ''

    const onSuggestionsFetchRequested = useCallback(debounce(({ value: inputValue }) => {
        if (inputValue.length >= 2) {

            if (localData) {
                setShow(true)
                const term = inputValue.toLowerCase()
                const filtered = localData.filter(d => getLabel(d).toLowerCase().includes(term)).slice(0, 20);
                setSuggestions(filtered)
                setShow(false)
                return;
            }

            if (abortControllerRef.current) abortControllerRef.current.abort()
            const controller = new AbortController()
            abortControllerRef.current = controller

            setShow(true)

            let fullUrl = apiUrl
            let options = { signal: controller.signal }

            if (isPost) {
                options.method = "POST"
                options.headers = { "Content-Type": "application/json" }
                options.body = JSON.stringify({ [payloadKey]: inputValue })
            } else {
                fullUrl += `?suggest=${encodeURIComponent(inputValue)}&limit=20&searchFields=new_locations&application=home_page`
            }

            fetch(fullUrl, options)
                .then(res => res.json())
                .then(data => {
                    let fetchedSuggestions = data[dataKey] || []
                    setSuggestions(fetchedSuggestions)
                    setShow(false)
                })
                .catch(err => {
                    if (err.name !== 'AbortError') {
                        setShow(false)
                    }
                })
        }
    }, 500), [apiUrl, isPost, dataKey, payloadKey])

    const onSuggestionsClearRequested = () => {
        setSuggestions([]);
    }

    // Map value safely into string for react-autosuggest
    const internalValue = value ? (typeof value === 'object' ? getLabel(value) : value) : '';

    const onSuggestionSelected = (event, { suggestion }) => {
        onSelect(suggestion);
    }

    const inputProps = {
        value: internalValue,
        onChange: (e, { newValue }) => onChange(newValue),
        placeholder: placeholder,
        id: id,
        className: inputClassName,
        disabled: disabled
    }

    return (
        <div className="Loader-Container">
            <Location
                suggestions={suggestions}
                onSuggestionsFetchRequested={onSuggestionsFetchRequested}
                onSuggestionsClearRequested={onSuggestionsClearRequested}
                getSuggestionValue={getLabel}
                renderSuggestion={getLabel}
                onSuggestionSelected={onSuggestionSelected}
                inputProps={inputProps}
            />
            {show && (
                <div className="Spinner-Container">
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>...</span>
                </div>
            )}
        </div>
    )
}

export default AutoComplete
