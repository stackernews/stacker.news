import Button from 'react-bootstrap/Button'

export default function ConfirmModal ({
  onConfirm,
  message = 'Are you sure?',
  confirmText = 'yep',
  confirmVariant = 'info',
  onClose
}) {
  return (
    <>
      <p className='fw-bolder'>{message}</p>
      <div className='d-flex justify-content-end'>
        <Button
          variant={confirmVariant}
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmText}
        </Button>
      </div>
    </>
  )
}

export function CancelWorkConfirm ({ onConfirm, onClose }) {
  return (
    <ConfirmModal
      message='Are you sure? You will lose your work'
      confirmText='yes'
      confirmVariant='danger'
      onConfirm={onConfirm}
      onClose={onClose}
    />
  )
}
