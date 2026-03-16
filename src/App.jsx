import { useState, useCallback, useEffect, useRef } from 'react'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'

const MESSAGE_TYPE = 'react-phone-input-value'

const FALLBACK_COUNTRY = 'us'

/**
 * Get default country from config only (not displayed in UI).
 * Sources: (1) Jotform widget iframe URL query ?defaultCountry=xx,
 *          (2) fallback "us" if missing or invalid.
 * ISO2 codes e.g. tr, gb, us. Used only to set initial country on PhoneInput.
 */
function getDefaultCountryFromConfig() {
  try {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('defaultCountry')
    if (!raw || typeof raw !== 'string') return FALLBACK_COUNTRY
    const code = raw.trim().toLowerCase()
    if (!code.length) return FALLBACK_COUNTRY
    return code
  } catch {
    return FALLBACK_COUNTRY
  }
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
  /* defaultCountry: internal config only, never rendered as an input or UI control */
  const [initialCountry] = useState(() => getDefaultCountryFromConfig())
  const [value, setValue] = useState('')
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    if (typeof window.JFCustomWidget === 'undefined') return

    window.JFCustomWidget.subscribe('ready', function (_formId, initialValue) {
      if (initialValue) setValue(initialValue)
    })

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
        country={initialCountry}
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
