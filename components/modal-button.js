import { useState } from 'react'
import { Modal } from 'react-bootstrap'

export default function ModalButton ({ children, clicker }) {
  const [show, setShow] = useState()

  return (
    <>
      <Modal
        show={show}
        onHide={() => setShow(false)}
      >
        <div className='modal-close' onClick={() => setShow(false)}>X</div>
        <Modal.Body>
          {children}
        </Modal.Body>
      </Modal>
      <div className='pointer' onClick={() => setShow(true)}>{clicker}</div>
    </>
  )
}
