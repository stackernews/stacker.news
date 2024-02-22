import { useRouter } from 'next/router'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import Button from 'react-bootstrap/Button'
import Toast from 'react-bootstrap/Toast'
import ToastBody from 'react-bootstrap/ToastBody'
import ToastContainer from 'react-bootstrap/ToastContainer'
import styles from './toast.module.css'

const ToastContext = createContext(() => {})

export const TOAST_DEFAULT_DELAY_MS = 5000

export const ToastProvider = ({ children }) => {
  const router = useRouter()
  const [toasts, setToasts] = useState([])
  const toastId = useRef(0)

  const dispatchToast = useCallback((toast) => {
    toast = {
      ...toast,
      createdAt: +new Date(),
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
      const toRemoveHasCancel = !!toast.onCancel || !!toast.onUndo
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
    const handleRouteChangeStart = () => setToasts(toasts => toasts.filter(({ onCancel, onUndo }) => onCancel || onUndo), [])
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
          const onClose = () => {
            toast.onUndo?.()
            toast.onCancel?.()
            toast.onClose?.()
            removeToast(toast)
          }
          const buttonElement = toast.onUndo
            ? <div className={`${styles.toastUndo} ${textStyle}`}>undo</div>
            : toast.onCancel
              ? <div className={`${styles.toastCancel} ${textStyle}`}>cancel</div>
              : <div className={`${styles.toastClose} ${textStyle}`}>X</div>
          const elapsed = (+new Date() - toast.createdAt)
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
                    onClick={onClose}
                  >{buttonElement}
                  </Button>
                </div>
              </ToastBody>
              {toast.delay > 0 && <div className={`${styles.progressBar} ${styles[toast.variant]}`} style={{ animationDelay: `-${elapsed}ms` }} />}
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
      pendingMessage,
      onSuccess,
      onCancel,
      onError,
      onUndo,
      hideError,
      hideSuccess,
      ...toastProps
    } = flowFn(...args)
    let canceled

    // XXX HACK this ends the flow by using flow toast which immediately closes itself
    const endFlow = () => toaster.warning('', { ...toastProps, delay: 0, autohide: true, flowId })

    toaster.warning(pendingMessage || `${t} pending`, {
      autohide: false,
      onCancel: onCancel
        ? async () => {
          try {
            await onCancel()
            canceled = true
            toaster.warning(`${t} canceled`, { ...toastProps, flowId })
          } catch (err) {
            toaster.danger(`failed to cancel ${t}`, { ...toastProps, flowId })
          }
        }
        : undefined,
      onUndo: onUndo
        ? async () => {
          try {
            await onUndo()
            canceled = true
          } catch (err) {
            toaster.danger(`failed to undo ${t}`, { ...toastProps, flowId })
          }
        }
        : undefined,
      flowId,
      ...toastProps
    })
    try {
      const ret = await onPending()
      if (!canceled) {
        if (hideSuccess) {
          endFlow()
        } else {
          toaster.success(`${t} successful`, { ...toastProps, flowId })
        }
        await onSuccess?.()
      }
      return ret
    } catch (err) {
      // ignore errors if canceled since they might be caused by cancellation
      if (canceled) return
      const reason = err?.message?.toString().toLowerCase() || 'unknown reason'
      if (hideError) {
        endFlow()
      } else {
        toaster.danger(`${t} failed: ${reason}`, { ...toastProps, flowId })
      }
      await onError?.()
      throw err
    }
  }
  return wrapper
}
