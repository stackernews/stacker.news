import { ObstacleButtons } from '@/components/obstacle'
import { E_EXTERNAL_WALLET_SEND_CONFIRMATION_REQUIRED } from '@/lib/error'
import { DestinationType } from './destination'

// Thrown when the user declines the "send anyway" prompt; the send hook swallows it as a no-op.
export class ExternalSendConfirmationCancelledError extends Error {
  constructor () {
    super('send cancelled')
    this.confirmationCancelled = true
  }
}

// Pull the server's "this might be a duplicate" warning out of a failed create mutation. Apollo
// surfaces it as CombinedGraphQLErrors with the GraphQL errors on `errors` (graphQLErrors kept as a
// cross-version fallback). Returns the duplicate info to confirm, or null if it's a different error.
export function externalSendConfirmation (err) {
  const confirmation = graphQLErrors(err).find(error =>
    error?.extensions?.code === E_EXTERNAL_WALLET_SEND_CONFIRMATION_REQUIRED)
  if (!confirmation) return null
  return { ...confirmation.extensions?.duplicate }
}

function graphQLErrors (err) {
  return err?.errors ?? err?.graphQLErrors ?? []
}

// Show the repeat-payment obstacle and resolve to the user's choice (true = send anyway). resolveOnce
// + the showModal onClose default guarantee exactly one resolution, defaulting to cancel on dismiss.
export function confirmDuplicateExternalSend (showModal, { duplicate, destination, amountText, to }) {
  return new Promise(resolve => {
    let settled = false
    const resolveOnce = value => {
      if (settled) return
      settled = true
      resolve(value)
    }

    showModal(onClose => (
      <div className='text-center'>
        <h4 className='mb-3'>Confirm repeat payment</h4>
        <p className='fw-bold'>{duplicateObstacleMessage(duplicate, destination)}</p>
        <p className='text-muted mb-0'>{amountText} to {to}</p>
        <ObstacleButtons
          onClose={() => { resolveOnce(false); onClose() }}
          onConfirm={() => { resolveOnce(true); onClose() }}
          confirmText='send anyway'
          confirmVariant='warning'
        />
      </div>
    ), { onClose: () => resolveOnce(false) })
  })
}

export function duplicateObstacleMessage (duplicate, destination) {
  if (duplicate?.reason === 'LN_ADDR_RECENT_SETTLED') {
    return 'You recently sent this amount to this lightning address.'
  }
  const target = destination.type === DestinationType.LN_ADDR ? 'to this lightning address' : 'for this invoice'
  // checkStopped: SN gave up checking the earlier send, so nothing is "in
  // progress" — its outcome is permanently unconfirmed
  if (duplicate?.checkStopped) {
    return `An earlier payment ${target} was never confirmed. Check the wallet directly before sending again.`
  }
  return `A payment ${target} may already be in progress.`
}
