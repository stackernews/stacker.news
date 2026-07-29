import { useCallback } from 'react'
import { useRouter } from 'next/router'
import { useMutation } from '@apollo/client/react'
import { useMe } from '@/components/me'
import { useShowModal } from '@/components/modal'
import { CREATE_WITHDRAWL, SEND_TO_LNADDR } from '@/fragments/withdrawal'
import { bolt11Description, bolt11ToPayment } from '@/lib/bolt11'
import { formatSats, msatsToSats, satsToMsats, toPositiveNumber } from '@/lib/format'
import { fetchLnAddrInvoice, SUPPORTED_PAYER_DATA_FIELDS } from '@/lib/lnurl'
import { WALLET_SHELL_SEND_PAYMENT_TIMEOUT_MS } from '@/lib/constants'
import { classifyWalletPaymentError, sendWalletPayment } from '@/wallets/client/hooks'
import { errorMessage } from '@/lib/error'
import { invalidateWalletBalanceCache } from '@/wallets/client/balance'
import { DestinationType, parseDestination } from './destination'
import { confirmDuplicateExternalSend, externalSendConfirmation } from './send-confirmation'
import { CREATE_EXTERNAL_SEND, REPORT_EXTERNAL_SEND_OBSERVATION } from '@/wallets/client/fragments'
import { toExternalTransactionObservation } from '@/wallets/lib/external-transactions'

// Custodial send via GraphQL mutations. No success state — navigation is the success.
export function useRewardSatsSubmit () {
  const router = useRouter()
  const [createWithdrawl] = useMutation(CREATE_WITHDRAWL)
  const [sendToLnAddr] = useMutation(SEND_TO_LNADDR)

  return useCallback(async (values, { lnAddrService } = {}) => {
    const destination = parseDestination(values.destination)

    let id
    if (destination.type === DestinationType.BOLT11) {
      assertInvoiceAmount(destination)
      const { data } = await createWithdrawl({ variables: { invoice: destination.value, maxFee: toPositiveNumber(values.maxFee) } })
      id = data.createWithdrawl.id
    } else if (destination.type === DestinationType.LN_ADDR) {
      const { data } = await sendToLnAddr({
        variables: {
          addr: destination.value,
          ...lnAddrSubmitValues(values, lnAddrService),
          amount: toPositiveNumber(values.amount),
          maxFee: toPositiveNumber(values.maxFee)
        }
      })
      id = data.sendToLnAddr.id
    } else {
      throw new Error('enter a bolt11 invoice or lightning address')
    }

    await router.push(`/transactions/${id}`)
  }, [createWithdrawl, router, sendToLnAddr])
}

// External send: resolve to a bolt11, persist the attempt, pay it, then open its
// activity detail.
export function useExternalSubmit ({ wallet, protocol, logger }) {
  const { me } = useMe()
  const meName = me?.name
  const router = useRouter()
  const [createExternalSend] = useMutation(CREATE_EXTERNAL_SEND)
  const [reportExternalSendObservation] = useMutation(REPORT_EXTERNAL_SEND_OBSERVATION)
  const showModal = useShowModal()

  // The server's unique indexes are the duplicate guard.
  // Formik's isSubmitting handles the local double-click case.
  return useCallback(async (values, { lnAddrService } = {}) => {
    const destination = parseDestination(values.destination)

    let bolt11, sats, to
    let lnurlVerifyUrl

    if (destination.type === DestinationType.BOLT11) {
      const msats = assertInvoiceAmount(destination)
      sats = msatsToSats(msats)
      const description = bolt11Description(destination.value)
      bolt11 = destination.value
      to = description || `${destination.value.slice(0, 14)}…${destination.value.slice(-8)}`
    } else if (destination.type === DestinationType.LN_ADDR) {
      sats = toPositiveNumber(values.amount)
      const invoice = await fetchLnAddrInvoice({
        addr: destination.value,
        ...lnAddrSubmitValues(values, lnAddrService),
        amount: sats
      }, { me: { name: meName }, service: lnAddrService })
      bolt11 = invoice.pr
      // LUD-21: a credential-free settlement checker even checkerless wallets get
      lnurlVerifyUrl = typeof invoice.verify === 'string' ? invoice.verify : undefined
      to = destination.value
    } else {
      throw new Error('enter a bolt11 invoice or lightning address')
    }

    const maxFee = protocol?.enforcesMaxFee
      ? toPositiveNumber(values.maxFee)
      : undefined
    const transactionId = await sendExternalPayment({
      wallet,
      protocol,
      bolt11,
      lnurlVerifyUrl,
      destination,
      maxFee,
      logger,
      createExternalSend,
      reportExternalSendObservation,
      confirmDuplicate: message => confirmDuplicateExternalSend(showModal, {
        message,
        amountText: formatSats(sats),
        to
      })
    })
    if (transactionId == null) return

    // The payment is recorded; navigation is best-effort and must never read
    // as a payment failure. Skip it if the user already moved on mid-send.
    if (router.pathname === '/wallets/[id]/send') {
      try {
        // the sent amount + live status live on the transaction page
        await router.push(`/wallets/transactions/${transactionId}`)
      } catch (err) {
        console.error('failed to navigate to transaction page:', err)
      }
    }
  }, [createExternalSend, logger, meName, protocol, reportExternalSendObservation, router, showModal, wallet])
}

