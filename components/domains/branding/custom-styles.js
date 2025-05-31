import { useBranding } from './index'
import { useEffect } from 'react'

export default function CustomStyles () {
  const branding = useBranding()

  useEffect(() => {
    if (branding && branding.primaryColor) {
      // dynamic colors
      document.documentElement.style.setProperty('--bs-primary', branding.primaryColor)
      document.documentElement.style.setProperty('--bs-secondary', branding.secondaryColor)
      // hex to rgb for compat
      document.documentElement.style.setProperty('--bs-primary-rgb', hexToRgb(branding.primaryColor))
      document.documentElement.style.setProperty('--bs-secondary-rgb', hexToRgb(branding.secondaryColor))
    }

    return () => {
      // TODO: not sure if this is a good practice: reset to default values when component unmounts
      document.documentElement.style.removeProperty('--bs-primary')
      document.documentElement.style.removeProperty('--bs-secondary')
      document.documentElement.style.removeProperty('--bs-primary-rgb')
      document.documentElement.style.removeProperty('--bs-secondary-rgb')
    }
  }, [branding])
}

// hex to rgb for compat
function hexToRgb (hex) {
  hex = hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}
