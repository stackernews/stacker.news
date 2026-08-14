import { normalizeHexColor, hexToRgbTriplet, getContrastTextColor } from '@/lib/color'

// generates CSS variable overrides from a per-sub branding row (colors, logo):
// re-emits the --sn- brand tokens so a branded domain overrides the
// styles/tokens.css defaults at runtime.
export function buildSubBrandingCSS (branding) {
  if (!branding) return null

  const overrides = []

  const primaryHex = normalizeHexColor(branding.primaryColor)
  if (primaryHex) {
    overrides.push(`--sn-primary: ${primaryHex};`)
    const primaryRgb = hexToRgbTriplet(primaryHex)
    if (primaryRgb) overrides.push(`--sn-primary-rgb: ${primaryRgb};`)
    const primaryText = getContrastTextColor(primaryHex)
    if (primaryText) overrides.push(`--sn-primary-text: ${primaryText};`)
  }

  const secondaryHex = normalizeHexColor(branding.secondaryColor)
  if (secondaryHex) {
    overrides.push(`--sn-secondary: ${secondaryHex};`)
    const secondaryRgb = hexToRgbTriplet(secondaryHex)
    if (secondaryRgb) overrides.push(`--sn-secondary-rgb: ${secondaryRgb};`)
    const secondaryText = getContrastTextColor(secondaryHex)
    if (secondaryText) overrides.push(`--sn-secondary-text: ${secondaryText};`)
  }

  const linkHex = normalizeHexColor(branding.linkColor)
  if (linkHex) {
    overrides.push(`--sn-link: ${linkHex};`)
    // slightly darken the base link color (mix with black 15%)
    overrides.push(`--sn-linkHover: color-mix(in srgb, ${linkHex} 85%, #000 15%);`)
  }

  if (overrides.length === 0) return null

  // ensures 0-2-0 specificity, overriding the default global theme 0-1-0 specificity
  return `:root[data-bs-theme]{${overrides.join('')}}`
}
