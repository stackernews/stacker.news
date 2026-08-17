// Helpers normalize territory brand colors and choose readable text.

// Matches #rgb, #rgba, #rrggbb, #rrggbbaa (case-insensitive)
export const HEX_REGEXP = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

export function isValidHexColor (input) {
  if (typeof input !== 'string') return false
  return HEX_REGEXP.test(input.trim())
}

// Returns the canonical lowercase 7-char hex (e.g. "#ff6600") or null.
// Strips alpha channel if provided and expands shorthand.
export function normalizeHexColor (input) {
  if (!isValidHexColor(input)) return null
  let hex = input.trim().slice(1).toLowerCase()
  // expand shorthand: rgb -> rrggbb, rgba -> rrggbbaa
  if (hex.length === 3 || hex.length === 4) {
    hex = hex.split('').map(c => c + c).join('')
  }
  // drop alpha if present; the brand variables don't carry alpha
  return '#' + hex.slice(0, 6)
}

// Returns readable black or white text using the YIQ luminance threshold.
export function getContrastTextColor (input) {
  const normalized = normalizeHexColor(input)
  if (!normalized) return null
  const r = parseInt(normalized.slice(1, 3), 16)
  const g = parseInt(normalized.slice(3, 5), 16)
  const b = parseInt(normalized.slice(5, 7), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 128 ? '#000000' : '#ffffff'
}
