import { lnbitsSchema } from '@/lib/validate'
import { sendPayment, validate } from 'wallets/lnbits/client'

export const name = 'lnbits'

export const fields = [
  {
    name: 'url',
    label: 'lnbits url',
    type: 'text'
  },
  {
    name: 'adminKey',
    label: 'admin key',
    type: 'password'
  }
]

export const card = {
  title: 'LNbits',
  subtitle: 'use [LNbits](https://lnbits.com/) for payments',
  badges: ['send only', 'non-custodialish']
}

export const schema = lnbitsSchema

export { sendPayment, validate }
