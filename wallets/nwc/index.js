import { nwcSchema } from '@/lib/validate'

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
  badges: ['send only']
}

export const fieldValidation = nwcSchema
