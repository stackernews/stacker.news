import { lnbitsSchema } from '@/lib/validate'

export const name = 'lnbits'
export const walletType = 'LNBITS'
export const walletField = 'walletLNbits'
export const fieldValidation = lnbitsSchema

export const fields = [
  {
    name: 'url',
    label: 'lnbits url',
    type: 'text'
  },
  {
    name: 'invoiceKey',
    label: 'invoice key',
    type: 'password',
    optional: 'for receiving',
    serverOnly: true,
    editable: false
  },
  {
    name: 'adminKey',
    label: 'admin key',
    type: 'password',
    optional: 'for sending',
    clientOnly: true,
    editable: false
  }
]

export const card = {
  title: 'LNbits',
  subtitle: 'use [LNbits](https://lnbits.com/) for payments',
  badges: ['send & receive']
}
