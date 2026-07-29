import { randomBytes } from 'node:crypto'
import lnService from 'ln-service'
import clientSpark from '../wallets/client/protocols/spark.js'
import serverSpark from '../wallets/server/protocols/spark.js'
import clientErrors from '../wallets/client/errors.js'
import preimageUtils from '../wallets/lib/preimage.js'
import timeUtils from '../lib/time.js'

const { parsePaymentRequest } = lnService
const { checkPayment, dispose, getBalance, sendPayment, testSendPayment } = clientSpark
const { checkInvoice, closeServiceWallet, createInvoice } = serverSpark
const { WalletValidationError } = clientErrors
const { verifyPreimage } = preimageUtils
const { abortableSleep, withTimeoutSignal } = timeUtils

const AMOUNT_MSATS = 1000
const INVOICE_EXPIRY_SECS = 300
const POLL_INTERVAL_MS = 1000
const SETTLEMENT_TIMEOUT_MS = 120_000
const LIVE_TIMEOUT_MS = 300_000
const UNPAID_CHECK_COUNT = 3
const UNPAID_CHECK_INTERVAL_MS = 2000
const UNFUNDED_PROBE_MAX_FEE_SATS = 10
const DESCRIPTION_HASH = '42'.repeat(32)

async function pollUntilSettled (label, checker, parentSignal) {
  let lastError
  try {
    return await withTimeoutSignal(SETTLEMENT_TIMEOUT_MS, async signal => {
      while (true) {
        let result
        try {
          result = await checker(signal)
        } catch (err) {
          if (signal.aborted) throw signal.reason
          // a configuration problem cannot become transient; fail immediately
          if (err instanceof WalletValidationError) throw err
          lastError = err
        }

        if (result?.status === 'SETTLED') return result
        if (result && result.status !== 'PENDING') {
          throw new Error(`${label} reached terminal status ${result.status}${result.detail ? `: ${result.detail}` : ''}`)
        }

        await abortableSleep(POLL_INTERVAL_MS, signal)
      }
    }, { parentSignal })
  } catch (err) {
    if (lastError && err !== lastError) {
      throw new Error(`${err.message} (${label} last check error: ${lastError.message})`, { cause: err })
    }
    throw err
  }
}

// Mirror the worker's early reconciliation checks: a newly created, unpaid
// invoice should remain PENDING rather than being terminalized before payment.
async function assertUnpaidInvoicePending (decoded, providerRequestId, receiver, signal) {
  for (let i = 0; i < UNPAID_CHECK_COUNT; i++) {
    if (i > 0) await abortableSleep(UNPAID_CHECK_INTERVAL_MS, signal)
    const unpaid = await checkInvoice(
      { hash: decoded.id, providerRequestId },
      { identityPubkey: receiver.identityPubkey },
      { signal }
    )
    if (unpaid.status !== 'PENDING') {
      throw new Error(`unpaid Spark invoice check expected PENDING, got ${unpaid.status}${unpaid.detail ? `: ${unpaid.detail}` : ''}`)
    }
  }
  console.log('unpaid invoice checks returned PENDING')
}

function assertVerificationUnsupported (label, result) {
  if (result.status !== 'UNKNOWN' || result.errorType !== 'VERIFICATION_UNSUPPORTED') {
    throw new Error(`${label} expected UNKNOWN/VERIFICATION_UNSUPPORTED, got ${result.status}${result.errorType ? `/${result.errorType}` : ''}`)
  }
}

async function assertInvoiceIsolation (decoded, providerRequestId, receiver, otherIdentityPubkey, signal) {
  const wrongHash = await checkInvoice(
    { hash: randomBytes(32).toString('hex'), providerRequestId },
    { identityPubkey: receiver.identityPubkey },
    { signal }
  )
  assertVerificationUnsupported('wrong-hash invoice check', wrongHash)

  const wrongReceiver = await checkInvoice(
    { hash: decoded.id, providerRequestId },
    { identityPubkey: otherIdentityPubkey },
    { signal }
  )
  assertVerificationUnsupported('wrong-receiver invoice check', wrongReceiver)
  console.log('invoice reconciliation rejected mismatched hash and receiver')
}

async function assertDescriptionHashInvoice (receiver, signal) {
  const { bolt11 } = await createInvoice(
    {
      msats: AMOUNT_MSATS,
      descriptionHash: DESCRIPTION_HASH,
      expiry: 60
    },
    { identityPubkey: receiver.identityPubkey },
    { signal }
  )
  const decoded = parsePaymentRequest({ request: bolt11 })
  if (decoded.description_hash !== DESCRIPTION_HASH) {
    throw new Error(`Spark invoice description hash mismatch: expected ${DESCRIPTION_HASH}, got ${decoded.description_hash}`)
  }
  console.log('created invoice with description hash')
}

// pre-flight SDK rejections must classify as FAILED so the payment pipeline
// releases the invoice hash instead of recording an unknown outcome
async function probeUnfundedSend (receiver, signal) {
  const probe = await testSendPayment({}, { signal })

  const { bolt11 } = await createInvoice(
    {
      msats: AMOUNT_MSATS,
      description: 'SN live Spark e2e unfunded probe',
      expiry: 60
    },
    { identityPubkey: receiver.identityPubkey },
    { signal }
  )
  const rejected = await sendPayment(
    bolt11,
    { mnemonic: probe.mnemonic },
    { signal, maxFee: UNFUNDED_PROBE_MAX_FEE_SATS }
  )
  if (rejected.status !== 'FAILED' || !rejected.detail) {
    throw new Error(`unfunded Spark send expected classified FAILED, got ${rejected.status}${rejected.detail ? `: ${rejected.detail}` : ''}`)
  }
  console.log(`unfunded send classified FAILED (${rejected.detail})`)
}

