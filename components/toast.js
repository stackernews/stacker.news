import { useRouter } from 'next/router'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Button from 'react-bootstrap/Button'
import Toast from 'react-bootstrap/Toast'
import ToastBody from 'react-bootstrap/ToastBody'
import ToastContainer from 'react-bootstrap/ToastContainer'
import styles from './toast.module.css'

const ToastContext = createContext(() => {})

export const TOAST_DEFAULT_DELAY_MS = 5000

const mapHidden = ({ id, tag }) => toast => {
  // mark every previous toast with same tag as hidden
  if (toast.tag === tag && toast.id !== id) return { ...toast, hidden: true }
  return toast
}

export const ToastProvider = ({ children }) => {
  const router = useRouter()
  const [toasts, setToasts] = useState([])
  const toastId = useRef(0)

  const removeToast = useCallback(({ id, tag }) => {
    setToasts(toasts => toasts.filter(toast => {
      if (toast.id === id) {
        // remove the toast with the passed id with no exceptions
        return false
      }
      const sameTag = tag && tag === toast.tag
      // remove toasts with same tag
      return !sameTag
    }))
  }, [setToasts])

  const dispatchToast = useCallback((toast) => {
    toast = {
      ...toast,
      createdAt: +new Date(),
      id: toastId.current++
    }
    setToasts(toasts => [...toasts, toast].map(mapHidden(toast)))
    return () => removeToast(toast)
  }, [setToasts, removeToast])

  const toaster = useMemo(() => ({
    success: (body, options) => {
      const toast = {
        body,
        variant: 'success',
        autohide: true,
        delay: TOAST_DEFAULT_DELAY_MS,
        tag: options?.tag || body,
        ...options
      }
      return dispatchToast(toast)
    },
    warning: (body, options) => {
      const toast = {
        body,
        variant: 'warning',
        autohide: true,
        delay: TOAST_DEFAULT_DELAY_MS,
        tag: options?.tag || body,
        ...options
      }
      return dispatchToast(toast)
    },
    danger: (body, options) => {
      const toast = {
        body,
        variant: 'danger',
        autohide: false,
        tag: options?.tag || body,
        ...options
      }
      return dispatchToast(toast)
    }
  }), [dispatchToast, removeToast])

  // Only clear toasts with no cancel function on page navigation
  // since navigation should not interfere with being able to cancel an action.
  useEffect(() => {
    const handleRouteChangeStart = () => setToasts(toasts => toasts.length > 0 ? toasts.filter(({ persistOnNavigate }) => persistOnNavigate) : toasts)
    router.events.on('routeChangeStart', handleRouteChangeStart)

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart)
    }
  }, [router.events, setToasts])

  // this function merges toasts with the same tag into one toast.
  // for example: 3x 'zap pending' -> '(3) zap pending'
  const tagReducer = (toasts, toast) => {
    const { tag } = toast

    // has tag?
    if (!tag) return [...toasts, toast]

    // existing tag?
    const idx = toasts.findIndex(toast => toast.tag === tag)
    if (idx === -1) return [...toasts, toast]

    // merge toasts with same tag
    const prevToast = toasts[idx]
    let { amount } = prevToast
    amount = amount ? amount + 1 : 2
    const body = `(${amount}) ${toast.body}`
    return [
      ...toasts.slice(0, idx),
      { ...toast, amount, body },
      ...toasts.slice(idx + 1)
    ]
  }

  // only show toast with highest ID of each tag
  const visibleToasts = toasts.reduce(tagReducer, [])

  return (
    <ToastContext.Provider value={toaster}>
      <ToastContainer className={`pb-3 pe-3 ${styles.toastContainer}`} position='bottom-end' containerPosition='fixed'>
        {visibleToasts.map(toast => {
          const textStyle = toast.variant === 'warning' ? 'text-dark' : ''
          const onClose = () => {
            toast.onClose?.()
            removeToast(toast)
          }
          // a toast is unhidden if it was hidden before since it now gets rendered
          const unhidden = toast.hidden
          // we only need to start the animation at a different timing when it was hidden by another toast before.
          // if we don't do this, the animation for rerendered toasts skips ahead and toast delay and animation get out of sync.
          const elapsed = (+new Date() - toast.createdAt)
          const animationDelay = unhidden ? `-${elapsed}ms` : undefined
          const animationDuration = `${toast.delay}ms`
          return (
            <Toast
              key={toast.id} bg={toast.variant} show autohide={toast.autohide}
              delay={toast.delay} className={`${styles.toast} ${styles[toast.variant]} ${textStyle}`} onClose={() => removeToast(toast)}
            >
              <ToastBody>
                <div className='d-flex align-items-center'>
                  <div className='flex-grow-1 overflow-hidden'>{toast.body}</div>
                  <Button
                    variant={null}
                    className='p-0 ps-2'
                    aria-label='close'
                    onClick={onClose}
                  ><div className={`${styles.toastClose} ${textStyle}`}>X</div>
                  </Button>
                </div>
              </ToastBody>
              {toast.progressBar && <div className={`${styles.progressBar} ${styles[toast.variant]}`} style={{ animationDuration, animationDelay }} />}
            </Toast>
          )
        })}
      </ToastContainer>
      {children}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
