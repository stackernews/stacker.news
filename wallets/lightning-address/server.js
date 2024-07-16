import { fetchLnAddrInvoice } from '@/api/resolvers/wallet'
import { lnAddrOptions } from '@/lib/lnurl'

export * from 'wallets/lightning-address'

export const walletType = 'LIGHTNING_ADDRESS'

export const walletField = 'walletLightningAddress'

export const testConnect = async (
  { address },
  { me, models, addWalletLog }
) => {
  const options = await lnAddrOptions(address)
  await addWalletLog({ wallet: { type: 'LIGHTNING_ADDRESS' }, level: 'SUCCESS', message: 'fetched payment details' }, { me, models })
  return options
}

export const createInvoice = async (
  { amount, maxFee },
  { address },
  { me, models, lnd, lnService }
) => {
  const res = await fetchLnAddrInvoice({ addr: address, amount, maxFee }, {
    me,
    models,
    lnd,
    lnService,
    autoWithdraw: true
  })
  return res.pr
}
