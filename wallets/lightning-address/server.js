import { lnAddrOptions } from '@/lib/lnurl'
import { fetchLnAddrInvoice } from '@/lib/wallet'

export const server = {
  walletType: 'LIGHTNING_ADDRESS',
  walletField: 'walletLightningAddress',
  resolverName: 'upsertWalletLNAddr',
  testConnect: async (
    { address },
    { me, models, addWalletLog }
  ) => {
    const options = await lnAddrOptions(address)
    await addWalletLog({ wallet: { type: 'LIGHTNING_ADDRESS' }, level: 'SUCCESS', message: 'fetched payment details' }, { me, models })
    return options
  },
  createInvoice: async (
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
}
