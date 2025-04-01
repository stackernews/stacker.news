import { lightningAddressValidator } from '@/lib/validate'

export const name = 'lightning-address'
export const shortName = 'lnAddr'
export const walletType = 'LIGHTNING_ADDRESS'
export const walletField = 'walletLightningAddress'

export const fields = [
  {
    name: 'address',
    label: 'lightning address',
    type: 'text',
    autoComplete: 'off',
    serverOnly: true,
    validate: lightningAddressValidator.test({
      name: 'address',
      test: addr => !addr.toLowerCase().endsWith('@stacker.news'),
      message: 'automated withdrawals must be external'
    })
  }
]

export const card = {
  title: 'lightning address',
  subtitle: 'receive zaps to your lightning address'
}
