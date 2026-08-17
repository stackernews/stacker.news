import { normalizeHexColor, getContrastTextColor } from '@/lib/color'

// Builds territory token overrides that take precedence over theme defaults.
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
    // Derive hover paint from the same runtime brand value.
    overrides.push(`--sn-linkHover: color-mix(in srgb, ${linkHex} 85%, #000 15%);`)
  }

  if (overrides.length === 0) return null

  // Match both root and theme attributes to outrank the token selector.
  return `:root[data-theme]{${overrides.join('')}}`
}
