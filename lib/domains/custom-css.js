import { normalizeHexColor, hexToRgbTriplet, getContrastTextColor } from '@/lib/color'

// generates CSS variable overrides for Bootstrap and theme colors
// from a per-sub branding row (colors, logo).
//
// globals.scss will re-bind component variables
// to the CSS variables we're overriding here,
// using color-mix() to maintain the brand colors.
export function buildSubBrandingCSS (branding) {
  if (!branding) return null

  const overrides = []

  const primaryHex = normalizeHexColor(branding.primaryColor)
  if (primaryHex) {
    overrides.push(`--bs-primary: ${primaryHex};`)
    const primaryRgb = hexToRgbTriplet(primaryHex)
    if (primaryRgb) overrides.push(`--bs-primary-rgb: ${primaryRgb};`)
    const primaryText = getContrastTextColor(primaryHex)
    if (primaryText) overrides.push(`--theme-primary-text: ${primaryText};`)
  }

  const secondaryHex = normalizeHexColor(branding.secondaryColor)
  if (secondaryHex) {
    overrides.push(`--bs-secondary: ${secondaryHex};`)
    const secondaryRgb = hexToRgbTriplet(secondaryHex)
    if (secondaryRgb) overrides.push(`--bs-secondary-rgb: ${secondaryRgb};`)
    const secondaryText = getContrastTextColor(secondaryHex)
    if (secondaryText) overrides.push(`--theme-secondary-text: ${secondaryText};`)
  }

  const linkHex = normalizeHexColor(branding.linkColor)
  if (linkHex) {
    overrides.push(`--theme-link: ${linkHex};`)
    // slightly darken the base link color (mix with black 15%)
    overrides.push(`--theme-linkHover: color-mix(in srgb, ${linkHex} 85%, #000 15%);`)
  }

  if (overrides.length === 0) return null

  // ensures 0-2-0 specificity, overriding the default global theme 0-1-0 specificity
  return `:root[data-bs-theme]{${overrides.join('')}}`
}
