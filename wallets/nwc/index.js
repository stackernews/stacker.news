import { nwcSchema } from '@/lib/validate'
import { sendPayment, validate } from 'wallets/nwc/client'

export const name = 'nwc'

export const fields = [
  {
    name: 'nwcUrl',
    label: 'connection',
    type: 'password'
  }
]

export const card = {
  title: 'NWC',
  subtitle: 'use Nostr Wallet Connect for payments',
  badges: ['send only', 'non-custodialish']
}

export const schema = nwcSchema

export { sendPayment, validate }