// Only send descriptor-backed fields; hidden values can be leftovers from a
// previous address, and fallback submits have no descriptor yet.
function lnAddrSubmitValues (values, { commentAllowed, payerData } = {}) {
  return {
    ...(commentAllowed ? { comment: values.comment } : {}),
    ...Object.fromEntries(
      SUPPORTED_PAYER_DATA_FIELDS
        .filter(field => payerData?.[field])
        .map(field => [field, values[field]]))
  }
}

function assertInvoiceAmount (destination) {
  if (destination.invoiceMsats == null) throw new Error('invoice must specify an amount')
  if (destination.invoiceMsats % 1000n !== 0n) throw new Error('invoice amount must be a whole number of sats')
  return destination.invoiceMsats
}

export async function sendExternalPayment ({
  lnurlVerifyUrl,
  wallet,
  protocol,
  bolt11,
  destination,
  maxFee,
  logger,
  createExternalSend,
  reportExternalSendObservation,
  confirmDuplicate
}) {
  const input = {
    walletId: wallet.id,
    protocolId: Number(protocol.id),
    bolt11,
    sourceType: destination.type === DestinationType.LN_ADDR ? 'LN_ADDR' : 'BOLT11',
    // BOLT11 destinations already send the invoice as bolt11; the server only
    // persists sourceValue for LN_ADDR
    sourceValue: destination.type === DestinationType.LN_ADDR ? destination.value : null,
    ...(maxFee != null ? { maxFeeLimitMsats: String(satsToMsats(maxFee)) } : {}),
    ...(lnurlVerifyUrl ? { lnurlVerifyUrl } : {})
  }
  let response
  try {
    response = await createExternalSend({ variables: { input } })
  } catch (err) {
    const confirmation = externalSendConfirmation(err)
    if (!confirmation || !confirmDuplicate) throw err
    if (!(await confirmDuplicate(confirmation))) return null
    response = await createExternalSend({
      variables: { input: { ...input, duplicateConfirmed: true } }
    })
  }
  const transactionId = response.data.createExternalSend
  const payment = bolt11ToPayment(bolt11)
  const transactionLogger = logger.withContext({ externalTransactionId: transactionId })

  try {
    let observation
    try {
      observation = await sendWalletPayment(protocol, payment, transactionLogger, {
        maxFee,
        timeout: WALLET_SHELL_SEND_PAYMENT_TIMEOUT_MS,
        updateStatus: false,
        waitForTerminal: false
      })
    } catch (err) {
      observation = toExternalTransactionObservation(classifyWalletPaymentError(err), {
        error: err,
        canCheck: typeof protocol?.checkPayment === 'function'
      })
    }

    try {
      await reportExternalSendObservation({
        variables: { input: { id: transactionId, ...observation } }
      })
    } catch (err) {
      // Navigation still goes to the durable attempt. When supported, the
      // global reconciler checks the provider again.
      transactionLogger.warn(`payment observation update failed: ${errorMessage(err)}`)
    }
    return transactionId
  } finally {
    // The wallet may settle after our timeout; refresh before showing retry UI.
    invalidateWalletBalanceCache(protocol)
  }
}
