export const name = 'webln'

export const fields = []

export const fieldValidation = ({ enabled }) => {
  if (typeof window.webln === 'undefined') {
    // don't prevent disabling WebLN if no WebLN provider found
    if (enabled) {
      return {
        enabled: 'no WebLN provider found'
      }
    }
  }
  return {}
}

export const card = {
  title: 'WebLN',
  subtitle: 'use a [WebLN provider](https://www.webln.guide/ressources/webln-providers) for payments',
  badges: ['send only']
}
