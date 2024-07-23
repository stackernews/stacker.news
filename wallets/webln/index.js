import { SSR } from '@/lib/constants'

export const name = 'webln'

export const fields = []

export const available = SSR ? false : typeof window.webln !== 'undefined'

export const card = {
  title: 'WebLN',
  subtitle: 'use a [WebLN provider](https://www.webln.guide/ressources/webln-providers) for payments',
  badges: ['send only']
}
