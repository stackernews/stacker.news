import { string } from '@/lib/yup'

export const name = 'bolt12'
export const walletType = 'BOLT12'
export const walletField = 'walletBolt12'
export const isBolt12OnlyWallet = true

export const fields = [
  {
    name: 'offer',
    label: 'bolt12 offer',
    type: 'text',
    placeholder: 'lno....',
    clear: true,
    serverOnly: true,
    validate: string()
  }
]

export const card = {
  title: 'Bolt12',
  subtitle: 'receive payments to a bolt12 offer',
  image: { src: '/wallets/bolt12.svg' }
}
