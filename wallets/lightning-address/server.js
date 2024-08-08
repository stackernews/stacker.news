import { addWalletLog } from '@/api/resolvers/wallet'
import { lnAddrOptions } from '@/lib/lnurl'

export * from 'wallets/lightning-address'

export const testConnectServer = async (
  { address },
  { me, models }
) => {
  const options = await lnAddrOptions(address)
  await addWalletLog({ wallet: { type: 'LIGHTNING_ADDRESS' }, level: 'SUCCESS', message: 'fetched payment details' }, { me, models })
  return options
}

export const createInvoice = async (
  { msats, description },
  { address }
) => {
  const { callback, commentAllowed } = await lnAddrOptions(address)
  const callbackUrl = new URL(callback)
  callbackUrl.searchParams.append('amount', msats)

  if (commentAllowed >= description?.length) {
    callbackUrl.searchParams.append('comment', description)
  }

  // call callback with amount and conditionally comment
  const res = await (await fetch(callbackUrl.toString())).json()
  if (res.status === 'ERROR') {
    throw new Error(res.reason)
  }

  return res.pr
}
