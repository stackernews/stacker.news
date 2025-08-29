import { sendPayment as clnSendPayment } from '@/lib/cln'

export const name = 'CLN_REST'

export const sendPayment = async (bolt11, config, { signal }) => {
  return await clnSendPayment(bolt11, config, { signal })
}

export const testSendPayment = async ({ socket, rune, cert }, { signal }) => {
  // TODO
}
