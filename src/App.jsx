import { useState, useCallback, useEffect, useRef } from 'react'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

const MESSAGE_TYPE = 'react-phone-input-value'

export default function App() {
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

  const handleChange = useCallback((next) => {
    const str = next ?? ''
    setValue(str)

    try {
      window.parent.postMessage({ type: MESSAGE_TYPE, value: str }, '*')

      if (typeof window.JFCustomWidget !== 'undefined') {
        window.JFCustomWidget.sendData({ value: str })
      }
    } catch (_) {}
  }, [])

  return (
    <div style={{ maxWidth: 320 }}>
      <PhoneInput
        placeholder="Enter phone number"
        defaultCountry="US"
        value={value}
        onChange={handleChange}
      />
      <p style={{ marginTop: 8, fontSize: 14, color: '#666' }}>
        Current value: <strong>{value || '—'}</strong>
      </p>
    </div>
  )
}