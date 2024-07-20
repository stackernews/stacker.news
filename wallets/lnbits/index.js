import { lnbitsSchema } from '@/lib/validate'

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
  badges: ['send only']
}

export const fieldValidation = lnbitsSchema
