import { useCallback } from 'react'
import { ObstacleButtons } from '@/components/obstacle'
import { useToast } from '@/components/toast'
import { useSingleFlight, useWalletDelete } from '@/wallets/client/hooks'

export function WalletDeleteObstacle ({ wallet, onClose, onSuccess }) {
  const deleteWallet = useWalletDelete(wallet)
  const toaster = useToast()

  const onConfirm = useCallback(async () => {
    try {
      await deleteWallet()
      onClose()
      onSuccess?.()
    } catch (err) {
      console.error('failed to delete wallet:', err)
      toaster.danger('failed to delete wallet')
    }
  }, [deleteWallet, onClose, onSuccess, toaster])

  const [handleConfirm] = useSingleFlight(onConfirm)

  return (
    <div className='text-center'>
      <h4 className='mb-3'>Delete wallet</h4>
      <p className='fw-bold'>
        Are you sure you want to delete this wallet?
      </p>
      <ObstacleButtons onClose={onClose} onConfirm={handleConfirm} confirmText='delete' />
    </div>
  )
}

// Shown when a save would delete the wallet (no remaining capabilities) so the
// user gets an explicit chance to confirm or back out before destroying data.
export function WalletSaveDeleteObstacle ({ onClose, onConfirm }) {
  const handleConfirm = async () => {
    const success = await onConfirm()
    if (success) onClose()
  }

  return (
    <div className='text-center'>
      <h4 className='mb-3'>Delete wallet</h4>
      <p className='fw-bold'>
        Saving will delete this wallet because no capabilities remain.
      </p>
      <p className='text-muted'>
        This removes the saved send and receive configuration on the server.
      </p>
      <ObstacleButtons onClose={onClose} onConfirm={handleConfirm} confirmText='save and delete' />
    </div>
  )
}
