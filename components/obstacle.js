import Button from 'react-bootstrap/Button'

/**
 * Shared button row for obstacles. Provides consistent styling.
 */
export function ObstacleButtons ({
  onClose,
  onConfirm,
  confirmText = 'confirm',
  confirmVariant = 'danger',
  confirmDisabled = false,
  cancelText = 'cancel',
  type = 'button'
}) {
  return (
    <div className='d-flex justify-content-around align-items-center mt-3'>
      <Button variant='grey-medium' onClick={onClose}>{cancelText}</Button>
      <Button variant={confirmVariant} onClick={onConfirm} disabled={confirmDisabled} type={type}>{confirmText}</Button>
    </div>
  )
}
