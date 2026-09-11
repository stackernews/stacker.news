import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import BackArrow from '@/svgs/arrow-left-line.svg'
import { useRouter } from 'next/router'
import ActionDropdown from './action-dropdown'
import { cn } from '@/lib/cn'
import { closeClasses } from '@/components/ui/close'
import styles from './modal.module.css'

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
  const canPointerDismissRef = useRef(false)

  // the zap long press opens a modal before release; require a new press to dismiss it
  useEffect(() => {
    const allowPointerDismiss = () => { canPointerDismissRef.current = true }
    document.addEventListener('pointerdown', allowPointerDismiss, true)
    return () => document.removeEventListener('pointerdown', allowPointerDismiss, true)
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
    const btn = 'flex items-center pt-4'

    return (
      <Dialog.Root
        open
        onOpenChange={(open, details) => {
          if (open) return
          // the X always closes, keepOpen only disables light dismiss
          if (details.reason === 'close-press') return onClose()
          if (details.reason === 'outside-press' && !canPointerDismissRef.current) {
            details.cancel()
            return
          }
          if (!keepOpen) onClose()
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className={styles.backdrop} />
          <Dialog.Viewport className={cn(styles.viewport, fullScreen && styles.fullScreen)}>
            <Dialog.Popup
              ref={popupRef}
              // focus the popup itself so we don't open a mobile keyboard or show a focus ring on open
              initialFocus={popupRef}
              className={cn(
                styles.popup,
                fullScreen && styles.fullScreen,
                fullScreen ? 'm-0 max-w-screen max-h-svh' : 'm-2 sm:mx-auto sm:my-7 sm:max-w-lg rounded-lg'
              )}
            >
              <div className='flex'>
                {overflow &&
                  <div className={cn(btn, 'cursor-pointer', fullScreen && 'p-5 -mt-2.5')}>
                    <ActionDropdown>
                      {overflow}
                    </ActionDropdown>
                  </div>}
                {modalStack.current.length > 1
                  ? <button type='button' aria-label='back' className={cn(btn, 'me-auto ps-6')} onClick={onBack}><BackArrow width={18} height={18} /></button>
                  : null}
                <Dialog.Close
                  aria-label='close'
                  className={closeClasses({ className: cn(btn, 'ms-auto pe-6 text-[160%] leading-4', fullScreen && 'p-5') })}
                >X
                </Dialog.Close>
              </div>
              <div className={cn(styles.body, fullScreen && styles.fullScreen, fullScreen ? 'w-screen' : 'p-8')}>
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
      canPointerDismissRef.current = false
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
