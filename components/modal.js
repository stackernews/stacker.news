import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import Modal from 'react-bootstrap/Modal'
import BackArrow from '@/svgs/arrow-left-line.svg'
import { useRouter } from 'next/router'
import ActionDropdown from './action-dropdown'

export class ModalClosedError extends Error {
  constructor () {
    super('modal closed')
  }
}

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
  const modalStack = useRef([])
  const [render, forceUpdate] = useReducer(x => x + 1, 0)

  const getCurrentContent = useCallback(() => {
    return modalStack.current[modalStack.current.length - 1]
  }, [])

  const onBack = useCallback(() => {
    getCurrentContent()?.options?.onClose?.()
    modalStack.current.pop()
    forceUpdate()
  }, [])

  const setOptions = useCallback(options => {
    const current = getCurrentContent()
    if (current) {
      current.options = { ...current.options, ...options }
      forceUpdate()
    }
  }, [getCurrentContent, forceUpdate])

  // this is called on every navigation due to below useEffect
  const onClose = useCallback((options) => {
    if (options?.back) {
      for (let i = 0; i < options.back; i++) {
        onBack()
      }
      return
    }

    while (modalStack.current.length) {
      getCurrentContent()?.options?.onClose?.()
      modalStack.current.pop()
    }
    forceUpdate()
  }, [onBack])

  const router = useRouter()
  useEffect(() => {
    const maybeOnClose = () => {
      const content = getCurrentContent()
      const { persistOnNavigate } = content?.options || {}
      if (!persistOnNavigate) {
        onClose()
      }
    }

    router.events.on('routeChangeStart', maybeOnClose)
    return () => router.events.off('routeChangeStart', maybeOnClose)
  }, [router.events, onClose, getCurrentContent])

  const modal = useMemo(() => {
    if (modalStack.current.length === 0) {
      return null
    }

    const content = getCurrentContent()
    const { overflow, keepOpen, fullScreen } = content.options || {}
    const className = fullScreen ? 'fullscreen' : ''

    return (
      <Modal
        onHide={keepOpen ? undefined : onClose} show={!!content}
        className={className}
        dialogClassName={className}
        contentClassName={className}
      >
        <div className='d-flex flex-row'>
          {overflow &&
            <div className={'modal-btn modal-overflow ' + className}>
              <ActionDropdown>
                {overflow}
              </ActionDropdown>
            </div>}
          {modalStack.current.length > 1 ? <div className='modal-btn modal-back' onClick={onBack}><BackArrow width={18} height={18} /></div> : null}
          <div className={'modal-btn modal-close ' + className} onClick={onClose}>X</div>
        </div>
        <Modal.Body className={className}>
          {content.node}
        </Modal.Body>
      </Modal>
    )
  }, [render])

  const showModal = useCallback(
    (getContent, options) => {
      document.activeElement?.blur()
      const ref = { node: getContent(onClose, setOptions), options }
      if (options?.replaceModal) {
        modalStack.current = [ref]
      } else {
        modalStack.current.push(ref)
      }
      forceUpdate()
    },
    [onClose]
  )

  return [modal, showModal]
}
