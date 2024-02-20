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

  const dispatchToast = useCallback((toast) => {
    toast = {
      ...toast,
      id: toastId.current++
    }
    const { flowId } = toast
    setToasts(toasts => {
      if (flowId) {
        // replace previous toast with same flow id
        const idx = toasts.findIndex(toast => toast.flowId === flowId)
        if (idx === -1) return [...toasts, toast]
        return [
          ...toasts.slice(0, idx),
          toast,
          ...toasts.slice(idx + 1)
        ]
      }
      return [...toasts, toast]
    })
    return () => removeToast(toast)
  }, [])

  const removeToast = useCallback(({ id, onCancel, tag }) => {
    setToasts(toasts => toasts.filter(toast => {
      if (toast.id === id) {
        // remove the toast with the passed id with no exceptions
        return false
      }
      const sameTag = tag && tag === toast.tag
      if (!sameTag) {
        // don't touch toasts with different tags
        return true
      }
      const toRemoveHasCancel = !!toast.onCancel
      if (toRemoveHasCancel) {
        // don't remove this toast so the user can decide to cancel this toast now
        return true
      }
      // remove toasts with same tag if they are not cancelable
      return false
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
              delay={toast.delay} className={`${styles.toast} ${styles[toast.variant]} ${textStyle}`} onClose={() => removeToast(toast)}
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

export const withToastFlow = (toaster) => flowFn => {
  const wrapper = async (...args) => {
    const {
      flowId,
      type: t,
      onPending,
      onSuccess,
      onCancel,
      onError
    } = flowFn(...args)
    let canceled
    toaster.warning(`${t} pending`, {
      autohide: false,
      onCancel: async () => {
        try {
          await onCancel?.()
          canceled = true
          toaster.warning(`${t} canceled`, { flowId })
        } catch (err) {
          toaster.danger(`failed to cancel ${t}`, { flowId })
        }
      },
      flowId
    })
    try {
      const ret = await onPending()
      if (!canceled) {
        toaster.success(`${t} successful`, { flowId })
        await onSuccess?.()
      }
      return ret
    } catch (err) {
      // ignore errors if canceled since they might be caused by cancellation
      if (canceled) return
      const reason = err?.message?.toString().toLowerCase() || 'unknown reason'
      toaster.danger(`${t} failed: ${reason}`, { flowId })
      await onError?.()
      throw err
    }
  }
  return wrapper
}
