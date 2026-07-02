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
import { classifyWalletPaymentError, paymentErrorMessage, sendWalletPayment } from '@/wallets/client/hooks'
import { invalidateWalletBalanceCache } from '@/wallets/client/balance'
import { DestinationType, parseDestination } from './destination'
import { confirmDuplicateExternalSend, externalSendConfirmation, ExternalSendConfirmationCancelledError } from './send-confirmation'
import { CREATE_EXTERNAL_TRANSACTION, UPDATE_EXTERNAL_TRANSACTION } from '@/wallets/client/fragments'
import { classifyExternalTransactionCheck, protocolCanCheckPayment } from '@/wallets/lib/external-transactions'

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

// External send: resolves to a bolt11 and pays through the wallet's protocol;
// reports via onSent so the form can show the sent state.
export function useExternalSubmit ({ wallet, protocol, logger }) {
  const { me } = useMe()
  const meName = me?.name
  const router = useRouter()
  const [createExternalTransaction] = useMutation(CREATE_EXTERNAL_TRANSACTION)
  const [updateExternalTransaction] = useMutation(UPDATE_EXTERNAL_TRANSACTION)
  const showModal = useShowModal()

  // The server's unique indexes are the duplicate guard.
  // Formik's isSubmitting handles the local double-click case.
  return useCallback(async (values, { lnAddrService } = {}) => {
    const destination = parseDestination(values.destination)

    let bolt11, sats, to

    try {
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
        to = destination.value
      } else {
        throw new Error('enter a bolt11 invoice or lightning address')
      }

      const transaction = await sendExternalPayment({
        wallet,
        protocol,
        bolt11,
        destination,
        values,
        logger,
        amountText: formatSats(sats),
        createExternalTransaction,
        updateExternalTransaction,
        confirmDuplicate: duplicate => confirmDuplicateExternalSend(showModal, { duplicate, destination, amountText: formatSats(sats), to })
      })
      // the sent amount + live status live on the transaction page (where receive lands too)
      await router.push(`/wallets/transactions/${transaction.id}`)
    } catch (err) {
      if (err?.confirmationCancelled) return
      throw err
    }
  }, [createExternalTransaction, logger, meName, protocol, router, showModal, updateExternalTransaction, wallet])
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
  wallet,
  protocol,
  bolt11,
  destination,
  values,
  logger,
  amountText,
  createExternalTransaction,
  updateExternalTransaction,
  confirmDuplicate
}) {
  const supportsMaxFee = !!protocol?.enforcesMaxFee
  const transaction = await createExternalSendTransaction({
    wallet,
    protocol,
    bolt11,
    destination,
    values,
    createExternalTransaction,
    supportsMaxFee,
    confirmDuplicate
  })
  const payment = bolt11ToPayment(bolt11)
  const transactionLogger = logger.withContext({ externalTransactionId: transaction.id })

  try {
    let result, error
    try {
      result = await sendWalletPayment(protocol, payment, transactionLogger, {
        ...(supportsMaxFee ? { maxFee: toPositiveNumber(values.maxFee) } : {}),
        amountText,
        timeout: WALLET_SHELL_SEND_PAYMENT_TIMEOUT_MS
      })
    } catch (err) {
      result = classifyWalletPaymentError(err)
      const message = paymentErrorMessage(err)
      if (result.status === 'FAILED') {
        transactionLogger.error(`payment failed: ${message}`, { updateStatus: true })
      } else {
        transactionLogger.warn(`payment outcome unknown: ${message}`, { updateStatus: true })
        error = err
      }
    }

    const update = classifyExternalTransactionCheck(transaction, {
      result,
      error,
      canCheck: protocolCanCheckPayment(protocol)
    })

    try {
      await updateExternalTransaction({
        variables: {
          input: {
            id: transaction.id,
            ...update
          }
        }
      })
    } catch (err) {
      transactionLogger.warn(`payment record update failed: ${paymentErrorMessage(err)}`)
    }
    return transaction
  } finally {
    // The wallet may settle after our timeout; refresh before showing retry UI.
    invalidateWalletBalanceCache(protocol)
  }
}

async function createExternalSendTransaction ({
  wallet,
  protocol,
  bolt11,
  destination,
  values,
  createExternalTransaction,
  supportsMaxFee,
  confirmDuplicate
}) {
  const create = (duplicateConfirmed = false) =>
    createExternalTransaction({
      variables: {
        input: {
          walletId: wallet.id,
          protocolId: Number(protocol.id),
          bolt11,
          sourceType: destination.type === DestinationType.LN_ADDR ? 'LN_ADDR' : 'BOLT11',
          // BOLT11 destinations already send the invoice as bolt11; the server
          // only persists sourceValue for LN_ADDR
          sourceValue: destination.type === DestinationType.LN_ADDR ? destination.value : null,
          ...(supportsMaxFee ? { maxFeeLimitMsats: String(satsToMsats(toPositiveNumber(values.maxFee))) } : {}),
          ...(duplicateConfirmed ? { duplicateConfirmed: true } : {})
        }
      }
    }).then(({ data }) => data.createExternalTransaction)

  try {
    return await create()
  } catch (err) {
    const duplicate = externalSendConfirmation(err)
    if (!duplicate || !confirmDuplicate) throw err
    if (!(await confirmDuplicate(duplicate))) throw new ExternalSendConfirmationCancelledError()
    return await create(true)
  }
}
