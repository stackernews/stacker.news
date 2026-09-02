import { normalizeHexColor, getContrastTextColor } from '@/lib/color'

// generates CSS variable overrides for the theme tokens
// from a per-sub branding row (colors, logo).
export function buildSubBrandingCSS (branding) {
  if (!branding) return null

  const overrides = []

  const primaryHex = normalizeHexColor(branding.primaryColor)
  if (primaryHex) {
    overrides.push(`--sn-primary: ${primaryHex};`)
    const primaryText = getContrastTextColor(primaryHex)
    if (primaryText) overrides.push(`--sn-primary-text: ${primaryText};`)
  }

  const secondaryHex = normalizeHexColor(branding.secondaryColor)
  if (secondaryHex) {
    overrides.push(`--sn-secondary: ${secondaryHex};`)
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

  // ensures 0-2-0 specificity, overriding the default theme's 0-1-0 specificity
  return `:root[data-theme]{${overrides.join('')}}`
}
