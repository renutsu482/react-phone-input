import { useState, useCallback, useEffect, useRef } from 'react'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'

const MESSAGE_TYPE = 'react-phone-input-value'

const FALLBACK_COUNTRY = 'us'
const FALLBACK_PLACEHOLDER = 'Enter phone number'

/**
 * Normalize a raw country code string to a lowercase ISO2 code (tr, gb, us, de, ...).
 * Returns null if the value is empty or not a string.
 */
function normalizeCountryCode(raw) {
  if (!raw || typeof raw !== 'string') return null
  const code = raw.trim().toLowerCase()
  return code.length ? code : null
}

/**
 * Normalize a placeholder string: trim, return null if empty.
 */
function normalizePlaceholder(raw) {
  if (!raw || typeof raw !== 'string') return null
  const text = raw.trim()
  return text.length ? text : null
}

/**
 * Read defaultCountry from Jotform widget settings, if available.
 * Uses JFCustomWidget.getWidgetSetting('defaultCountry') when present.
 */
function readDefaultCountryFromJotform() {
  try {
    if (
      typeof window !== 'undefined' &&
      typeof window.JFCustomWidget !== 'undefined' &&
      typeof window.JFCustomWidget.getWidgetSetting === 'function'
    ) {
      const raw = window.JFCustomWidget.getWidgetSetting('defaultCountry')
      return normalizeCountryCode(raw)
    }
  } catch {
    // ignore and fall through
  }
  return null
}

/**
 * Read defaultCountry from URL query param ?defaultCountry=xx.
 */
function readDefaultCountryFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('defaultCountry')
    return normalizeCountryCode(raw)
  } catch {
    return null
  }
}

/**
 * Read placeholder from Jotform widget settings, if available.
 * Uses JFCustomWidget.getWidgetSetting('placeholder') when present.
 */
function readPlaceholderFromJotform() {
  try {
    if (
      typeof window !== 'undefined' &&
      typeof window.JFCustomWidget !== 'undefined' &&
      typeof window.JFCustomWidget.getWidgetSetting === 'function'
    ) {
      const raw = window.JFCustomWidget.getWidgetSetting('placeholder')
      return normalizePlaceholder(raw)
    }
  } catch {
    // ignore and fall through
  }
  return null
}

/**
 * Read placeholder from URL query param ?placeholder=...
 */
function readPlaceholderFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('placeholder')
    return normalizePlaceholder(raw)
  } catch {
    return null
  }
}

/**
 * Resolve config (country + placeholder) using both Jotform settings and URL query params.
 *
 * Country priority:
 *  1. Jotform widget setting defaultCountry
 *  2. URL query param defaultCountry
 *  3. Fallback "us"
 *
 * Placeholder priority:
 *  1. Jotform widget setting placeholder
 *  2. URL query param placeholder
 *  3. Fallback "Enter phone number"
 */
function resolveConfig() {
  const countryFromJotform = readDefaultCountryFromJotform()
  const countryFromQuery = readDefaultCountryFromQuery()
  const placeholderFromJotform = readPlaceholderFromJotform()
  const placeholderFromQuery = readPlaceholderFromQuery()

  const country = countryFromJotform || countryFromQuery || FALLBACK_COUNTRY
  const placeholder =
    placeholderFromJotform || placeholderFromQuery || FALLBACK_PLACEHOLDER

  return { country, placeholder }
}

/**
 * Compute max allowed digit count (excluding +) for a country using react-phone-input-2 metadata.
 * CountryData has dialCode (e.g. "1", "90") and format (e.g. " (###) ###-####" where # and . are digit placeholders).
 * Max = dial code digits + national number digit placeholders in format.
 */
