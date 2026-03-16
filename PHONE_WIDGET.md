# Phone Input Widget (react-phone-input-2)

## 1. Max-length logic

- **Source of truth:** `react-phone-input-2` passes a `country` object into `onChange(value, country, e, formattedValue)`. That object includes `dialCode` (e.g. `"1"`, `"90"`) and `format` (e.g. `" (###) ###-####"` where `#` and `.` are digit placeholders).
- **Computation:**  
  `maxDigits = (number of digits in dialCode) + (number of `#` or `.` in format)`  
  Example: US → dialCode `"1"` = 1 digit, format has 10 placeholders → max 11 digits total (after the `+`).
- **Enforcement:** On every `onChange`, we compute `maxDigits` for the current country, strip the value to digits only, and if the count exceeds `maxDigits` we slice to `maxDigits` and set the value to `+` + those digits. So the limit is enforced in code, not only visually.
- **When country changes:** The library calls `onChange` with the new country; we use that same callback to recalc `maxDigits` and trim if the existing number is too long for the new country.
- **Counting:** Only digits are counted; spaces, parentheses, dashes, etc. are ignored. The stored value is the full international number (with `+`); we count `value.replace(/\D/g, '').length`.

## 2. react-phone-input-2 country metadata and formatting

- **CountryData (onChange second argument):**  
  `{ name, dialCode, countryCode (ISO2), format }`.  
  `format` is the display pattern for the national part (e.g. `" (###) ###-####"` for US). We use `dialCode` and `format` only for max-length; we do not alter the library’s own formatting.
- **ISO2:** The widget uses ISO2 codes (e.g. `tr`, `gb`, `us`). Default country is read from the URL as `?defaultCountry=xx` and normalized to lowercase; invalid or missing falls back to `"us"`.
- **Value shape:** The library works with the full international number including `+` (e.g. `+905321234567`). It handles formatting in the input; we only restrict length by trimming digits and setting the value back.
- **E.164:** We cap `maxDigits` at 15 to stay within E.164. If a country’s `format` + `dialCode` would exceed 15, we still only allow 15 digits.

## 3. Jotform iframe & defaultCountry (config only)

- The widget still uses `JFCustomWidget` when present: `ready` for initial value, `sendData` on change, `sendSubmit` on form submit. `postMessage` is also sent for non-Jotform embeds.
- **defaultCountry** is internal config only: read from the iframe URL query (`?defaultCountry=tr`) and used to set the initial selected country. It is **not** rendered as any visible input, search field, or dropdown—only the phone input and country-flag dropdown are shown. Fallback is `"us"` if missing or invalid.
- The country dropdown has **no search box** (`enableSearch={false}`) so no extra text field appears; only the phone number input is a visible text field.

## 4. Build and deploy

- `npm run build` → output in `dist/`. Host that URL and use it as the Jotform iFrame Widget URL (see `JOTFORM.md`).
- Control size: **330×40 px**; placeholder: **"Enter phone number"**. Styling in `src/index.css` uses minimal overrides (wrapper + input dimensions only); `.flag-dropdown`, `.selected-flag`, and `.country-list` are left to the library so the country selector behaves and looks like the default react-phone-input-2.
