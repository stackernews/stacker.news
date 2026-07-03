import { ObstacleButtons } from '@/components/obstacle'
import { E_EXTERNAL_WALLET_SEND_CONFIRMATION_REQUIRED } from '@/lib/error'
import { graphQLErrors } from '@/wallets/client/errors'

// Pull the server's repeat-payment warning out of a failed create mutation.
// Returns the server-composed message, or null if it's a different error.
export function externalSendConfirmation (err) {
  const confirmation = graphQLErrors(err).find(error =>
    error?.extensions?.code === E_EXTERNAL_WALLET_SEND_CONFIRMATION_REQUIRED)
  return confirmation?.message ?? null
}

// Show the repeat-payment obstacle and resolve to the user's choice (true = send anyway). resolveOnce
// + the showModal onClose default guarantee exactly one resolution, defaulting to cancel on dismiss.
export function confirmDuplicateExternalSend (showModal, { message, amountText, to }) {
  return new Promise(resolve => {
    let settled = false
    const resolveOnce = value => {
      if (settled) return
      settled = true
      resolve(value)
    }

    showModal(onClose => (
      <div className='text-center'>
        <h4 className='mb-4'>Confirm repeat payment</h4>
        <p className='font-bold'>{message}</p>
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
