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
        open // mounted ⟺ open: stack empty ⇒ null above (unmount = today's instant close, §15.0-4)
        onOpenChange={(open, details) => {
          if (open) return
          // X (Dialog.Close ⇒ 'close-press') always closes — even under keepOpen (rb parity:
          // onHide={undefined} only ever killed light dismiss; the X called onClose directly)
          if (details.reason === 'close-press') return onClose()
          // light dismiss ('escape-key' / 'outside-press'): gated exactly like rb's onHide
          if (!keepOpen) onClose()
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className={styles.backdrop} />
          <Dialog.Viewport className={cn(styles.viewport, fullScreen && styles.fullScreen)}>
            <Dialog.Popup
              ref={popupRef}
              // rb parity: focus the popup itself (rb focused the .modal container; Base UI's
              // default — first tabbable — would paint focus rings / open mobile keyboards
              // where today none appear, §15.2). finalFocus default ≈ body via showModal's blur
              initialFocus={() => popupRef.current}
              // rb parity: arrow/Home/End keys must keep bubbling to document-level listeners
              // (the carousel's slide nav died without this, §15.5 pre-flight 14). Base UI's
              // popup stopPropagation()s composite keys; preventBaseUIHandler skips exactly that
              onKeyDown={e => {
                if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') e.preventBaseUIHandler()
              }}
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
