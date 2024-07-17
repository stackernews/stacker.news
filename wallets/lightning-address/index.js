export const name = 'lightning-address'
export const shortName = 'lnAddr'

export const fields = [
  {
    name: 'address',
    label: 'lightning address',
    type: 'text',
    autoComplete: 'off',
    validate: {
      type: 'email',
      test: {
        test: addr => !addr.endsWith('@stacker.news'),
        message: 'automated withdrawals must be external'
      }
    }
  }
]

export const card = {
  title: 'lightning address',
  subtitle: 'autowithdraw to a lightning address',
  badges: ['receive only', 'non-custodialish']
}

export const walletType = 'LIGHTNING_ADDRESS'

export const walletField = 'walletLightningAddress'
