// wip: experimental css injection for branding colors
export const setBrandingColors = (branding) => {
  const styleElement = document.createElement('style')
  styleElement.id = 'branding-colors'

  if (branding.primaryColor) {
    const primaryRgb = hexToRgb(branding.primaryColor)
    const secondaryRgb = hexToRgb(branding.secondaryColor)
    styleElement.textContent = `
      :root {
        --bs-primary: ${branding.primaryColor};
        --bs-primary-rgb: ${primaryRgb};
        --bs-secondary: ${branding.secondaryColor};
        --bs-secondary-rgb: ${secondaryRgb};

        .btn-primary {
          --bs-btn-bg: ${branding.primaryColor};
          --bs-btn-border-color: ${branding.primaryColor};
          --bs-btn-hover-bg: ${adjustBrightness(branding.primaryColor, -10)};
          --bs-btn-hover-border-color: ${adjustBrightness(branding.primaryColor, -10)};
          --bs-btn-active-bg: ${adjustBrightness(branding.primaryColor, -15)};
          --bs-btn-active-border-color: ${adjustBrightness(branding.primaryColor, -15)};
          --bs-btn-outline-color: ${branding.primaryColor};
          --bs-btn-outline-border-color: ${branding.primaryColor};
        }

        .btn-secondary {
          --bs-btn-bg: ${branding.secondaryColor};
          --bs-btn-border-color: ${branding.secondaryColor};
          --bs-btn-hover-bg: ${adjustBrightness(branding.secondaryColor, -10)};
          --bs-btn-hover-border-color: ${adjustBrightness(branding.secondaryColor, -10)};
          --bs-btn-active-bg: ${adjustBrightness(branding.secondaryColor, -15)};
          --bs-btn-active-border-color: ${adjustBrightness(branding.secondaryColor, -15)};
          --bs-btn-outline-color: ${branding.secondaryColor};
          --bs-btn-outline-border-color: ${branding.secondaryColor};
        }

        --bs-navbar-brand-color: ${branding.primaryColor};
        --bs-navbar-brand-hover-color: ${branding.primaryColor};
        --bs-navbar-brand-hover-bg: ${branding.primaryColor};
      }
    `
    document.head.appendChild(styleElement)
  }

  return () => {
    document.head.removeChild(styleElement)
  }
}

function hexToRgb (hex) {
  hex = hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

function adjustBrightness (hex, percent) {
  hex = hex.replace('#', '')
  const num = parseInt(hex, 16)
  const amt = Math.round(2.55 * percent)
  const R = (num >> 16) + amt
  const G = (num >> 8 & 0x00FF) + amt
  const B = (num & 0x0000FF) + amt
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1)
}