function getMaxDigitsForCountry(country) {
  if (!country || typeof country !== 'object') return 15
  const dialCode = (country.dialCode || '').toString()
  const format = (country.format || '').toString()
  const dialCodeDigits = dialCode.replace(/\D/g, '').length
  const formatPlaceholders = (format.match(/[#.]/g) || []).length
  const total = dialCodeDigits + formatPlaceholders
  return total > 0 ? Math.min(total, 15) : 15
}

/**
 * Trim value to maxDigits (digits only), then return with + prefix for the library.
 */
function trimToMaxDigits(value, maxDigits) {
  const digits = (value || '').replace(/\D/g, '')
  if (digits.length <= maxDigits) return value || ''
  const trimmed = digits.slice(0, maxDigits)
  return trimmed ? `+${trimmed}` : ''
}

export default function App() {
  // defaultCountry & placeholder: internal config only, never rendered as their own inputs
  const [{ country: initialCountry, placeholder: initialPlaceholder }] =
    useState(() => resolveConfig())
  const [country, setCountry] = useState(initialCountry)
  const [countryMeta, setCountryMeta] = useState(null)
  const [placeholder, setPlaceholder] = useState(initialPlaceholder)

  const [value, setValue] = useState('')
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    if (typeof window.JFCustomWidget === 'undefined') return

    window.JFCustomWidget.subscribe(
      'ready',
      function (_formId, initialValue, _data) {
        // Re-resolve config using Jotform settings once the widget is ready,
        // in case settings are not available at initial render time.
        const { country: nextCountry, placeholder: nextPlaceholder } =
          resolveConfig()
        setCountry(nextCountry)
        setPlaceholder(nextPlaceholder)

        if (initialValue) setValue(initialValue)
      },
    )

    window.JFCustomWidget.subscribe('submit', function () {
      window.JFCustomWidget.sendSubmit({
        valid: true,
        value: valueRef.current ?? '',
      })
    })
  }, [])

  const handleChange = useCallback((next, country, _e, _formattedValue) => {
    const nextStr = next ?? ''
    const maxDigits = getMaxDigitsForCountry(country)
    const trimmed = trimToMaxDigits(nextStr, maxDigits)
    const finalValue = trimmed !== nextStr ? trimmed : nextStr
    setValue(finalValue)
    if (country && typeof country === 'object') {
      setCountryMeta(country)
    }

    try {
      window.parent.postMessage({ type: MESSAGE_TYPE, value: finalValue }, '*')
      if (typeof window.JFCustomWidget !== 'undefined') {
        window.JFCustomWidget.sendData({ value: finalValue })
      }
    } catch (_) {}
  }, [])

  const showPlaceholderOverlay = (() => {
    if (!placeholder) return false
    const digits = (value || '').replace(/\D/g, '')
    if (!countryMeta || typeof countryMeta !== 'object') {
      return !digits.length
    }
    const dialDigits = (countryMeta.dialCode || '')
      .toString()
      .replace(/\D/g, '').length
    const nationalDigits = Math.max(0, digits.length - dialDigits)
    return nationalDigits === 0
  })()

  return (
    <div className="phone-widget-root">
      <div className="phone-widget-inner">
        <PhoneInput
          country={country}
          value={value}
          onChange={handleChange}
          onMount={(_valueOnMount, dataOnMount) => {
            if (dataOnMount && typeof dataOnMount === 'object') {
              setCountryMeta(dataOnMount)
            }
          }}
          placeholder={placeholder}
          containerClass="phone-widget-container"
          inputClass="phone-widget-input"
          buttonClass="phone-widget-button"
          dropdownClass="phone-widget-dropdown"
          enableSearch={false}
          countryCodeEditable={false}
        />
        {showPlaceholderOverlay && (
          <div className="phone-widget-placeholder-overlay">
            {/* Invisible dial code ghost to reserve width so that the
                placeholder text starts visually after the dial code. */}
            <span className="phone-widget-dial-ghost">
              {countryMeta && countryMeta.dialCode
                ? `+${countryMeta.dialCode} `
                : ''}
            </span>
            <span className="phone-widget-placeholder-text">{placeholder}</span>
          </div>
        )}
      </div>
    </div>
  )
}
