import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import Modal from 'react-bootstrap/Modal'
import BackArrow from '../svgs/arrow-left-line.svg'
import { useRouter } from 'next/router'
import ActionDropdown from './action-dropdown'

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
  const [modalOptions, setModalOptions] = useState(null)
  const [modalStack, setModalStack] = useState([])

  const onBack = useCallback(() => {
    if (modalStack.length === 0) {
      return setModalContent(null)
    }
    const previousModalContent = modalStack[modalStack.length - 1]
    setModalStack(modalStack.slice(0, -1))
    return setModalContent(previousModalContent)
  }, [modalStack, setModalStack])

  const onClose = useCallback(() => {
    setModalContent(null)
    setModalStack([])
    modalOptions?.onClose?.()
  }, [modalOptions?.onClose])

  const router = useRouter()
  useEffect(() => {
    router.events.on('routeChangeStart', onClose)
    return () => router.events.off('routeChangeStart', onClose)
  }, [router, onClose])

  const modal = useMemo(() => {
    if (modalContent === null) {
      return null
    }
    const className = modalOptions?.fullScreen ? 'fullscreen' : ''
    return (
      <Modal
        onHide={modalOptions?.keepOpen ? null : onClose} show={!!modalContent}
        className={className}
        dialogClassName={className}
        contentClassName={className}
      >
        <div className='d-flex flex-row'>
          {modalOptions?.overflow &&
            <div className={'modal-btn modal-overflow ' + className}>
              <ActionDropdown>
                {modalOptions.overflow}
              </ActionDropdown>
            </div>}
          {modalStack.length > 0 ? <div className='modal-btn modal-back' onClick={onBack}><BackArrow width={18} height={18} className='fill-white' /></div> : null}
          <div className={'modal-btn modal-close ' + className} onClick={onClose}>X</div>
        </div>
        <Modal.Body className={className}>
          {modalContent}
        </Modal.Body>
      </Modal>
    )
  }, [modalContent, onClose])

  const showModal = useCallback(
    (getContent, options) => {
      if (modalContent) {
        if (options?.replaceModal) {
          setModalStack(stack => ([]))
        } else setModalStack(stack => ([...stack, modalContent]))
      }
      setModalOptions(options)
      setModalContent(getContent(onClose))
    },
    [modalContent, onClose]
  )

  return [modal, showModal]
}
