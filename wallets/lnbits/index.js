export const name = 'lnbits'

export const fields = [
  {
    name: 'url',
    label: 'lnbits url',
    type: 'text',
    validate: {
      type: 'url',
      onionAllowed: true
    }
  },
  {
    name: 'adminKey',
    label: 'admin key',
    type: 'password',
    validate: {
      type: 'string',
      length: 32
    }
  }
]

export const card = {
  title: 'LNbits',
  subtitle: 'use [LNbits](https://lnbits.com/) for payments',
  badges: ['send only', 'non-custodialish']
}
