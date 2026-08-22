import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import BackArrow from '@/svgs/arrow-left-line.svg'
import { useRouter } from 'next/router'
import ActionDropdown from './action-dropdown'
import { cn } from '@/lib/cn'
import styles from './modal.module.css'

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
  const popupRef = useRef(null)
  const lastPointerDownAtRef = useRef(0)
  const shownAtRef = useRef(0)

  // A press can begin before the dialog mounts and end outside it afterward.
  // Record pointer starts globally so that release cannot dismiss a dialog
  // that did not exist when the interaction began.
  useEffect(() => {
    const stamp = e => { lastPointerDownAtRef.current = e.timeStamp }
    document.addEventListener('pointerdown', stamp, true)
    return () => document.removeEventListener('pointerdown', stamp, true)
  }, [])

  const getCurrentContent = useCallback(() => {
    return modalStack.current[modalStack.current.length - 1]
  }, [])

  // Unmount before onClose so a payment watcher's cancellation cannot close
  // the remaining stack through its error handler.
  const onBack = useCallback(() => {
    const current = getCurrentContent()
    modalStack.current.pop()
    forceUpdate()
    current?.options?.onClose?.()
  }, [getCurrentContent])

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

    return (
      <Dialog.Root
        open
        onOpenChange={(open, details) => {
          if (open) return
          // The explicit close control always closes. keepOpen only disables
          // light dismissal.
          if (details.reason === 'close-press') return onClose()
          // a press that began before the modal showed can't mean "dismiss it";
          // this exempts the long-press release and the territory hover-card
          // race. A fresh press stamps later than shownAt, so real outside
          // clicks still close
          if (details.reason === 'outside-press' && lastPointerDownAtRef.current < shownAtRef.current) return
          // Escape and outside press are light-dismiss reasons.
          if (!keepOpen) onClose()
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className={styles.backdrop} />
          <Dialog.Viewport className={cn(styles.viewport, fullScreen && styles.fullScreen)}>
            <Dialog.Popup
              ref={popupRef}
              aria-label='Dialog'
              // Focusing the popup avoids opening a mobile keyboard or painting
              // a descendant focus ring as soon as the dialog appears.
              initialFocus={() => popupRef.current}
              className={cn(styles.popup, fullScreen ? styles.fullScreen : 'm-2 sm:mx-auto sm:my-7 sm:max-w-lg rounded-lg')}
            >
              <div className='flex flex-row'>
                {overflow &&
                  <div className={cn(styles.btn, styles.overflow, fullScreen && styles.fullScreen)}>
                    <ActionDropdown>
                      {overflow}
                    </ActionDropdown>
                  </div>}
                {modalStack.current.length > 1
                  ? <button type='button' aria-label='Back' className={cn(styles.btn, styles.back)} onClick={onBack}><BackArrow width={18} height={18} /></button>
                  : null}
                <Dialog.Close
                  aria-label='Close'
                  className={cn(styles.btn, styles.close, fullScreen && styles.fullScreen)}
                >X
                </Dialog.Close>
              </div>
              <div className={cn(styles.body, fullScreen ? styles.fullScreen : 'p-8')}>
                {content.node}
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }, [render])

  const showModal = useCallback(
    (getContent, options) => {
      document.activeElement?.blur()
      // performance.now() and event.timeStamp share a clock, so pointer starts
      // recorded before this point can be excluded from outside dismissal.
      shownAtRef.current = performance.now()
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
