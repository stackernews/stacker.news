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

  // a long press can straddle the mount: pointerdown before the dialog exists, release
  // after. the browser composes both halves into a click outside the popup, which Base UI
  // dismisses as an outside-press (rb keyed mousedown, so pre-mount presses never counted).
  // the composed click doesn't carry its pointerdown's time, so a document listener has to
  // witness every press for the dismissal gate below to compare against
  useEffect(() => {
    const stamp = e => { lastPointerDownAtRef.current = e.timeStamp }
    document.addEventListener('pointerdown', stamp, true)
    return () => document.removeEventListener('pointerdown', stamp, true)
  }, [])

  const getCurrentContent = useCallback(() => {
    return modalStack.current[modalStack.current.length - 1]
  }, [])

  // back steps to the previous modal in the stack. we pop (unmounting the current modal — and, for
  // a QR, stopping its payment watcher) BEFORE running its onClose, so cancelling the invoice can't
  // escalate into a full-stack close via the watcher's onPaymentError. net: back returns to the
  // previous step (e.g. the amount form) and still cancels the invoice so it doesn't dangle.
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
        open // mounted means open: an empty stack returns null above, and unmount is the instant close
        onOpenChange={(open, details) => {
          if (open) return
          // the X (Dialog.Close, reason 'close-press') always closes, even under
          // keepOpen: the old onHide={undefined} only ever killed light dismiss,
          // the X called onClose directly
          if (details.reason === 'close-press') return onClose()
          // a press that began before the modal showed can't mean "dismiss it";
          // this exempts the long-press release and the territory hover-card
          // race. A fresh press stamps later than shownAt, so real outside
          // clicks still close
          if (details.reason === 'outside-press' && lastPointerDownAtRef.current < shownAtRef.current) return
          // light dismiss (escape key or outside press) is gated exactly like the old onHide
          if (!keepOpen) onClose()
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className={styles.backdrop} />
          <Dialog.Viewport className={cn(styles.viewport, fullScreen && styles.fullScreen)}>
            <Dialog.Popup
              ref={popupRef}
              // focus the popup itself like the old .modal container was focused;
              // Base UI's first-tabbable default would paint focus rings and open
              // mobile keyboards where none appeared before. finalFocus lands on
              // body via showModal's blur
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
                  ? <div className={cn(styles.btn, styles.back)} onClick={onBack}><BackArrow width={18} height={18} /></div>
                  : null}
                <Dialog.Close
                  nativeButton={false}
                  render={<div className={cn(styles.btn, styles.close, fullScreen && styles.fullScreen)}>X</div>}
                />
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
      // performance.now() shares event.timeStamp's clock; stamping here (before the actual
      // mount) only widens the exemption toward presses that are strictly pre-mount
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
