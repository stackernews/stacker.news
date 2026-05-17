import { getBalance as clnGetBalance, sendPayment as clnSendPayment } from '@/lib/cln'
import { msatsToSats } from '@/lib/format'

export const name = 'CLN_REST'
export const maxFee = true

export const sendPayment = async (bolt11, config, { signal, maxFee }) => {
  return await clnSendPayment(bolt11, config, { signal, maxFee })
}

export const getBalance = async (config, { signal } = {}) => {
  return {
    amount: msatsToSats(await clnGetBalance(config, { signal })),
    currency: 'BTC'
  }
}

export const testSendPayment = async ({ socket, rune, cert }, { signal }) => {
  // We only can use the /pay endpoint with the rune so we can't
  // really test the configuration without paying something
  // until https://github.com/stackernews/stacker.news/issues/1287
}
