import { string } from 'yup'

export const name = 'cashu'
export const walletType = 'CASHU'
export const walletField = 'walletCashu'

export const fields = [
  {
    name: 'mintUrl',
    label: 'mint url',
    clientOnly: true,
    type: 'text',
    // TODO: add mint suggestions
    validate: process.env.NODE_ENV === 'development'
      ? string().url().required('required').trim()
      : string().https().required('required').trim()
  }
]

export const card = {
  title: 'Cashu',
  subtitle: 'use [Cashu](https://cashu.space) for payments',
  image: { src: '/wallets/cashu.png' }
}
