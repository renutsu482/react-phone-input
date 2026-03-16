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

function getJotformEnvAndSetting(name) {
  const hasWindow = typeof window !== 'undefined'
  const jf = hasWindow ? window.JFCustomWidget : undefined
  const hasJF = !!jf
  const hasGetSetting =
    !!jf && typeof jf.getWidgetSetting === 'function'
  let raw
  try {
    if (hasGetSetting) {
      raw = jf.getWidgetSetting(name)
    }
  } catch {
    // ignore and fall through
  }
  return { hasJF, hasGetSetting, raw }
}

function getJotformSetting(name) {
  return getJotformEnvAndSetting(name).raw
}

function getQueryParam(name) {
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get(name) ?? undefined
  } catch {
    return undefined
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
 *  1. Jotform widget setting placeholderText
 *  2. Jotform widget setting phonePlaceholder
 *  3. Jotform widget setting placeholder
 *  4. URL query param placeholderText
 *  5. URL query param phonePlaceholder
 *  6. URL query param placeholder
 *  7. Fallback "Enter phone number"
 */
function resolveConfig() {
  const envDefaultCountry = getJotformEnvAndSetting('defaultCountry')
  // Country
  const jotformDefaultCountry = normalizeCountryCode(
    envDefaultCountry.raw,
  )
  const queryDefaultCountry = normalizeCountryCode(
    getQueryParam('defaultCountry'),
  )
  const country = jotformDefaultCountry || queryDefaultCountry || FALLBACK_COUNTRY

  // Placeholder – Jotform first (placeholderText > phonePlaceholder > placeholder)
  const envPlaceholderText = getJotformEnvAndSetting('placeholderText')
  const envPhonePlaceholder = getJotformEnvAndSetting('phonePlaceholder')
  const envPlaceholder = getJotformEnvAndSetting('placeholder')

  const jtPlaceholderText = normalizePlaceholder(envPlaceholderText.raw)
  const jtPhonePlaceholder = normalizePlaceholder(envPhonePlaceholder.raw)
  const jtPlaceholder = normalizePlaceholder(envPlaceholder.raw)

  // Then query params (placeholderText > phonePlaceholder > placeholder)
  const qpPlaceholderText = normalizePlaceholder(
    getQueryParam('placeholderText'),
  )
  const qpPhonePlaceholder = normalizePlaceholder(
    getQueryParam('phonePlaceholder'),
  )
  const qpPlaceholder = normalizePlaceholder(getQueryParam('placeholder'))

  const placeholder =
    jtPlaceholderText ||
    jtPhonePlaceholder ||
    jtPlaceholder ||
    qpPlaceholderText ||
    qpPhonePlaceholder ||
    qpPlaceholder ||
    FALLBACK_PLACEHOLDER

  return {
    country,
    placeholder,
    debug: {
      jf: envDefaultCountry.hasJF || envPlaceholderText.hasJF,
      getSetting:
        envDefaultCountry.hasGetSetting || envPlaceholderText.hasGetSetting,
      rawDefaultCountry: envDefaultCountry.raw,
      rawPlaceholderText: envPlaceholderText.raw,
      rawPhonePlaceholder: envPhonePlaceholder.raw,
      jotformDefaultCountry,
      queryDefaultCountry,
      jtPlaceholderText,
      jtPhonePlaceholder,
      jtPlaceholder,
      qpPlaceholderText,
      qpPhonePlaceholder,
      qpPlaceholder,
    },
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
  // defaultCountry & placeholder: internal config only, never rendered as their own inputs
  const [
    {
      country: initialCountry,
      placeholder: initialPlaceholder,
      debug: initialDebug,
    },
  ] = useState(() => resolveConfig())
  const [country, setCountry] = useState(initialCountry)
  const [countryMeta, setCountryMeta] = useState(null)
  const [placeholder, setPlaceholder] = useState(initialPlaceholder)
  const [debug, setDebug] = useState({
    ...initialDebug,
    resolvedPlaceholder: initialPlaceholder,
    isDropdownOpen: false,
    lastResizeHeight: null,
  })

  const [value, setValue] = useState('')
  const valueRef = useRef(value)
  valueRef.current = value
  const containerRef = useRef(null)

  const requestResize = useCallback((height) => {
    try {
      if (
        typeof window !== 'undefined' &&
        typeof window.JFCustomWidget !== 'undefined' &&
        typeof window.JFCustomWidget.requestFrameResize === 'function'
      ) {
        window.JFCustomWidget.requestFrameResize({ height })
        setDebug((prev) => ({ ...prev, lastResizeHeight: height }))
      }
    } catch {
      // ignore resize errors
    }
  }, [])

  // Observe dropdown open/close by watching for .country-list / .flag-dropdown.open changes
  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    let lastOpen = false
    const computeIsOpen = () => {
      const flagOpen = root.querySelector('.flag-dropdown.open')
      if (flagOpen) return true
      // Fallback: visible country-list (not display:none and has layout)
      const list = root.querySelector('.country-list')
      if (!list) return false
      const style = window.getComputedStyle(list)
      const visible =
        style &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        list.offsetParent !== null
      return visible
    }

    const handleOpenChange = () => {
      const isOpen = computeIsOpen()
      if (isOpen === lastOpen) return
      lastOpen = isOpen
      setDebug((prev) => ({ ...prev, isDropdownOpen: isOpen }))
      requestResize(isOpen ? 320 : 100)
    }

    const observer = new MutationObserver(handleOpenChange)
    observer.observe(root, {
      attributes: true,
      childList: true,
      subtree: true,
    })

    // Initial check
    handleOpenChange()

    return () => observer.disconnect()
  }, [requestResize])

  useEffect(() => {
    if (typeof window.JFCustomWidget === 'undefined') return

    window.JFCustomWidget.subscribe(
      'ready',
      function (_formId, initialValue, _data) {
        // Re-resolve config using Jotform settings once the widget is ready,
        // in case settings are not available at initial render time.
        const {
          country: nextCountry,
          placeholder: nextPlaceholder,
          debug: nextDebug,
        } = resolveConfig()
        setCountry(nextCountry)
        setPlaceholder(nextPlaceholder)
        setDebug((prev) => ({
          ...prev,
          ...nextDebug,
          resolvedPlaceholder: nextPlaceholder,
        }))

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
      <div className="phone-widget-inner" ref={containerRef}>
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
