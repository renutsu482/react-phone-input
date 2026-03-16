import { useState, useCallback, useEffect, useRef } from 'react'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'

const MESSAGE_TYPE = 'react-phone-input-value'

const FALLBACK_COUNTRY = 'us'

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
 * Resolve default country using both Jotform settings and URL query param.
 * Priority:
 * 1. Jotform widget setting defaultCountry
 * 2. URL query param defaultCountry
 * 3. Fallback "us"
 *
 * Returns all three values for debug purposes.
 */
function resolveDefaultCountryWithDebug() {
  const fromJotform = readDefaultCountryFromJotform()
  const fromQuery = readDefaultCountryFromQuery()
  const resolved = fromJotform || fromQuery || FALLBACK_COUNTRY
  return { fromJotform, fromQuery, resolved }
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
  // defaultCountry: internal config only, never rendered as an input or UI control
  const [{ fromJotform, fromQuery, resolved }] = useState(
    () => resolveDefaultCountryWithDebug(),
  )
  const [country, setCountry] = useState(resolved)

  const [value, setValue] = useState('')
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    if (typeof window.JFCustomWidget === 'undefined') return

    window.JFCustomWidget.subscribe(
      'ready',
      function (_formId, initialValue, _data) {
        // Re-resolve country using Jotform settings once the widget is ready,
        // in case settings are not available at initial render time.
        const { resolved: nextResolved } = resolveDefaultCountryWithDebug()
        setCountry(nextResolved)

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

    try {
      window.parent.postMessage({ type: MESSAGE_TYPE, value: finalValue }, '*')
      if (typeof window.JFCustomWidget !== 'undefined') {
        window.JFCustomWidget.sendData({ value: finalValue })
      }
    } catch (_) {}
  }, [])

  return (
    <div className="phone-widget-root">
      <PhoneInput
        country={country}
        value={value}
        onChange={handleChange}
        placeholder="Enter phone number"
        containerClass="phone-widget-container"
        inputClass="phone-widget-input"
        buttonClass="phone-widget-button"
        dropdownClass="phone-widget-dropdown"
        enableSearch={false}
        countryCodeEditable={false}
      />
    </div>
  )
}
