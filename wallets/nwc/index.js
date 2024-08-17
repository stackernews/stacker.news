import { nwcSchema } from '@/lib/validate'

export const name = 'nwc'

export const fields = [
  {
    name: 'nwcUrl',
    label: 'connection',
    type: 'password',
    optional: 'for sending',
    clientOnly: true,
    editable: false
  },
  {
    name: 'nwcUrlRecv',
    label: 'connection',
    type: 'password',
    optional: 'for receiving',
    serverOnly: true,
    editable: false
  }
]

export const card = {
  title: 'NWC',
  subtitle: 'use Nostr Wallet Connect for payments',
  badges: ['send only', 'budgetable']
}

export const fieldValidation = nwcSchema

export const walletType = 'NWC'

export const walletField = 'walletNWC'
