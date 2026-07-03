import Button from 'react-bootstrap/Button'
import { useSingleFlight } from '@/components/use-single-flight'

/**
 * Shared button row for obstacles. onConfirm handlers are guarded against
 * double-clicks. Submit buttons without onConfirm leave submission and its
 * pending state to the surrounding form.
 */
export function ObstacleButtons ({
  onClose,
  onConfirm,
  confirmText = 'confirm',
  confirmingText,
  confirmVariant = 'danger',
  confirmDisabled = false,
  cancelText = 'cancel',
  type = 'button'
}) {
  const [confirm, inFlight] = useSingleFlight(onConfirm)
  return (
    <div className='flex justify-around items-center mt-4'>
      <Button variant='grey-medium' onClick={onClose} disabled={inFlight}>{cancelText}</Button>
      <Button variant={confirmVariant} onClick={onConfirm ? confirm : undefined} type={type} disabled={confirmDisabled || inFlight}>{inFlight && confirmingText ? confirmingText : confirmText}</Button>
    </div>
  )
}
