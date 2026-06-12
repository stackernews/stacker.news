import { getBalance as clnGetBalance, runeMayAllowMethod, sendPayment as clnSendPayment } from '@/lib/cln'
import { msatsWalletBalance } from './util'

export const name = 'CLN_REST'
// CLN enforces a hard routing fee cap via `pay.maxfee`, so we can pass the
// user-supplied max fee through to the wallet and trust it.
export const enforcesMaxFee = true

export const sendPayment = async (bolt11, config, { signal, maxFee }) => {
  return await clnSendPayment(bolt11, config, { signal, maxFee })
}

export const getBalance = async (config, { signal } = {}) => {
  if (!runeMayAllowMethod(config.rune, 'bkpr-listbalances')) return null

  // CLN bkpr-listbalances reports channel balances in millisats.
  return msatsWalletBalance(await clnGetBalance(config, { signal }))
}

export const testSendPayment = async ({ socket, rune, cert }, { signal }) => {
  // We only can use the /pay endpoint with the rune so we can't
  // really test the configuration without paying something
  // until https://github.com/stackernews/stacker.news/issues/1287
}
