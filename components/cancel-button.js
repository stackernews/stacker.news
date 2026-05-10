import { useRouter } from 'next/router'
import Button from 'react-bootstrap/Button'
import { useFormikContext } from 'formik'
import { useShowModal } from './modal'

export default function CancelButton ({ onClick }) {
  const router = useRouter()
  const { dirty } = useFormikContext()
  const showModal = useShowModal()
  const cancel = onClick || (() => router.back())

  return (
    <Button
      className='me-3 text-muted nav-link fw-bold' variant='link' onClick={() => {
        if (dirty) {
          showModal(onClose => (
            <>
              <p className='fw-bolder'>Are you sure? You will lose your work</p>
              <div className='d-flex justify-content-end'>
                <Button
                  variant='info' onClick={() => {
                    cancel()
                    onClose()
                  }}
                >yep
                </Button>
              </div>
            </>
          ))
        } else {
          cancel()
        }
      }}
    >cancel
    </Button>
  )
}
