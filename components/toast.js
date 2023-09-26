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
  }, [])

  const removeToast = useCallback(id => {
    setToasts(toasts => toasts.filter(toast => toast.id !== id))
  }, [])

  const toaster = useMemo(() => ({
    success: body => {
      dispatchToast({
        body,
        variant: 'success',
        autohide: true,
        delay: 5000
      })
    },
    danger: (body, onCloseCallback) => {
      const id = toastId.current
      dispatchToast({
        id,
        body,
        variant: 'danger',
        autohide: false,
        onCloseCallback
      })
      return {
        removeToast: () => removeToast(id)
      }
    }
  }), [dispatchToast])

  // Clear all toasts on page navigation
  useEffect(() => {
    const handleRouteChangeStart = () => setToasts([])
    router.events.on('routeChangeStart', handleRouteChangeStart)

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart)
    }
  }, [router])

  return (
    <ToastContext.Provider value={toaster}>
      <ToastContainer className={`pb-3 pe-3 ${styles.toastContainer}`} position='bottom-end' containerPosition='fixed'>
        {toasts.map(toast => (
          <Toast
            key={toast.id} bg={toast.variant} show autohide={toast.autohide}
            delay={toast.delay} className={`${styles.toast} ${styles[toast.variant]}`} onClose={() => removeToast(toast.id)}
          >
            <ToastBody>
              <div className='d-flex align-items-center'>
                <div className='flex-grow-1'>{toast.body}</div>
                <Button
                  variant={null}
                  className='p-0 ps-2'
                  aria-label='close'
                  onClick={() => {
                    if (toast.onCloseCallback) toast.onCloseCallback()
                    removeToast(toast.id)
                  }}
                ><div className={styles.toastClose}>X</div>
                </Button>
              </div>
            </ToastBody>
          </Toast>
        ))}
      </ToastContainer>
      {children}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
