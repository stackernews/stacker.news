import { useCallback, useState } from 'react'
import { ObstacleButtons } from '@/components/obstacle'
import { useToast } from '@/components/toast'
import { useSingleFlight, useWalletDelete } from '@/wallets/client/hooks'

export function WalletDeleteObstacle ({ wallet, onClose, onSuccess }) {
  const deletePersistedWallet = useWalletDelete(wallet)
  const toaster = useToast()
  const [acknowledged, setAcknowledged] = useState(false)
  const fundLossRisk = wallet?.name === 'SPARK'

  const onConfirm = useCallback(async () => {
    try {
      await deletePersistedWallet()
      onClose()
      onSuccess?.()
    } catch (err) {
      console.error('failed to delete wallet:', err)
      toaster.danger('failed to delete wallet')
    }
  }, [deletePersistedWallet, onClose, onSuccess, toaster])

  const [handleConfirm, deleting] = useSingleFlight(onConfirm)

  return (
    <div className='text-center'>
      <h4 className='mb-4'>Delete wallet</h4>
      <WalletDeletionBarrier fundLossRisk={fundLossRisk} acknowledged={acknowledged} setAcknowledged={setAcknowledged} />
      <ObstacleButtons
        onClose={onClose}
        onConfirm={handleConfirm}
        confirmText={deleting ? 'deleting...' : 'delete'}
        confirmDisabled={deleting || !acknowledged}
      />
    </div>
  )
}

export function WalletDeletionBarrier ({ fundLossRisk = false, acknowledged, setAcknowledged }) {
  return (
    <>
      {fundLossRisk && (
        <p className='text-danger font-bold'>You are deleting a Spark wallet. Without a backup, you will permanently lose access to its funds.</p>
      )}
      <label className='flex items-start gap-2 text-start mt-4'>
        <input
          type='checkbox'
          className='mt-2'
          checked={acknowledged}
          onChange={event => setAcknowledged(event.target.checked)}
        />
        <span>I understand deleted wallet data and credentials cannot be recovered.</span>
      </label>
    </>
  )
}

// Shown when a save would delete the wallet (no remaining capabilities) so the
// user gets an explicit chance to confirm or back out before destroying data.
export function WalletSaveDeleteObstacle ({ wallet, onClose, onConfirm }) {
  const [acknowledged, setAcknowledged] = useState(false)
  const fundLossRisk = wallet?.name === 'SPARK'
  const handleConfirm = async () => {
    const success = await onConfirm()
    if (success) onClose()
  }

  return (
    <div className='text-center'>
      <h4 className='mb-4'>Delete wallet</h4>
      <p className='font-bold'>
        Saving will delete this wallet because no capabilities remain.
      </p>
      <p className='text-muted'>
        This removes the saved send and receive configuration on the server.
      </p>
      <WalletDeletionBarrier fundLossRisk={fundLossRisk} acknowledged={acknowledged} setAcknowledged={setAcknowledged} />
      <ObstacleButtons
        onClose={onClose}
        onConfirm={handleConfirm}
        confirmText='save and delete'
        confirmDisabled={!acknowledged}
      />
    </div>
  )
}
