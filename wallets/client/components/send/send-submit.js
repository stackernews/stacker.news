import { useCallback } from 'react'
import { useRouter } from 'next/router'
import { useMutation } from '@apollo/client/react'
import { useMe } from '@/components/me'
import { CREATE_WITHDRAWL, SEND_TO_LNADDR } from '@/fragments/withdrawal'
import { bolt11Description, bolt11ToPayment } from '@/lib/bolt11'
import { formatSats, msatsToSats, toPositiveNumber } from '@/lib/format'
import { fetchLnAddrInvoice, SUPPORTED_PAYER_DATA_FIELDS } from '@/lib/lnurl'
import { WALLET_SHELL_SEND_PAYMENT_TIMEOUT_MS } from '@/lib/constants'
import { paymentErrorMessage, sendWalletPayment } from '@/wallets/client/hooks'
import { invalidateWalletBalanceCache } from '@/wallets/client/balance'
import { DestinationType, parseDestination } from './destination'

// Custodial send via GraphQL mutations. No success state — navigation is the success.
export function useRewardSatsSubmit () {
  const router = useRouter()
  const [createWithdrawl] = useMutation(CREATE_WITHDRAWL)
  const [sendToLnAddr] = useMutation(SEND_TO_LNADDR)

  return useCallback(async (values, { lnAddrService } = {}) => {
    const destination = parseDestination(values.destination)

    if (destination.type === DestinationType.BOLT11) {
      assertInvoiceAmount(destination)
      const { data } = await createWithdrawl({ variables: { invoice: destination.value, maxFee: toPositiveNumber(values.maxFee) } })
      await router.push(`/transactions/${data.createWithdrawl.id}`)
      return
    }

    if (destination.type === DestinationType.LN_ADDR) {
      const { data } = await sendToLnAddr({
        variables: {
          addr: destination.value,
          ...lnAddrSubmitValues(values, lnAddrService),
          amount: toPositiveNumber(values.amount),
          maxFee: toPositiveNumber(values.maxFee)
        }
      })
      await router.push(`/transactions/${data.sendToLnAddr.id}`)
      return
    }

    throw new Error('enter a bolt11 invoice or lightning address')
  }, [createWithdrawl, router, sendToLnAddr])
}

// External send: resolves to a bolt11 and pays through the wallet's protocol;
// reports via onSent so the form can show the sent state.
export function useExternalSubmit ({ protocol, logger, onSent }) {
  const { me } = useMe()
  const meName = me?.name

  return useCallback(async (values, { lnAddrService } = {}) => {
    const destination = parseDestination(values.destination)
    let bolt11, sats, to

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

    await sendExternalPayment({ protocol, bolt11, values, logger, amountText: formatSats(sats) })
    onSent({ sats, to })
  }, [logger, meName, onSent, protocol])
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

async function sendExternalPayment ({ protocol, bolt11, values, logger, amountText }) {
  const supportsMaxFee = !!protocol?.enforcesMaxFee
  try {
    await sendWalletPayment(protocol, bolt11ToPayment(bolt11), logger, {
      ...(supportsMaxFee ? { maxFee: toPositiveNumber(values.maxFee) } : {}),
      amountText,
      timeout: WALLET_SHELL_SEND_PAYMENT_TIMEOUT_MS,
      // direct send has no server-side poll backstop, so a missing/invalid
      // preimage must surface as an error rather than a silent success.
      requirePreimage: true
    })
  } catch (err) {
    if (err?.settledUnknown) {
      logger.warn(`payment outcome unknown: ${paymentErrorMessage(err)}`, { updateStatus: true })
    } else {
      logger.error(`payment failed: ${paymentErrorMessage(err)}`, { updateStatus: true })
    }
    throw err
  } finally {
    // Always refresh the balance: if the wallet settled after our timeout
    // fired, the user must see the updated balance to know not to retry.
    invalidateWalletBalanceCache(protocol)
  }
}
