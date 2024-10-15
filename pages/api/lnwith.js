// verify k1 exists
// send back
import models from '@/api/models'
import { datePivot } from '@/lib/time'
import lnd from '@/api/lnd'
import { createWithdrawal } from '@/api/resolvers/wallet'

export default async ({ query, headers }, res) => {
  if (!query.k1) {
    return res.status(400).json({ status: 'ERROR', reason: 'k1 not provided' })
  }

  if (query.pr) {
    try {
      return await doWithdrawal(query, res, headers)
    } catch (e) {
      return res.status(400).json({ status: 'ERROR', reason: e.message })
    }
  }

  let reason
  try {
    const lnwith = await models.lnWith.findFirst({
      where: {
        k1: query.k1,
        createdAt: {
          gt: datePivot(new Date(), { hours: -1 })
        }
      }
    })
    if (lnwith) {
      const user = await models.user.findUnique({ where: { id: lnwith.userId } })
      if (user) {
        return res.status(200).json({
          tag: 'withdrawRequest', // type of LNURL
          callback: process.env.LNWITH_URL, // The URL which LN SERVICE would accept a withdrawal Lightning invoice as query parameter
          k1: query.k1, // Random or non-random string to identify the user's LN WALLET when using the callback URL
          defaultDescription: `Withdrawal for @${user.name} on SN`, // A default withdrawal invoice description
          minWithdrawable: user.msats >= 1000n ? 1000 : 0, // Min amount (in millisatoshis) the user can withdraw from LN SERVICE
          maxWithdrawable: Math.max(Number(user.msats - 10000n), 0) // Max amount (in millisatoshis) the user can withdraw from LN SERVICE
        })
      } else {
        reason = 'user not found'
      }
    } else {
      reason = 'withdrawal not found'
    }
  } catch (error) {
    console.log(error)
    reason = 'internal server error'
  }

  console.log(reason)

  return res.status(400).json({ status: 'ERROR', reason })
}

async function doWithdrawal (query, res, headers) {
  const lnwith = await models.lnWith.findUnique({ where: { k1: query.k1 } })
  if (!lnwith) {
    return res.status(400).json({ status: 'ERROR', reason: 'invalid k1' })
  }
  const me = await models.user.findUnique({ where: { id: lnwith.userId } })
  if (!me) {
    return res.status(400).json({ status: 'ERROR', reason: 'user not found' })
  }

  try {
    const withdrawal = await createWithdrawal(null,
      { invoice: query.pr, maxFee: me.withdrawMaxFeeDefault },
      { me, models, lnd, headers })

    // store withdrawal id lnWith so client can show it
    await models.lnWith.update({ where: { k1: query.k1 }, data: { withdrawalId: Number(withdrawal.id) } })

    return res.status(200).json({ status: 'OK' })
  } catch (e) {
    console.log(e)
    return res.status(400).json({ status: 'ERROR', reason: e.message || e.toString?.() || 'error creating withdrawal' })
  }
}
