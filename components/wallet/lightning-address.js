import { lnAddrOptions } from '@/lib/lnurl'
import { lnAddrAutowithdrawSchema } from '@/lib/validate'
import { fetchLnAddrInvoice } from '@/lib/wallet'

export const name = 'lightning-address'

export const fields = [
  {
    name: 'address',
    label: 'lightning address',
    type: 'text',
    hint: 'tor or clearnet',
    autoComplete: 'off'
  }
]

export const card = {
  title: 'lightning address',
  subtitle: 'autowithdraw to a lightning address',
  badges: ['receive only', 'non-custodialish']
}

export const schema = lnAddrAutowithdrawSchema

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
