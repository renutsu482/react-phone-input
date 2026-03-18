import { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'

const MESSAGE_TYPE = 'react-phone-input-value'

const FALLBACK_COUNTRY = 'us'
const FALLBACK_PLACEHOLDER = 'Enter phone number'

/**
 * Produce a human-friendly international display format for email/Jotform.
 * Prefers react-phone-input-2's formatted value, normalized to:
 *  - always start with '+'
 *  - always include the country dial code
 *  - use spaces instead of punctuation for readability.
 */
function formatPhoneForEmail(rawValue, formattedValue, country) {
  const dial = country && country.dialCode
    ? country.dialCode.toString().replace(/\D/g, '')
    : null

  const normalize = (input) =>
    input
      .replace(/[()\u00A0-]/g, ' ') // parentheses, hyphens, non‑breaking spaces -> space
      .replace(/\s+/g, ' ') // collapse multiple spaces
      .trim()

  let base = formattedValue || ''

  if (base) {
    base = normalize(base)
    if (!base.startsWith('+')) {
      if (dial) {
        const rest = base.replace(/^[+0\s]+/, '')
        base = `+${dial}${rest ? ' ' + rest : ''}`
      } else {
        const digits = (rawValue || '').replace(/\D/g, '')
        base = digits ? `+${digits}` : ''
      }
    }
    return base
  }

  const digits = (rawValue || '').replace(/\D/g, '')
  if (!digits) return ''

  let result = digits
  if (dial && digits.startsWith(dial)) {
    const national = digits.slice(dial.length)
    const grouped = national.replace(/(\d{3,4})(?=\d)/g, '$1 ')
    result = `+${dial}${grouped ? ' ' + grouped : ''}`
  } else if (dial) {
    result = `+${dial} ${digits}`
  } else {
    result = `+${digits}`
  }

  return result
}

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
  const jotformDefaultCountry = normalizeCountryCode(envDefaultCountry.raw)
  const queryDefaultCountry = normalizeCountryCode(
    getQueryParam('defaultCountry'),
  )
  const country =
    jotformDefaultCountry || queryDefaultCountry || FALLBACK_COUNTRY

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

  // Sub label (Jotform: subLabel; then query param subLabel)
  const envSubLabel = getJotformEnvAndSetting('subLabel')
  const jtSubLabel = normalizePlaceholder(envSubLabel.raw)
  const qpSubLabel = normalizePlaceholder(getQueryParam('subLabel'))
  const subLabel = jtSubLabel || qpSubLabel || null

  // Sub label position (top | left | right | bottom)
  const envSubLabelPos = getJotformEnvAndSetting('subLabelPosition')
  const jtSubLabelPosRaw = envSubLabelPos.raw
  const qpSubLabelPosRaw = getQueryParam('subLabelPosition')
  const normalizePos = (v) => {
    if (!v || typeof v !== 'string') return null
    const p = v.trim().toLowerCase()
    return ['top', 'left', 'right', 'bottom'].includes(p) ? p : null
  }
  const jtSubLabelPosition = normalizePos(jtSubLabelPosRaw)
  const qpSubLabelPosition = normalizePos(qpSubLabelPosRaw)
  const subLabelPosition = jtSubLabelPosition || qpSubLabelPosition || 'bottom'

  return {
    country,
    placeholder,
    subLabel,
    subLabelPosition,
    debug: {
      jf: envDefaultCountry.hasJF || envPlaceholderText.hasJF,
      getSetting:
        envDefaultCountry.hasGetSetting || envPlaceholderText.hasGetSetting,
      rawDefaultCountry: envDefaultCountry.raw,
      rawPlaceholderText: envPlaceholderText.raw,
      rawPhonePlaceholder: envPhonePlaceholder.raw,
      rawSubLabel: envSubLabel.raw,
      rawSubLabelPosition: envSubLabelPos.raw,
      jotformDefaultCountry,
      queryDefaultCountry,
      jtPlaceholderText,
      jtPhonePlaceholder,
      jtPlaceholder,
      qpPlaceholderText,
      qpPhonePlaceholder,
      qpPlaceholder,
      resolvedPlaceholder: placeholder,
      resolvedSubLabel: subLabel,
      resolvedSubLabelPosition: subLabelPosition,
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

function getDialDigits(country) {
  const dial = country && typeof country === 'object' ? country.dialCode : null
  return (dial || '').toString().replace(/\D/g, '')
}

function getExpectedNationalDigits(country) {
  if (!country || typeof country !== 'object') return 0
  const format = (country.format || '').toString()
  return (format.match(/[#.]/g) || []).length
}

function getMaxDigitsForValue(value, country) {
  const baseMax = getMaxDigitsForCountry(country)
  if (!country || typeof country !== 'object') return baseMax

  const iso2 = (country.countryCode || country.iso2)
    ? String(country.countryCode || country.iso2).toLowerCase()
    : ''
  if (iso2 !== 'gb') return baseMax

  // GB UX: allow one extra national digit if the national part starts with trunk '0'.
  // This supports local-style input like 07911 224456 (11 visible national digits),
  // while validation still treats one leading '0' as trunk prefix (10 effective digits).
  const dialDigits = getDialDigits(country)
  const digits = (value || '').replace(/\D/g, '')
  if (!dialDigits || !digits.startsWith(dialDigits)) return baseMax

  const national = digits.slice(dialDigits.length)
  if (national.startsWith('0')) {
    return Math.min(dialDigits.length + 11, 15)
  }
  return Math.min(dialDigits.length + 10, 15)
}

function getRequiredNationalDigits(country) {
  if (!country || typeof country !== 'object') return 0
  const iso2 = (country.countryCode || country.iso2)
    ? String(country.countryCode || country.iso2).toLowerCase()
    : ''

  // Key countries for this widget: strict national digit requirements.
  if (iso2 === 'us') return 10
  if (iso2 === 'ca') return 10
  if (iso2 === 'gb') return 10
  if (iso2 === 'tr') return 10

  return 0
}

function isCompleteByCountryFormat(value, country) {
  const digits = (value || '').replace(/\D/g, '')
  const dialDigits = getDialDigits(country)
  const requiredNational = getRequiredNationalDigits(country)
  const expectedNational = requiredNational || getExpectedNationalDigits(country)

  // If we don't have format metadata, don't block submission (avoid false negatives).
  if (!expectedNational) return true

  let nationalDigits = dialDigits && digits.startsWith(dialDigits)
    ? digits.slice(dialDigits.length)
    : digits

  // GB UX rule: allow local-style leading 0 while typing, but treat it as trunk prefix
  // for validation (ignore a single leading 0 for the national digit count).
  const iso2 = (country && (country.countryCode || country.iso2))
    ? String(country.countryCode || country.iso2).toLowerCase()
    : ''
  if (iso2 === 'gb' && nationalDigits.startsWith('0')) {
    nationalDigits = nationalDigits.slice(1)
  }

  // For key countries, enforce exact national length; otherwise allow >= by format.
  if (requiredNational) return nationalDigits.length === requiredNational
  return nationalDigits.length >= expectedNational
}

function isValidByMinNationalDigits(value, country, minDigits = 9) {
  const national = getNationalDigitsFromControlledValue(value || '', country || null)
  const count = (national || '').replace(/\D/g, '').length
  return count >= minDigits
}

function normalizeE164ForOutput(value, country) {
  const v = value || ''
  const digits = v.replace(/\D/g, '')
  if (!digits) return ''

  const dialDigits = getDialDigits(country)
  const iso2 = (country && (country.countryCode || country.iso2))
    ? String(country.countryCode || country.iso2).toLowerCase()
    : ''

  // Default: keep library value (already +<dial><national> digits)
  if (!dialDigits || !digits.startsWith(dialDigits)) return digits ? `+${digits}` : ''

  let national = digits.slice(dialDigits.length)

  // GB: drop a single leading trunk '0' when producing E.164 output.
  if (iso2 === 'gb' && national.startsWith('0')) {
    national = national.slice(1)
  }

  return `+${dialDigits}${national}`
}

function getIso2(country) {
  if (!country || typeof country !== 'object') return ''
  const v = country.countryCode || country.iso2
  return v ? String(v).toLowerCase() : ''
}

function getNationalDigitsFromControlledValue(controlledValue, country) {
  const digits = (controlledValue || '').replace(/\D/g, '')
  if (!digits) return ''

  const iso2 = getIso2(country)

  // GB: derive national digits purely by stripping one leading "44" when present.
  // This avoids relying on library metadata that may be missing/inconsistent during typing.
  if (iso2 === 'gb') {
    return digits.startsWith('44') ? digits.slice(2) : digits
  }

  const dialDigits = getDialDigits(country)
  if (dialDigits && digits.startsWith(dialDigits)) return digits.slice(dialDigits.length)
  return digits
}

function formatGbNationalForDisplay(nationalDigits) {
  const n = (nationalDigits || '').replace(/\D/g, '')
  if (!n) return ''
  const splitAt = n.startsWith('0') ? 5 : 4
  if (n.length <= splitAt) return n
  return `${n.slice(0, splitAt)} ${n.slice(splitAt)}`
}

function clampGbNationalDigits(rawNationalDigits) {
  const digits = (rawNationalDigits || '').replace(/\D/g, '')
  if (!digits) return ''
  const maxLen = digits.startsWith('0') ? 11 : 10
  return digits.slice(0, maxLen)
}

export default function App() {
  // defaultCountry & placeholder: internal config only, never rendered as their own inputs
  const [
    {
      country: initialCountry,
      placeholder: initialPlaceholder,
      subLabel: initialSubLabel,
      subLabelPosition: initialSubLabelPosition,
    },
  ] = useState(() => resolveConfig())
  const [country, setCountry] = useState(initialCountry)
  const [countryMeta, setCountryMeta] = useState(null)
  const countryMetaRef = useRef(countryMeta)
  countryMetaRef.current = countryMeta
  const [placeholder, setPlaceholder] = useState(initialPlaceholder)
  const [subLabel, setSubLabel] = useState(initialSubLabel)
  const [subLabelPosition, setSubLabelPosition] = useState(
    initialSubLabelPosition,
  )
  const [, setDebug] = useState({
    isDropdownOpen: false,
    lastResizeHeight: null,
  })

  const [value, setValue] = useState('')
  const valueRef = useRef(value)
  valueRef.current = value
  const [displayValue, setDisplayValue] = useState('')
  const displayValueRef = useRef(displayValue)
  displayValueRef.current = displayValue
  const [isValid, setIsValid] = useState(true)
  const isValidRef = useRef(isValid)
  isValidRef.current = isValid
  const [e164Value, setE164Value] = useState('')
  const e164ValueRef = useRef(e164Value)
  e164ValueRef.current = e164Value
  const containerRef = useRef(null)
  /* Only flag needed for placeholder alignment: show overlay after dial width is measured. */
  const [dialMeasured, setDialMeasured] = useState(false)
  const [gbNationalDigits, setGbNationalDigits] = useState('')
  const [gbNationalDisplay, setGbNationalDisplay] = useState('')

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

  // If the resolved default country ever changes (late settings / HMR),
  // keep internal state in sync without affecting current behavior.
  useEffect(() => {
    if (initialCountry && typeof initialCountry === 'string') {
      setCountry((prev) => (prev === initialCountry ? prev : initialCountry))
    }
  }, [initialCountry])

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
          subLabel: nextSubLabel,
          subLabelPosition: nextSubLabelPosition,
          debug: nextDebug,
        } = resolveConfig()
        setCountry(nextCountry)
        setPlaceholder(nextPlaceholder)
        setSubLabel(nextSubLabel)
        setSubLabelPosition(nextSubLabelPosition)
        setDebug((prev) => ({
          ...prev,
          ...nextDebug,
        }))

        if (initialValue) {
          setValue(initialValue)
          setDisplayValue(initialValue)
        }
      },
    )

    window.JFCustomWidget.subscribe('submit', function () {
      // Recompute against latest controlled value to avoid any stale edge case.
      const submitIsValid = isValidByMinNationalDigits(
        valueRef.current || '',
        countryMetaRef.current || null,
        9,
      )
      isValidRef.current = submitIsValid
      const iso2 = getIso2(countryMetaRef.current || null)
      const submitE164 = normalizeE164ForOutput(
        valueRef.current || '',
        countryMetaRef.current || null,
      )
      window.JFCustomWidget.sendSubmit({
        valid: !!submitIsValid,
        value: submitIsValid
          ? (iso2 === 'gb'
              ? submitE164
              : displayValueRef.current || valueRef.current || '')
          : '',
      })
    })
  }, [])

  const commitFinalValue = useCallback((finalValue, countryObj, inputText) => {
    // Write refs immediately so submit/data can't observe stale state.
    valueRef.current = finalValue

    setValue(finalValue)
    if (countryObj) {
      setCountryMeta(countryObj)
      countryMetaRef.current = countryObj
    }

    const emailDisplay = formatPhoneForEmail(finalValue, inputText, countryObj)
    displayValueRef.current = emailDisplay
    setDisplayValue(emailDisplay)

    const nextE164 = normalizeE164ForOutput(finalValue, countryObj)
    e164ValueRef.current = nextE164
    setE164Value(nextE164)

    const nextIsValid = isValidByMinNationalDigits(finalValue, countryObj, 9)
    setIsValid(nextIsValid)
    isValidRef.current = nextIsValid

    try {
      if (typeof window !== 'undefined' && window.parent) {
        window.parent.postMessage({ type: MESSAGE_TYPE, value: finalValue }, '*')
      }
      if (
        typeof window !== 'undefined' &&
        typeof window.JFCustomWidget !== 'undefined'
      ) {
        const iso2 = getIso2(countryObj)
        const submittedValue =
          iso2 === 'gb' ? nextE164 : emailDisplay || finalValue
        window.JFCustomWidget.sendData({
          value: nextIsValid ? submittedValue : '',
          rawValue: finalValue,
          e164Value: nextE164,
          valid: nextIsValid,
        })
      }
    } catch (_) {}
  }, [])

  const handleChange = useCallback((next, countryArg, e, formattedValue) => {
    const countryObj =
      countryArg && typeof countryArg === 'object' ? countryArg : null
    const iso2 = getIso2(countryObj)

    // Prefer the real input text when available (more robust across environments)
    const inputText =
      (e && e.target && typeof e.target.value === 'string' && e.target.value) ||
      (typeof formattedValue === 'string' ? formattedValue : '') ||
      ''

    // For GB leading-0 local input, the library can drop the 11th national digit.
    // Preserve it by reconstructing from the most complete available input text.
    const nextStrRaw = typeof next === 'string' ? next : next ? String(next) : ''
    let nextStrForTrim = nextStrRaw
    if (iso2 === 'gb') {
      const dial = getDialDigits(countryObj) || '44'
      const digitsFromText = (inputText || '').replace(/\D/g, '')
      if (digitsFromText.startsWith(dial)) {
        const national = digitsFromText.slice(dial.length)
        if (national.startsWith('0')) {
          // Allow up to 11 visible national digits when leading 0 is present.
          nextStrForTrim = `+${dial}${national.slice(0, 11)}`
        }
      }
    }

    const maxDigits = getMaxDigitsForValue(nextStrForTrim, countryObj)
    // 1) Apply existing max-length trimming (keeps current behavior)
    const trimmed = trimToMaxDigits(nextStrForTrim, maxDigits)
    // 2) Final controlled value: keep library formatting intact (do not fight GB typing)
    const finalValue =
      trimmed !== nextStrForTrim ? trimmed : nextStrForTrim

    // Write refs immediately so submit/data can't observe stale state.
    valueRef.current = finalValue

    setValue(finalValue)
    if (countryObj) {
      setCountryMeta(countryObj)
      countryMetaRef.current = countryObj
    }

    commitFinalValue(finalValue, countryObj, inputText)
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

  const [dialOffsetPx, setDialOffsetPx] = useState(0)
  const dialMeasureRef = useRef(null)

  // Measure dial code width in the actual DOM (Jotform or standalone),
  // then use that to offset the placeholder so it always starts after the dial code.
  useLayoutEffect(() => {
    if (!countryMeta || !countryMeta.dialCode) {
      setDialOffsetPx(0)
      setDialMeasured(false)
      return
    }

    const measureOnce = () => {
      if (!dialMeasureRef.current) return 0
      const w = dialMeasureRef.current.offsetWidth || 0
      setDialOffsetPx(w)
      setDialMeasured(true)
      return w
    }

    // Initial synchronous measurement before paint
    const firstWidth = measureOnce()

    // Extra pass on next animation frame to catch late font/layout changes in Jotform iframe
    let rafId = null
    if (typeof window !== 'undefined') {
      rafId = window.requestAnimationFrame(() => {
        const w = measureOnce()
        if (w !== firstWidth) {
          // Already updated inside measureOnce
        }
      })
    }

    return () => {
      if (rafId !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [countryMeta, placeholder])

  const rootClassName = `phone-widget-root phone-widget-sublabel-${subLabelPosition}`
  const isGbActive = (() => {
    if (country === 'gb') return true
    return getIso2(countryMetaRef.current || null) === 'gb'
  })()

  // Keep GB custom input state in sync when switching into GB or when value updates externally.
  useEffect(() => {
    if (!isGbActive) return
    const digits = (valueRef.current || value || '').replace(/\D/g, '')
    const national = digits.startsWith('44') ? digits.slice(2) : digits
    const clamped = clampGbNationalDigits(national)
    setGbNationalDigits(clamped)
    setGbNationalDisplay(formatGbNationalForDisplay(clamped))
  }, [isGbActive, value])

  const handleGbNationalInputChange = useCallback(
    (e) => {
      const raw = e && e.target ? e.target.value : ''
      const digitsOnly = (raw || '').replace(/\D/g, '')
      const clamped = clampGbNationalDigits(digitsOnly)
      setGbNationalDigits(clamped)
      setGbNationalDisplay(formatGbNationalForDisplay(clamped))

      const gbMeta = countryMetaRef.current || { dialCode: '44', countryCode: 'gb' }
      const finalValue = `+44${clamped}`
      const displayText = `+44 ${formatGbNationalForDisplay(clamped)}`.trim()
      commitFinalValue(finalValue, gbMeta, displayText)
    },
    [commitFinalValue],
  )

  return (
    <div className={rootClassName}>
      {subLabel &&
        (subLabelPosition === 'top' || subLabelPosition === 'left') && (
          <div className="phone-widget-sublabel">{subLabel}</div>
        )}
      <div className="phone-widget-inner" ref={containerRef}>
        <PhoneInput
          country={country}
          value={value}
          onChange={handleChange}
          onMount={(_valueOnMount, dataOnMount) => {
            if (dataOnMount && typeof dataOnMount === 'object') {
              setCountryMeta(dataOnMount)
              countryMetaRef.current = dataOnMount
            }
          }}
          placeholder={placeholder}
          inputProps={isGbActive ? { readOnly: true } : undefined}
          containerClass={
            isGbActive
              ? 'phone-widget-container phone-widget-container--gb'
              : 'phone-widget-container'
          }
          inputClass="phone-widget-input"
          buttonClass="phone-widget-button"
          dropdownClass="phone-widget-dropdown"
          enableSearch={false}
          countryCodeEditable={false}
        />
        {isGbActive && (
          <div className="phone-widget-gb-custom">
            <span className="phone-widget-gb-prefix">+44</span>
            <input
              className="phone-widget-gb-input"
              value={gbNationalDisplay}
              onChange={handleGbNationalInputChange}
              placeholder={placeholder}
              inputMode="numeric"
              autoComplete="tel-national"
              aria-label="UK phone number"
            />
          </div>
        )}
        {!isGbActive &&
          showPlaceholderOverlay &&
          (!(countryMeta && countryMeta.dialCode) || dialMeasured) && (
          <div className="phone-widget-placeholder-overlay">
            <span
              className="phone-widget-placeholder-text"
              style={{
                transform: `translateX(${
                  48 + (countryMeta && countryMeta.dialCode ? dialOffsetPx : 0)
                }px)`,
              }}
            >
              {placeholder}
            </span>
          </div>
        )}
        {/* Invisible dial code measurement span to compute exact width
            in the current rendering environment (Jotform or standalone). */}
        <span
          ref={dialMeasureRef}
          className="phone-widget-dial-measure"
        >
          {countryMeta && countryMeta.dialCode
            ? `+${countryMeta.dialCode} `
            : ''}
        </span>
      </div>
      {subLabel &&
        (subLabelPosition === 'bottom' || subLabelPosition === 'right') && (
          <div className="phone-widget-sublabel">{subLabel}</div>
        )}
    </div>
  )
}
