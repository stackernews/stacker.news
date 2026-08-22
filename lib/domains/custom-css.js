import { normalizeHexColor, getContrastTextColor } from '@/lib/color'

// Builds territory token overrides that take precedence over theme defaults.
export function buildSubBrandingCSS (branding) {
  if (!branding) return null

  const overrides = []
  // Use native contrast when supported; YIQ values remain the fallback.
  const contrastOverrides = []

  const primaryHex = normalizeHexColor(branding.primaryColor)
  if (primaryHex) {
    overrides.push(`--sn-primary: ${primaryHex};`)
    const primaryText = getContrastTextColor(primaryHex)
    if (primaryText) overrides.push(`--sn-primary-text: ${primaryText};`)
    contrastOverrides.push(`--sn-primary-text: contrast-color(${primaryHex});`)
  }

  const secondaryHex = normalizeHexColor(branding.secondaryColor)
  if (secondaryHex) {
    overrides.push(`--sn-secondary: ${secondaryHex};`)
    const secondaryText = getContrastTextColor(secondaryHex)
    if (secondaryText) overrides.push(`--sn-secondary-text: ${secondaryText};`)
    contrastOverrides.push(`--sn-secondary-text: contrast-color(${secondaryHex});`)
  }

  const linkHex = normalizeHexColor(branding.linkColor)
  if (linkHex) {
    overrides.push(`--sn-link: ${linkHex};`)
    // Derive hover paint from the same runtime brand value.
    overrides.push(`--sn-linkHover: color-mix(in srgb, ${linkHex} 85%, #000 15%);`)
  }

  if (overrides.length === 0) return null

  // Match both root and theme attributes to outrank the token selector.
  let css = `:root[data-theme]{${overrides.join('')}}`
  if (contrastOverrides.length > 0) {
    css += `@supports (color: contrast-color(red)) {:root[data-theme]{${contrastOverrides.join('')}}}`
  }
  return css
}
