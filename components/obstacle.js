import Button from '@/components/ui/button'

/**
 * Shared button row for obstacles. Provides consistent styling.
 */
export function ObstacleButtons ({
  onClose,
  onConfirm,
  confirmText = 'confirm',
  confirmVariant = 'danger',
  cancelText = 'cancel',
  type = 'button'
}) {
  return (
    <div className='flex justify-around items-center mt-4'>
      <Button variant='grey-medium' onClick={onClose}>{cancelText}</Button>
      <Button variant={confirmVariant} onClick={onConfirm} type={type}>{confirmText}</Button>
    </div>
  )
}
