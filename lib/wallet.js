import { lnAddrOptions } from './lnurl'
import { lnAddrSchema, ssValidate } from './validate'

export async function fetchLnAddrInvoice ({ addr, amount, maxFee, comment, ...payer },
  {
    me, models, lnd, autoWithdraw = false,
    lnService: { decodePaymentRequest, getIdentity }
  }) {
  const options = await lnAddrOptions(addr)
  await ssValidate(lnAddrSchema, { addr, amount, maxFee, comment, ...payer }, options)

  if (payer) {
    payer = {
      ...payer,
      identifier: payer.identifier ? `${me.name}@stacker.news` : undefined
    }
    payer = Object.fromEntries(
      Object.entries(payer).filter(([, value]) => !!value)
    )
  }

  const milliamount = 1000 * amount
  const callback = new URL(options.callback)
  callback.searchParams.append('amount', milliamount)

  if (comment?.length) {
    callback.searchParams.append('comment', comment)
  }

  let stringifiedPayerData = ''
  if (payer && Object.entries(payer).length) {
    stringifiedPayerData = JSON.stringify(payer)
    callback.searchParams.append('payerdata', stringifiedPayerData)
  }

  // call callback with amount and conditionally comment
  const res = await (await fetch(callback.toString())).json()
  if (res.status === 'ERROR') {
    throw new Error(res.reason)
  }

  // decode invoice
  try {
    const decoded = await decodePaymentRequest({ lnd, request: res.pr })
    const ourPubkey = (await getIdentity({ lnd })).public_key
    if (autoWithdraw && decoded.destination === ourPubkey && process.env.NODE_ENV === 'production') {
      // unset lnaddr so we don't trigger another withdrawal with same destination
      await models.wallet.deleteMany({
        // TODO: replace hardcoded 'LIGHTNING_ADDRESS' with wallet.type
        where: { userId: me.id, type: 'LIGHTNING_ADDRESS' }
      })
      throw new Error('automated withdrawals to other stackers are not allowed')
    }
    if (!decoded.mtokens || BigInt(decoded.mtokens) !== BigInt(milliamount)) {
      throw new Error('invoice has incorrect amount')
    }
  } catch (e) {
    console.log(e)
    throw e
  }

  return res
}
