import { sendPayment as clnSendPayment } from '@/lib/cln'

export const name = 'CLN_REST'

export const sendPayment = async (bolt11, config, { signal }) => {
  return await clnSendPayment(bolt11, config, { signal })
}

export const testSendPayment = async ({ socket, rune, cert }, { signal }) => {
  // We only can use the /pay endpoint with the rune so we can't
  // really test the configuration without paying something
  // until https://github.com/stackernews/stacker.news/issues/1287
}
