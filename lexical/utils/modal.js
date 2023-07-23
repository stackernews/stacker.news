import { useCallback, useMemo, useState } from 'react'
import * as React from 'react'
import { Modal } from 'react-bootstrap'

export default function useModal () {
  const [modalContent, setModalContent] = useState(null)

  const onClose = useCallback(() => {
    setModalContent(null)
  }, [])

  const modal = useMemo(() => {
    if (modalContent === null) {
      return null
    }
    return (
      <Modal onHide={onClose} show={!!modalContent}>
        <div className='modal-close' onClick={onClose}>X</div>
        <Modal.Body>
          {modalContent}
        </Modal.Body>
      </Modal>
    )
  }, [modalContent, onClose])

  const showModal = useCallback(
    (getContent) => {
      setModalContent(getContent(onClose))
    },
    [onClose]
  )

  return [modal, showModal]
}
