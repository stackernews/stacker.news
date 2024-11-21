export const name = 'webln'
export const walletType = 'WEBLN'
export const walletField = 'walletWebLN'

export const validate = ({ enabled }) => {
  if (enabled && typeof window !== 'undefined' && !window?.webln) {
    throw new Error('no WebLN provider found')
  }
}

export const fields = []

export const card = {
  title: 'WebLN',
  subtitle: 'use a [WebLN provider](https://www.webln.guide/ressources/webln-providers) for payments'
}
