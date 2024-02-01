import { useRouter } from 'next/router'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Button from 'react-bootstrap/Button'
import Toast from 'react-bootstrap/Toast'
import ToastBody from 'react-bootstrap/ToastBody'
import ToastContainer from 'react-bootstrap/ToastContainer'
import styles from './toast.module.css'

const ToastContext = createContext(() => {})

export const ToastProvider = ({ children }) => {
  const router = useRouter()
  const [toasts, setToasts] = useState([])
  const toastId = useRef(0)

  const dispatchToast = useCallback((toastConfig) => {
    toastConfig = {
      ...toastConfig,
      id: toastId.current++
    }
    setToasts(toasts => [...toasts, toastConfig])
    return () => removeToast(toastConfig)
  }, [])

  const removeToast = useCallback(({ id, onCancel, tag }) => {
    setToasts(toasts => toasts.filter(toast => {
      if (tag && !onCancel) {
        // if tag onCancel is not set, toast did show X for closing.
        // if additionally tag is set, we close all toasts with same tag.
        return toast.tag !== tag
      }
      return toast.id !== id
    }))
  }, [])

  const toaster = useMemo(() => ({
    success: (body, options) => {
      const toast = {
        body,
        variant: 'success',
        autohide: true,
        delay: 5000,
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
        delay: 5000,
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
    const handleRouteChangeStart = () => setToasts(toasts => toasts.filter(({ onCancel }) => onCancel), [])
    router.events.on('routeChangeStart', handleRouteChangeStart)

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart)
    }
  }, [router])

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
    let { rawBody, body, amount } = prevToast
    rawBody ??= body
    amount = amount ? amount + 1 : 2
    body = `(${amount}) ${rawBody}`
    return [
      ...toasts.slice(0, idx),
      { ...toast, rawBody, amount, body },
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
          return (
            <Toast
              key={toast.id} bg={toast.variant} show autohide={toast.autohide}
              delay={toast.delay} className={`${styles.toast} ${styles[toast.variant]} ${textStyle}`} onClose={() => removeToast(toast.id)}
            >
              <ToastBody>
                <div className='d-flex align-items-center'>
                  <div className='flex-grow-1'>{toast.body}</div>
                  <Button
                    variant={null}
                    className='p-0 ps-2'
                    aria-label='close'
                    onClick={() => {
                      toast.onCancel?.()
                      toast.onClose?.()
                      removeToast(toast)
                    }}
                  >{toast.onCancel ? <div className={`${styles.toastCancel} ${textStyle}`}>cancel</div> : <div className={`${styles.toastClose} ${textStyle}`}>X</div>}
                  </Button>
                </div>
              </ToastBody>
            </Toast>
          )
        })}
      </ToastContainer>
      {children}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
