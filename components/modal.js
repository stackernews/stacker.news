import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import Modal from 'react-bootstrap/Modal'

export const ShowModalContext = createContext(() => null)

export function ShowModalProvider ({ children }) {
  const [modal, showModal] = useModal()
  const contextValue = showModal

  return (
    <ShowModalContext.Provider value={contextValue}>
      {children}
      {modal}
    </ShowModalContext.Provider>
  )
}

export function useShowModal () {
  return useContext(ShowModalContext)
}

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
