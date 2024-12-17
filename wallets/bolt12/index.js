import { string } from '@/lib/yup'

export const name = 'bolt12'
export const walletType = 'BOLT12'
export const walletField = 'walletBolt12'

export const fields = [
  {
    name: 'offer',
    label: 'bolt12 offer',
    type: 'text',
    placeholder: 'lno....',
    hint: 'bolt 12 offer',
    clear: true,
    serverOnly: true,
    validate: string()
  }
]

export const card = {
  title: 'Bolt12',
  subtitle: 'bolt12'
}
