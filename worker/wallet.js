const serialize = require('../api/resolvers/serial')
const { getInvoice, getPayment } = require('ln-service')
const { datePivot } = require('../lib/time')
const { xor, createInvoiceHmac } = require('../lib/crypto')

const walletOptions = { startAfter: 5, retryLimit: 21, retryBackoff: true }

// TODO this should all be done via websockets
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
      // not expired, recheck in 5 seconds if the invoice is younger than 5 minutes
      // otherwise recheck in 60 seconds
      const startAfter = new Date(inv.created_at) > datePivot(new Date(), { minutes: -5 }) ? 5 : 60
      await boss.send('checkInvoice', { hash }, { ...walletOptions, startAfter })
    }
  }
}

function checkWithdrawal ({ boss, models, lnd }) {
  return async function ({ data: { id, hash, paymentTokenHashes } }) {
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

    const calls = []
    if (wdrwl?.is_confirmed) {
      const fee = Number(wdrwl.payment.fee_mtokens)
      const paid = Number(wdrwl.payment.mtokens) - fee
      calls.push(models.$executeRaw`SELECT confirm_withdrawl(${id}::INTEGER, ${paid}, ${fee})`)
      if (paymentTokenHashes?.length > 0) {
        calls.push(models.invoice.deleteMany({ where: { hash: { in: paymentTokenHashes } } }))
      }
      await serialize(models, ...calls)
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
      calls.push(models.$executeRaw`SELECT reverse_withdrawl(${id}::INTEGER, ${status}::"WithdrawlStatus")`)
      if (paymentTokenHashes?.length > 0) {
        for (const xHash of paymentTokenHashes) {
          // reverse invoice hash XOR
          const rHash = xor(
            Buffer.from(xHash, 'hex'),
            Buffer.concat([
              Buffer.alloc(16), Buffer.from(createInvoiceHmac(xHash.slice(0, 32)), 'hex').slice(0, 16)
            ])
          ).toString('hex')
          calls.push(models.invoice.update({ where: { hash: xHash }, data: { hash: rHash } }))
        }
      }
      await serialize(models, ...calls)
    } else {
      // we need to requeue to check again in 5 seconds
      const startAfter = new Date(wdrwl.created_at) > datePivot(new Date(), { minutes: -5 }) ? 5 : 60
      await boss.send('checkWithdrawal', { id, hash }, { ...walletOptions, startAfter })
    }
  }
}

module.exports = { checkInvoice, checkWithdrawal }
