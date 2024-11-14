import Nostr from '@/lib/nostr'
import { string } from '@/lib/yup'

export const name = 'nwc'
export const walletType = 'NWC'
export const walletField = 'walletNWC'

export const fields = [
  {
    name: 'nwcUrl',
    label: 'connection',
    type: 'password',
    optional: 'for sending',
    clientOnly: true,
    requiredWithout: 'nwcUrlRecv',
    validate: string().nwcUrl()
  },
  {
    name: 'nwcUrlRecv',
    label: 'connection',
    type: 'password',
    optional: 'for receiving',
    serverOnly: true,
    requiredWithout: 'nwcUrl',
    validate: string().nwcUrl()
  }
]

export const card = {
  title: 'NWC',
  subtitle: 'use Nostr Wallet Connect for payments',
  badges: ['send', 'receive', 'budgetable']
}

export async function supportedMethods (nwcUrl, { logger, timeout } = {}) {
  const nwc = await Nostr.nwc(nwcUrl)
  const { error, result } = await nwc.getInfo()
  if (error) throw new Error(error.code + ' ' + error.message)
  return result.methods
}
