import { TOR_REGEXP } from '@/lib/url'
import { string } from '@/lib/yup'

export const name = 'lnbits'
export const walletType = 'LNBITS'
export const walletField = 'walletLNbits'

export const fields = [
  {
    name: 'url',
    label: 'lnbits url',
    type: 'text',
    validate: process.env.NODE_ENV === 'development'
      ? string()
        .or([string().matches(/^(http:\/\/)?localhost:\d+$/), string().url()], 'invalid url')
        .trim()
      : string().url().trim()
        .test(async (url, context) => {
          if (TOR_REGEXP.test(url)) {
          // allow HTTP and HTTPS over Tor
            if (!/^https?:\/\//.test(url)) {
              return context.createError({ message: 'http or https required' })
            }
            return true
          }
          try {
          // force HTTPS over clearnet
            await string().https().validate(url)
          } catch (err) {
            return context.createError({ message: err.message })
          }
          return true
        })
  },
  {
    name: 'invoiceKey',
    label: 'invoice key',
    type: 'password',
    optional: 'for receiving',
    serverOnly: true,
    requiredWithout: 'adminKey',
    validate: string().hex().length(32)
  },
  {
    name: 'adminKey',
    label: 'admin key',
    type: 'password',
    optional: 'for sending',
    clientOnly: true,
    requiredWithout: 'invoiceKey',
    validate: string().hex().length(32)
  }
]

export const card = {
  title: 'LNbits',
  subtitle: 'use [LNbits](https://lnbits.com/) for payments',
  badges: ['send', 'receive']
}
