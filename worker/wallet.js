const serialize = require('../api/resolvers/serial')
const { getInvoice, getPayment } = require('ln-service')

const walletOptions = { startAfter: 5, retryLimit: 21, retryBackoff: true }

function checkInvoice ({ boss, models, lnd }) {
  return async function ({ data: { hash } }) {
    let inv
    try {
      inv = await getInvoice({ id: hash, lnd })
    } catch (err) {
      console.log(err)
      // on lnd related errors, we manually retry so we don't exponentially backoff
      await boss.send('checkInvoice', { hash }, walletOptions)
      return
    }
    console.log(inv)

    if (inv.is_confirmed) {
      await serialize(models,
        models.$executeRaw`SELECT confirm_invoice(${inv.id}, ${Number(inv.received_mtokens)})`)
      await boss.send('nip57', { hash })
    } else if (inv.is_canceled) {
      // mark as cancelled
      await serialize(models,
        models.invoice.update({
          where: {
            hash: inv.id
          },
          data: {
            cancelled: true
          }
        }))
    } else if (new Date(inv.expires_at) > new Date()) {
      // not expired, recheck in 5 seconds
      await boss.send('checkInvoice', { hash }, walletOptions)
    }
  }
}

function checkWithdrawal ({ boss, models, lnd }) {
  return async function ({ data: { id, hash } }) {
    let wdrwl
    let notFound = false
    try {
      wdrwl = await getPayment({ id: hash, lnd })
    } catch (err) {
      console.log(err)
      if (err[1] === 'SentPaymentNotFound') {
        notFound = true
      } else {
        // on lnd related errors, we manually retry so we don't exponentially backoff
        await boss.send('checkWithdrawal', { id, hash }, walletOptions)
        return
      }
    }
    console.log(wdrwl)

    if (wdrwl?.is_confirmed) {
      const fee = Number(wdrwl.payment.fee_mtokens)
      const paid = Number(wdrwl.payment.mtokens) - fee
      await serialize(models, models.$executeRaw`
      SELECT confirm_withdrawl(${id}::INTEGER, ${paid}, ${fee})`)
    } else if (wdrwl?.is_failed || notFound) {
      let status = 'UNKNOWN_FAILURE'
      if (wdrwl?.failed.is_insufficient_balance) {
        status = 'INSUFFICIENT_BALANCE'
      } else if (wdrwl?.failed.is_invalid_payment) {
        status = 'INVALID_PAYMENT'
      } else if (wdrwl?.failed.is_pathfinding_timeout) {
        status = 'PATHFINDING_TIMEOUT'
      } else if (wdrwl?.failed.is_route_not_found) {
        status = 'ROUTE_NOT_FOUND'
      }
      await serialize(models, models.$executeRaw`
      SELECT reverse_withdrawl(${id}::INTEGER, ${status}::"WithdrawlStatus")`)
    } else {
      // we need to requeue to check again in 5 seconds
      await boss.send('checkWithdrawal', { id, hash }, walletOptions)
    }
  }
}

module.exports = { checkInvoice, checkWithdrawal }
