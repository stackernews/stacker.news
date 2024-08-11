import { lnAddrAutowithdrawSchema } from '@/lib/validate'

export const name = 'lightning-address'
export const shortName = 'lnAddr'

export const fields = [
  {
    name: 'address',
    label: 'lightning address',
    type: 'text',
    autoComplete: 'off'
  }
]

export const card = {
  title: 'lightning address',
  subtitle: 'autowithdraw to a lightning address',
  badges: ['receive only']
}

export const fieldValidation = lnAddrAutowithdrawSchema

export const walletType = 'LIGHTNING_ADDRESS'

export const walletField = 'walletLightningAddress'