async function main () {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Spark live E2E cannot run with NODE_ENV=production')
  }
  const payerMnemonic = process.env.SPARK_PAYER_MNEMONIC
  if (!payerMnemonic) throw new Error('SPARK_PAYER_MNEMONIC not set')

  try {
    await withTimeoutSignal(LIVE_TIMEOUT_MS, async signal => {
      const service = await testSendPayment({}, { signal })
      process.env.SPARK_SERVICE_MNEMONIC = service.mnemonic
      const receiver = await testSendPayment({}, { signal })
      console.log('generated service and receiver wallets')

      const importedReceiver = await testSendPayment(
        { mnemonic: receiver.mnemonic },
        { signal }
      )
      if (importedReceiver.mnemonic !== receiver.mnemonic || importedReceiver.identityPubkey !== receiver.identityPubkey) {
        throw new Error('imported Spark mnemonic did not reproduce its generated configuration')
      }
      console.log('re-imported receiver configuration')

      const payerBalance = await getBalance(
        { mnemonic: payerMnemonic },
        { signal }
      )
      if (payerBalance?.currency !== 'BTC' || !(payerBalance.amount > 0)) {
        throw new Error('Spark payer has no available balance')
      }
      console.log('payer has an available BTC balance')

      await assertDescriptionHashInvoice(receiver, signal)

      const { bolt11, providerRequestId } = await createInvoice(
        {
          msats: AMOUNT_MSATS,
          description: 'SN live Spark e2e',
          expiry: INVOICE_EXPIRY_SECS
        },
        { identityPubkey: receiver.identityPubkey },
        { signal }
      )
      const decoded = parsePaymentRequest({ request: bolt11 })
      if (String(decoded.mtokens) !== String(AMOUNT_MSATS)) {
        throw new Error(`Spark invoice amount mismatch: expected ${AMOUNT_MSATS} msats, got ${decoded.mtokens}`)
      }
      console.log('created 1-sat Spark invoice')

      await assertUnpaidInvoicePending(decoded, providerRequestId, receiver, signal)
      await assertInvoiceIsolation(decoded, providerRequestId, receiver, service.identityPubkey, signal)

      const unknownPayment = await checkPayment(
        { hash: randomBytes(32).toString('hex') },
        { mnemonic: payerMnemonic },
        { signal }
      )
      if (unknownPayment.status !== 'PENDING') {
        throw new Error(`unknown Spark payment expected PENDING, got ${unknownPayment.status}`)
      }
      console.log('unknown payment hash remained PENDING')

      const submitted = await sendPayment(
        bolt11,
        { mnemonic: payerMnemonic },
        { signal }
      )
      if (submitted.status !== 'PENDING' && submitted.status !== 'SETTLED') {
        throw new Error(`Spark payment submission reached terminal status ${submitted.status}${submitted.detail ? `: ${submitted.detail}` : ''}`)
      }
      if (submitted.preimage && !verifyPreimage(decoded.id, submitted.preimage)) {
        throw new Error('Spark payment submission returned an invalid preimage')
      }
      console.log(`submitted Spark payment (${submitted.status})`)

      const [outgoing, incoming] = await Promise.all([
        pollUntilSettled('outgoing payment', checkSignal =>
          checkPayment(
            { hash: decoded.id, bolt11, providerRequestId: submitted.providerRequestId },
            { mnemonic: payerMnemonic },
            { signal: checkSignal }
          ), signal),
        pollUntilSettled('incoming invoice', checkSignal =>
          checkInvoice(
            { hash: decoded.id, providerRequestId },
            { identityPubkey: receiver.identityPubkey },
            { signal: checkSignal }
          ), signal)
      ])

      if (!outgoing.preimage || !verifyPreimage(decoded.id, outgoing.preimage)) {
        throw new Error('settled outgoing payment did not return a valid preimage')
      }
      if (!incoming.preimage || !verifyPreimage(decoded.id, incoming.preimage)) {
        throw new Error('settled incoming invoice did not return a valid preimage')
      }
      if (String(incoming.msats) !== String(AMOUNT_MSATS)) {
        throw new Error(`settled invoice amount mismatch: expected ${AMOUNT_MSATS} msats, got ${incoming.msats}`)
      }

      console.log('outgoing payment and incoming invoice settled')

      const [outgoingAgain, incomingAgain] = await Promise.all([
        checkPayment(
          { hash: decoded.id, bolt11, providerRequestId: submitted.providerRequestId },
          { mnemonic: payerMnemonic },
          { signal }
        ),
        checkInvoice(
          { hash: decoded.id, providerRequestId },
          { identityPubkey: receiver.identityPubkey },
          { signal }
        )
      ])
      if (outgoingAgain.status !== 'SETTLED' || outgoingAgain.preimage !== outgoing.preimage) {
        throw new Error('outgoing payment did not remain settled with the same preimage')
      }
      if (incomingAgain.status !== 'SETTLED' || incomingAgain.preimage !== incoming.preimage || String(incomingAgain.msats) !== String(incoming.msats)) {
        throw new Error('incoming invoice did not remain settled with the same preimage and amount')
      }
      console.log('settlement checks remained stable')

      await probeUnfundedSend(receiver, signal)

      console.log('live Spark E2E ok')
    })
  } finally {
    await Promise.all([dispose(), closeServiceWallet()])
  }
}

main().catch(err => {
  console.error(err.message)
  process.exitCode = 1
})
